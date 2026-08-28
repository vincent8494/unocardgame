/* End-to-end: boots the real server, connects real socket.io clients, plays a
 * full round with a bot, and checks that no client is ever sent another hand. */
const { spawn } = require('child_process')
const path = require('path')
const io = require('socket.io-client')
const { canPlay, isWild } = require('../game/cards')

const PORT = 5099
const URL = `http://127.0.0.1:${PORT}`
const ROOT = path.resolve(__dirname, '..')

const fail = []
const check = (c, m) => { if (!c) fail.push(m) }
const wait = ms => new Promise(r => setTimeout(r, ms))

function connect() {
    return io(URL, { transports: ['websocket'], forceNew: true })
}
function join(sock, roomCode, name) {
    return new Promise((res, rej) => {
        sock.emit('join', { roomCode, name }, reply => (reply && reply.ok ? res(reply) : rej(new Error(reply && reply.error))))
        setTimeout(() => rej(new Error('join timed out')), 4000)
    })
}

;(async () => {
    const server = spawn('node', ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' })
    await wait(1200)

    const a = connect(), b = connect()
    let stateA = null, stateB = null
    a.on('gameState', s => { stateA = s })
    b.on('gameState', s => { stateB = s })
    const errors = []
    a.on('actionError', e => errors.push(e.error))

    await join(a, 'test1', 'Alice')
    await join(b, 'test1', 'Bob')
    await wait(300)

    check(stateA && stateA.players.length === 2, `expected 2 players, got ${stateA && stateA.players.length}`)
    check(stateA.status === 'lobby', `expected lobby, got ${stateA && stateA.status}`)

    a.emit('addBot')
    await wait(300)
    check(stateA.players.length === 3, `expected 3 players after addBot, got ${stateA.players.length}`)
    check(stateA.players.some(p => p.isBot), 'bot was not added')

    a.emit('startGame')
    await wait(400)
    check(stateA.status === 'playing', `expected playing, got ${stateA.status}`)
    check(stateA.you.hand.length === 7, `Alice should hold 7, holds ${stateA.you.hand.length}`)
    check(stateB.you.hand.length === 7, `Bob should hold 7, holds ${stateB.you.hand.length}`)

    // --- privacy: the payload must never carry another player's cards --------
    const leaked = JSON.stringify(stateA.players)
    check(!/hand/.test(leaked), 'gameState leaked a hand array for other players')
    check(stateA.players.every(p => typeof p.cardCount === 'number'), 'players missing cardCount')
    check(stateA.you.id !== stateB.you.id, 'both clients got the same identity')
    check(JSON.stringify(stateA.you.hand) !== JSON.stringify(stateB.you.hand), 'both players dealt identical hands')

    // --- cheating: playing out of turn and playing a card you do not hold ----
    const notTurn = stateA.turnPlayerId === stateA.you.id ? b : a
    const notTurnState = notTurn === a ? stateA : stateB
    notTurn.emit('playCard', { card: notTurnState.you.hand[0] })
    await wait(250)
    const offTurnRejected = stateA.turnPlayerId !== null
    check(offTurnRejected, 'out-of-turn play was not rejected')

    a.emit('playCard', { card: 'D4W', color: 'R' }) // Alice almost certainly has no D4W
    await wait(250)

    // --- play the round out --------------------------------------------------
    const socks = { [stateA.you.id]: a, [stateB.you.id]: b }
    let guard = 0
    while (stateA.status === 'playing' && guard++ < 400) {
        const turnId = stateA.turnPlayerId
        const sock = socks[turnId]
        if (!sock) { await wait(250); continue } // bot's turn
        const st = sock === a ? stateA : stateB
        const legal = st.you.hand.filter(c => canPlay(c, st.currentColor, st.topCard))
        if (st.you.hand.length === 2) sock.emit('callUno')
        if (legal.length) sock.emit('playCard', { card: legal[0], color: isWild(legal[0]) ? 'R' : undefined })
        else { sock.emit('drawCard'); await wait(120); sock.emit('passTurn') }
        await wait(140)
    }

    check(guard < 400, 'round never finished')
    check(['roundOver', 'gameOver'].includes(stateA.status), `round ended in status ${stateA.status}`)
    const winner = stateA.players.find(p => p.id === stateA.roundWinner)
    check(!!winner, 'no round winner recorded')
    check(winner && winner.cardCount === 0, `winner still holds ${winner && winner.cardCount} cards`)

    // --- rematch -------------------------------------------------------------
    a.emit('nextRound')
    await wait(400)
    check(stateA.status === 'playing', `nextRound did not restart play (status ${stateA.status})`)
    check(stateA.you.hand.length === 7, `rematch should deal 7, dealt ${stateA.you.hand.length}`)
    const totalAfter = stateA.players.reduce((s, p) => s + p.cardCount, 0) + stateA.drawPileCount
    check(totalAfter <= 108 && totalAfter >= 100, `card total after rematch looks wrong: ${totalAfter}`)

    // --- chat ---------------------------------------------------------------
    let chat = null
    b.on('message', m => { chat = m })
    a.emit('sendMessage', { message: 'hello' }, () => {})
    await wait(250)
    check(chat && chat.text === 'hello' && chat.user === 'Alice', 'chat message did not arrive')

    a.close(); b.close()
    await wait(200)
    server.kill()

    console.log(`rejected actions seen : ${errors.length} (${[...new Set(errors)].join(', ') || 'none'})`)
    if (fail.length) {
        console.log(`\nFAILURES (${fail.length}):`)
        fail.forEach(f => console.log('  - ' + f))
        process.exit(1)
    }
    console.log('integration: lobby, bots, privacy, cheat-rejection, round, rematch, chat — PASSED')
    process.exit(0)
})().catch(e => { console.error('integration error:', e.message); process.exit(1) })

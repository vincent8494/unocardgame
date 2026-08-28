'use strict'

const { COLORS, KIND, parseCard, isWild, createDeck, shuffle, canPlay, handScore } = require('./cards')

const HAND_SIZE = 7
const MAX_PLAYERS = 4
const TARGET_SCORE = 500

/* The engine owns all rules. It is pure-ish: every action takes a state and
 * mutates it in place, returning { ok } or { ok: false, error }. The socket
 * layer never computes rules and never trusts a client for anything but intent. */

function createGame(roomCode) {
    return {
        roomCode,
        status: 'lobby', // lobby | playing | roundOver | gameOver
        players: [],     // { id, name, isBot, hand, saidUno, score, connected }
        turnIndex: 0,
        direction: 1,
        drawPile: [],
        discardPile: [],
        currentColor: null,
        pendingWild: null, // id of player who must choose a colour
        roundWinner: null,
        winner: null,
        targetScore: TARGET_SCORE,
        log: []
    }
}

const activePlayers = game => game.players
const currentPlayer = game => game.players[game.turnIndex]
const findPlayer = (game, id) => game.players.find(p => p.id === id)
const topCard = game => game.discardPile[game.discardPile.length - 1]

function addLog(game, text) {
    game.log.push({ text, at: Date.now() })
    if (game.log.length > 60) game.log.shift()
}

function addPlayer(game, { id, name, isBot = false }) {
    if (game.players.length >= MAX_PLAYERS) return { ok: false, error: 'Room is full' }
    if (game.status !== 'lobby') return { ok: false, error: 'Game already in progress' }
    game.players.push({ id, name, isBot, hand: [], saidUno: false, score: 0, connected: true })
    addLog(game, `${name} joined`)
    return { ok: true }
}

function removePlayer(game, id) {
    const idx = game.players.findIndex(p => p.id === id)
    if (idx === -1) return { ok: false }
    const [gone] = game.players.splice(idx, 1)
    addLog(game, `${gone.name} left`)

    if (game.turnIndex >= game.players.length) game.turnIndex = 0
    else if (idx < game.turnIndex) game.turnIndex--

    // a round needs two players; drop back to the lobby if we fall below that
    if (game.status === 'playing' && game.players.length < 2) {
        game.status = 'lobby'
        addLog(game, 'Not enough players — back to the lobby')
    }
    return { ok: true, player: gone }
}

/** Refill the draw pile from the discard pile, keeping the visible top card. */
function replenishDrawPile(game) {
    if (game.drawPile.length > 0) return true
    if (game.discardPile.length <= 1) return false // genuinely out of cards
    const top = game.discardPile.pop()
    // wilds go back to the deck colourless
    game.drawPile = shuffle(game.discardPile.map(c => c))
    game.discardPile = [top]
    addLog(game, 'Draw pile was empty — discards reshuffled')
    return true
}

function drawCards(game, player, count) {
    const drawn = []
    for (let i = 0; i < count; i++) {
        if (game.drawPile.length === 0 && !replenishDrawPile(game)) break
        drawn.push(game.drawPile.pop())
    }
    player.hand.push(...drawn)
    if (player.hand.length > 1) player.saidUno = false
    return drawn
}

function startRound(game) {
    if (game.players.length < 2) return { ok: false, error: 'Need at least 2 players' }

    game.drawPile = shuffle(createDeck())
    game.discardPile = []
    game.roundWinner = null
    game.pendingWild = null
    game.direction = 1

    for (const p of game.players) {
        p.hand = []
        p.saidUno = false
    }
    for (const p of game.players) drawCards(game, p, HAND_SIZE)

    // Flip a starting card. A wild +4 may not start the discard, so bury it.
    let start
    while (true) {
        start = game.drawPile.pop()
        if (start !== 'D4W') break
        game.drawPile.unshift(start)
    }
    game.discardPile.push(start)

    const card = parseCard(start)
    game.currentColor = card.color
    game.turnIndex = 0
    game.status = 'playing'
    addLog(game, `Round started — top card ${start}`)

    // The opening card still takes effect, per the real rules.
    if (card.kind === KIND.WILD) {
        game.currentColor = COLORS[Math.floor(Math.random() * COLORS.length)]
        addLog(game, `Opening wild — colour is ${game.currentColor}`)
    } else if (card.kind === KIND.SKIP) {
        advanceTurn(game)
    } else if (card.kind === KIND.REVERSE) {
        game.direction = -1
        game.turnIndex = game.players.length - 1
    } else if (card.kind === KIND.DRAW2) {
        drawCards(game, currentPlayer(game), 2)
        advanceTurn(game)
    }
    return { ok: true }
}

function advanceTurn(game, steps = 1) {
    const n = game.players.length
    if (n === 0) return
    game.turnIndex = (((game.turnIndex + game.direction * steps) % n) + n) % n
}

function playCard(game, playerId, code, chosenColor) {
    if (game.status !== 'playing') return { ok: false, error: 'Game is not running' }
    const player = findPlayer(game, playerId)
    if (!player) return { ok: false, error: 'Not in this game' }
    if (currentPlayer(game).id !== playerId) return { ok: false, error: 'Not your turn' }

    const held = player.hand.indexOf(code)
    if (held === -1) return { ok: false, error: 'You do not hold that card' }
    if (!canPlay(code, game.currentColor, topCard(game))) return { ok: false, error: 'That card cannot be played' }
    if (isWild(code) && !COLORS.includes(chosenColor)) return { ok: false, error: 'Pick a colour for the wild' }

    player.hand.splice(held, 1)
    game.discardPile.push(code)

    const card = parseCard(code)
    game.currentColor = isWild(code) ? chosenColor : card.color
    addLog(game, `${player.name} played ${code}${isWild(code) ? ` → ${chosenColor}` : ''}`)

    if (player.hand.length === 0) return endRound(game, player)

    // a player holding one card who never called UNO is catchable until their next turn
    if (player.hand.length !== 1) player.saidUno = false

    switch (card.kind) {
        case KIND.SKIP:
            advanceTurn(game)
            addLog(game, `${currentPlayer(game).name} was skipped`)
            advanceTurn(game)
            break
        case KIND.REVERSE:
            if (game.players.length === 2) advanceTurn(game, 2) // acts as a skip heads-up
            else { game.direction *= -1; advanceTurn(game) }
            break
        case KIND.DRAW2: {
            advanceTurn(game)
            const victim = currentPlayer(game)
            drawCards(game, victim, 2)
            addLog(game, `${victim.name} drew 2`)
            advanceTurn(game)
            break
        }
        case KIND.WILD4: {
            advanceTurn(game)
            const victim = currentPlayer(game)
            drawCards(game, victim, 4)
            addLog(game, `${victim.name} drew 4`)
            advanceTurn(game)
            break
        }
        default:
            advanceTurn(game)
    }
    return { ok: true }
}

function drawCard(game, playerId) {
    if (game.status !== 'playing') return { ok: false, error: 'Game is not running' }
    const player = findPlayer(game, playerId)
    if (!player) return { ok: false, error: 'Not in this game' }
    if (currentPlayer(game).id !== playerId) return { ok: false, error: 'Not your turn' }

    const [drawn] = drawCards(game, player, 1)
    if (!drawn) return { ok: false, error: 'No cards left to draw' }
    addLog(game, `${player.name} drew a card`)

    // Drawn card is playable only if the player chooses to; keep it simple and
    // pass the turn. The client offers the card back if it is legal.
    const playable = canPlay(drawn, game.currentColor, topCard(game))
    if (!playable) advanceTurn(game)
    return { ok: true, drawn, playable }
}

/** Ends the turn after a draw when the player declines to play the drawn card. */
function passTurn(game, playerId) {
    if (game.status !== 'playing') return { ok: false, error: 'Game is not running' }
    if (currentPlayer(game).id !== playerId) return { ok: false, error: 'Not your turn' }
    advanceTurn(game)
    return { ok: true }
}

function callUno(game, playerId) {
    const player = findPlayer(game, playerId)
    if (!player) return { ok: false, error: 'Not in this game' }
    if (player.hand.length > 2) return { ok: false, error: 'Too early to call UNO' }
    player.saidUno = true
    addLog(game, `${player.name} called UNO!`)
    return { ok: true }
}

/** Any other player may catch someone sitting on one card who never called it. */
function catchUno(game, accuserId, targetId) {
    const accuser = findPlayer(game, accuserId)
    const target = findPlayer(game, targetId)
    if (!accuser || !target) return { ok: false, error: 'Unknown player' }
    if (accuser.id === target.id) return { ok: false, error: 'Cannot catch yourself' }
    if (target.hand.length !== 1 || target.saidUno) return { ok: false, error: 'Nothing to catch' }
    drawCards(game, target, 2)
    addLog(game, `${accuser.name} caught ${target.name} — 2 cards`)
    return { ok: true }
}

function endRound(game, winnerPlayer) {
    const points = game.players
        .filter(p => p.id !== winnerPlayer.id)
        .reduce((sum, p) => sum + handScore(p.hand), 0)
    winnerPlayer.score += points
    game.roundWinner = winnerPlayer.id
    addLog(game, `${winnerPlayer.name} won the round (+${points})`)

    if (winnerPlayer.score >= game.targetScore) {
        game.status = 'gameOver'
        game.winner = winnerPlayer.id
        addLog(game, `${winnerPlayer.name} wins the game!`)
    } else {
        game.status = 'roundOver'
    }
    return { ok: true, roundOver: true }
}

function nextRound(game) {
    if (game.status !== 'roundOver') return { ok: false, error: 'Round is not over' }
    return startRound(game)
}

function resetGame(game) {
    for (const p of game.players) {
        p.score = 0
        p.hand = []
        p.saidUno = false
    }
    game.status = 'lobby'
    game.winner = null
    game.roundWinner = null
    addLog(game, 'New game')
    return { ok: true }
}

/** What one player is allowed to see. Other hands are counts, never codes. */
function viewFor(game, playerId) {
    return {
        roomCode: game.roomCode,
        status: game.status,
        currentColor: game.currentColor,
        topCard: topCard(game) || null,
        drawPileCount: game.drawPile.length,
        direction: game.direction,
        turnPlayerId: game.players[game.turnIndex] ? game.players[game.turnIndex].id : null,
        roundWinner: game.roundWinner,
        winner: game.winner,
        targetScore: game.targetScore,
        log: game.log.slice(-25),
        you: (() => {
            const me = findPlayer(game, playerId)
            return me ? { id: me.id, name: me.name, hand: me.hand.slice(), score: me.score, saidUno: me.saidUno } : null
        })(),
        players: game.players.map(p => ({
            id: p.id,
            name: p.name,
            isBot: p.isBot,
            cardCount: p.hand.length,
            score: p.score,
            saidUno: p.saidUno,
            connected: p.connected
        }))
    }
}

module.exports = {
    HAND_SIZE, MAX_PLAYERS, TARGET_SCORE,
    createGame, addPlayer, removePlayer, startRound, nextRound, resetGame,
    playCard, drawCard, passTurn, callUno, catchUno,
    advanceTurn, currentPlayer, findPlayer, topCard, viewFor, activePlayers,
    replenishDrawPile, drawCards
}

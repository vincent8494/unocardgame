const E = require('../game/engine')
const { canPlay, isWild, COLORS, handScore } = require('../game/cards')

let failures = []
const check = (cond, msg) => { if (!cond) failures.push(msg) }

function totalCards(g) {
  return g.drawPile.length + g.discardPile.length + g.players.reduce((s, p) => s + p.hand.length, 0)
}
function assertInvariants(g, where) {
  check(totalCards(g) === 108, `${where}: card count is ${totalCards(g)}, expected 108`)
  for (const p of g.players) {
    check(!p.hand.some(c => c == null), `${where}: ${p.name} holds an undefined card`)
  }
  check(!g.drawPile.some(c => c == null), `${where}: undefined in draw pile`)
}

// ---- play N random complete games -----------------------------------------
let roundsPlayed = 0, reshuffles = 0, gamesFinished = 0, maxTurns = 0

for (let gameNo = 0; gameNo < 300; gameNo++) {
  const nPlayers = 2 + (gameNo % 3) // 2, 3, 4
  const g = E.createGame('TEST' + gameNo)
  for (let i = 0; i < nPlayers; i++) E.addPlayer(g, { id: 'p' + i, name: 'P' + i, isBot: true })

  const started = E.startRound(g)
  check(started.ok, `game ${gameNo}: startRound failed: ${started.error}`)
  assertInvariants(g, `game ${gameNo} after deal`)

  let turns = 0
  while (g.status === 'playing' && turns < 4000) {
    turns++
    const me = E.currentPlayer(g)
    const before = g.discardPile.length
    const legal = me.hand.filter(c => canPlay(c, g.currentColor, E.topCard(g)))

    if (legal.length && Math.random() < 0.9) {
      const card = legal[Math.floor(Math.random() * legal.length)]
      if (me.hand.length === 2) E.callUno(g, me.id)
      const colour = COLORS[Math.floor(Math.random() * 4)]
      const r = E.playCard(g, me.id, card, isWild(card) ? colour : undefined)
      check(r.ok, `game ${gameNo}: legal play rejected (${card}): ${r.error}`)
    } else {
      const pileBefore = g.drawPile.length
      const r = E.drawCard(g, me.id)
      if (!r.ok) { check(false, `game ${gameNo}: draw failed: ${r.error}`); break }
      if (g.drawPile.length > pileBefore) reshuffles++
      if (r.playable) E.passTurn(g, me.id) // decline the drawn card
    }
    assertInvariants(g, `game ${gameNo} turn ${turns}`)
  }
  maxTurns = Math.max(maxTurns, turns)
  check(turns < 4000, `game ${gameNo}: did not terminate in 4000 turns`)
  if (g.status === 'roundOver' || g.status === 'gameOver') {
    roundsPlayed++
    const w = E.findPlayer(g, g.roundWinner)
    check(w && w.hand.length === 0, `game ${gameNo}: round winner still holds cards`)
    // Winner takes the sum of every other hand. A lone 0-card is worth 0, so a
    // zero score is legitimate — assert the exact total instead of a floor.
    const owed = g.players.filter(p => p.id !== w.id).reduce((s2, p) => s2 + handScore(p.hand), 0)
    check(w && w.score === owed, `game ${gameNo}: winner scored ${w && w.score}, hands total ${owed}`)
  }
  if (g.status === 'gameOver') gamesFinished++
}

// ---- targeted regression tests against the bugs found in the old client ----

// 1. deck must not shrink between rounds (the PACK_OF_CARDS mutation bug)
{
  const g = E.createGame('R1')
  E.addPlayer(g, { id: 'a', name: 'A' }); E.addPlayer(g, { id: 'b', name: 'B' })
  for (let r = 0; r < 5; r++) {
    E.startRound(g)
    check(totalCards(g) === 108, `repeat round ${r}: ${totalCards(g)} cards, expected 108`)
  }
}

// 2. empty draw pile must reshuffle, not crash
{
  const g = E.createGame('R2')
  E.addPlayer(g, { id: 'a', name: 'A' }); E.addPlayer(g, { id: 'b', name: 'B' })
  E.startRound(g)
  // drain the draw pile into the discard so only a reshuffle can save the draw
  g.discardPile.push(...g.drawPile.splice(0))
  const r = E.drawCard(g, E.currentPlayer(g).id)
  check(r.ok, `empty-pile draw failed: ${r.error}`)
  check(r.drawn != null, 'empty-pile draw returned an undefined card')
  check(g.drawPile.length > 0, 'draw pile was not replenished')
}

// 3. server rejects out-of-turn play and cards the player does not hold
{
  const g = E.createGame('R3')
  E.addPlayer(g, { id: 'a', name: 'A' }); E.addPlayer(g, { id: 'b', name: 'B' })
  E.startRound(g)
  const notMyTurn = g.players.find(p => p.id !== E.currentPlayer(g).id)
  check(!E.playCard(g, notMyTurn.id, notMyTurn.hand[0]).ok, 'out-of-turn play was allowed')
  check(!E.playCard(g, E.currentPlayer(g).id, 'D4W_not_real').ok, 'phantom card was allowed')
}

// 4. wild without a colour choice is rejected
{
  const g = E.createGame('R4')
  E.addPlayer(g, { id: 'a', name: 'A' }); E.addPlayer(g, { id: 'b', name: 'B' })
  E.startRound(g)
  const me = E.currentPlayer(g)
  me.hand.push('W')
  check(!E.playCard(g, me.id, 'W').ok, 'wild with no colour was allowed')
  check(!E.playCard(g, me.id, 'W', 'Q').ok, 'wild with bogus colour Q was allowed')
  check(E.playCard(g, me.id, 'W', 'G').ok, 'wild with valid colour was rejected')
  check(g.currentColor === 'G', 'wild did not set the colour')
}

// 5. UNO catch
{
  const g = E.createGame('R5')
  E.addPlayer(g, { id: 'a', name: 'A' }); E.addPlayer(g, { id: 'b', name: 'B' })
  E.startRound(g)
  const a = E.findPlayer(g, 'a')
  a.hand = ['5R']; a.saidUno = false
  check(E.catchUno(g, 'b', 'a').ok, 'valid UNO catch was rejected')
  check(a.hand.length === 3, `caught player should hold 3, holds ${a.hand.length}`)
  a.hand = ['5R']; a.saidUno = true
  check(!E.catchUno(g, 'b', 'a').ok, 'caught a player who did call UNO')
}

// 6. two-player reverse acts as a skip
{
  const g = E.createGame('R6')
  E.addPlayer(g, { id: 'a', name: 'A' }); E.addPlayer(g, { id: 'b', name: 'B' })
  E.startRound(g)
  const me = E.currentPlayer(g)
  const mine = me.id
  me.hand.push(`_${g.currentColor}`)
  E.playCard(g, mine, `_${g.currentColor}`)
  check(E.currentPlayer(g).id === mine, 'heads-up reverse did not return the turn to the player')
}

// 7. a lone zero card is worth zero points to the winner
{
  const g = E.createGame('R7')
  E.addPlayer(g, { id: 'a', name: 'A' }); E.addPlayer(g, { id: 'b', name: 'B' })
  E.startRound(g)
  const a = E.findPlayer(g, 'a'), b = E.findPlayer(g, 'b')
  g.turnIndex = g.players.indexOf(a)
  a.hand = ['5R']; b.hand = ['0G']
  g.currentColor = 'R'; g.discardPile = ['3R']
  E.playCard(g, 'a', '5R')
  check(g.roundWinner === 'a', 'player who emptied their hand did not win')
  check(a.score === 0, `lone 0-card should score 0, scored ${a.score}`)
  b.hand = ['9G']; a.score = 0; a.hand = ['5R']
  g.status = 'playing'; g.turnIndex = g.players.indexOf(a); g.currentColor = 'R'; g.discardPile = ['3R']
  E.playCard(g, 'a', '5R')
  check(a.score === 9, `lone 9-card should score 9, scored ${a.score}`)
}

console.log(`games simulated      : 300 (2-4 players)`)
console.log(`rounds completed     : ${roundsPlayed}`)
console.log(`games reaching 500pt : ${gamesFinished}`)
console.log(`draw-pile reshuffles : ${reshuffles}`)
console.log(`longest round        : ${maxTurns} turns`)
console.log('')
if (failures.length) {
  console.log(`FAILURES (${failures.length}):`)
  ;[...new Set(failures)].slice(0, 15).forEach(f => console.log('  - ' + f))
  process.exit(1)
}
console.log('all invariants and regression tests PASSED')

require('./bot.test.js')

/* Fairness regression tests.
 *
 * Two properties must hold:
 *   1. No seat has a structural edge — the lead rotates each round.
 *   2. A human playing by the same rules as a bot wins its fair share. Bots
 *      used to always call UNO while humans had to click a button, which cost
 *      a forgetful human up to 37 points of win rate.
 *
 * These are statistical, so tolerances are wide enough not to flake but tight
 * enough to catch a real regression.
 */
const E = require('../game/engine')
const bot = require('../game/bot')
const { isWild } = require('../game/cards')

const fail = []
const check = (c, m) => { if (!c) fail.push(m) }

function playRound(game, humanId, forget, alert) {
  let guard = 0
  while (game.status === 'playing' && guard++ < 3000) {
    const cur = E.currentPlayer(game)
    if (cur.id === humanId) {
      if (cur.hand.length === 2 && Math.random() >= forget) E.callUno(game, cur.id)
      const move = bot.chooseMove(game, cur)
      if (move.action === 'play') {
        if (!E.playCard(game, cur.id, move.card, move.color).ok) { E.drawCard(game, cur.id); E.passTurn(game, cur.id) }
      } else {
        const r = E.drawCard(game, cur.id)
        if (r.ok && r.playable) {
          const c = isWild(r.drawn) ? bot.chooseColor(cur.hand) : undefined
          if (!E.playCard(game, cur.id, r.drawn, c).ok) E.passTurn(game, cur.id)
        }
      }
    } else {
      bot.takeTurn(game, cur)
    }
    // Both sides police a missed UNO after every turn. Scoping the human's
    // catch to their own turn would hand the bots twice the opportunities and
    // understate human win rate by ~6 points.
    if (humanId) {
      const t = game.players.find(p => p.id !== humanId && p.hand.length === 1 && !p.saidUno)
      if (t && Math.random() < alert) E.catchUno(game, humanId, t.id)
    }
    bot.tryCatchUno(game)
  }
}

function newGame(n, humanId) {
  const g = E.createGame('T')
  for (let i = 0; i < n; i++) {
    const id = i === 0 && humanId ? humanId : 'b' + i
    E.addPlayer(g, { id, name: id, isBot: id !== humanId })
  }
  return g
}

// ---- 1. no seat is structurally favoured, measured across a match ---------
for (const n of [2, 4]) {
  const MATCHES = 400
  const wins = new Array(n).fill(0)
  for (let m = 0; m < MATCHES; m++) {
    const g = newGame(n, null)
    E.startRound(g)
    let rounds = 0
    while (g.status !== 'gameOver' && rounds < 60) {
      playRound(g, null, 0, 0)
      if (g.status !== 'roundOver') break
      E.nextRound(g); rounds++
    }
    if (g.winner) wins[g.players.findIndex(p => p.id === g.winner)]++
  }
  const pct = wins.map(w => 100 * w / MATCHES)
  const fairShare = 100 / n
  const worst = Math.max(...pct.map(p => Math.abs(p - fairShare)))
  console.log(`${n}p seat win rates: ${pct.map(p => p.toFixed(1) + '%').join('  ')} (fair ${fairShare.toFixed(1)}%)`)
  check(worst < 9, `${n}p: a seat deviates ${worst.toFixed(1)} points from fair share`)
}

// ---- 2. a human following bot-equivalent rules wins its fair share --------
for (const n of [2, 4]) {
  const MATCHES = 500
  let w = 0
  for (let m = 0; m < MATCHES; m++) {
    const g = newGame(n, 'human')
    E.startRound(g)
    let rounds = 0
    while (g.status !== 'gameOver' && rounds < 60) {
      playRound(g, 'human', 0.2, 0.5) // same forget rate and alertness as a bot
      if (g.status !== 'roundOver') break
      E.nextRound(g); rounds++
    }
    if (g.winner === 'human') w++
    else if (!g.winner) rounds = 0
  }
  const pct = 100 * w / MATCHES
  const fairShare = 100 / n
  console.log(`${n}p human (bot-equivalent play) wins ${pct.toFixed(1)}% (fair ${fairShare.toFixed(1)}%)`)
  check(Math.abs(pct - fairShare) < 9, `${n}p: human deviates ${(pct - fairShare).toFixed(1)} points from fair share`)
}

// ---- 3. bots must remain catchable ---------------------------------------
{
  let forgot = 0
  const TRIES = 2000
  for (let i = 0; i < TRIES; i++) {
    const g = newGame(2, null)
    E.startRound(g)
    const b = E.currentPlayer(g)
    b.hand = ['5R', '7R']
    g.currentColor = 'R'; g.discardPile = ['3R']
    bot.takeTurn(g, b)
    if (!b.saidUno) forgot++
  }
  const rate = 100 * forgot / TRIES
  console.log(`bots forget to call UNO ${rate.toFixed(1)}% of the time`)
  check(rate > 8 && rate < 35, `bot UNO forget rate ${rate.toFixed(1)}% is outside a human-like range`)
}

console.log('')
if (fail.length) {
  console.log(`FAIRNESS FAILURES (${fail.length}):`)
  fail.forEach(f => console.log('  - ' + f))
  process.exit(1)
}
console.log('fairness: seats balanced, human at parity, bots catchable — PASSED')

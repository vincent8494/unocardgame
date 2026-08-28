const E = require('../game/engine')
const bot = require('../game/bot')

let stuck = 0, wins = {}, totalTurns = 0, games = 200
for (let i = 0; i < games; i++) {
  const g = E.createGame('B' + i)
  const n = 2 + (i % 3)
  for (let k = 0; k < n; k++) E.addPlayer(g, { id: 'b' + k, name: 'Bot ' + k, isBot: true })
  E.startRound(g)
  let turns = 0
  while (g.status === 'playing' && turns < 3000) {
    const before = JSON.stringify([g.turnIndex, g.discardPile.length, E.currentPlayer(g).hand.length])
    if (!bot.takeTurn(g, E.currentPlayer(g))) { stuck++; break }
    const after = JSON.stringify([g.turnIndex, g.discardPile.length, E.currentPlayer(g).hand.length])
    if (before === after) { stuck++; break }
    turns++
    const total = g.drawPile.length + g.discardPile.length + g.players.reduce((s,p)=>s+p.hand.length,0)
    if (total !== 108) { console.log(`FAIL: ${total} cards in game ${i}`); process.exit(1) }
  }
  totalTurns += turns
  if (g.roundWinner) wins[g.roundWinner] = (wins[g.roundWinner] || 0) + 1
  if (turns >= 3000) { console.log('FAIL: bot game did not terminate'); process.exit(1) }
}
console.log(`bot-vs-bot games : ${games}`)
console.log(`avg turns/round  : ${(totalTurns/games).toFixed(1)}`)
console.log(`stuck states     : ${stuck}`)
console.log(`win spread       : ${JSON.stringify(wins)}`)
console.log(stuck === 0 ? 'bots always make progress — PASSED' : 'FAIL: bots stalled')
process.exit(stuck === 0 ? 0 : 1)

'use strict'

const { COLORS, KIND, parseCard, isWild, canPlay } = require('./cards')
const E = require('./engine')

/* A deliberately modest opponent: it plays well enough to be a real game but
 * never sees another hand — it decides from public information plus its own
 * cards, the same input a human has.
 *
 * Bots are also made fallible on purpose. A bot that always remembers to call
 * UNO is not a fair opponent: a human who forgets even 30% of the time drops
 * from a 50% to a 42% win rate heads-up, and one who never remembers wins 13%.
 * So bots forget at a human-ish rate too. */
const UNO_FORGET_RATE = 0.2
const CATCH_ALERTNESS = 0.5

function chooseColor(hand) {
    const counts = { R: 0, G: 0, B: 0, Y: 0 }
    for (const code of hand) {
        const c = parseCard(code).color
        if (c && counts[c] !== undefined) counts[c]++
    }
    return COLORS.reduce((best, c) => (counts[c] > counts[best] ? c : best), 'R')
}

/** Rank a legal move. Higher is played first. */
function scoreMove(code, { nextPlayerCards, handSize }) {
    const card = parseCard(code)
    const pressure = nextPlayerCards <= 2 // next player is about to go out

    switch (card.kind) {
        case KIND.WILD4: return pressure ? 100 : 10   // hold the +4 unless it hurts
        case KIND.DRAW2: return pressure ? 90 : 55
        case KIND.SKIP: return pressure ? 85 : 50
        case KIND.REVERSE: return pressure ? 80 : 45
        case KIND.WILD: return pressure ? 70 : 15     // keep wilds as escape hatches
        default: return 20 + card.value              // dump high numbers first
    }
}

function chooseMove(game, bot) {
    const top = E.topCard(game)
    const legal = bot.hand.filter(code => canPlay(code, game.currentColor, top))
    if (legal.length === 0) return { action: 'draw' }

    const n = game.players.length
    const nextIdx = (((game.turnIndex + game.direction) % n) + n) % n
    const ctx = {
        nextPlayerCards: game.players[nextIdx] ? game.players[nextIdx].hand.length : 7,
        handSize: bot.hand.length
    }

    let best = legal[0]
    let bestScore = -Infinity
    for (const code of legal) {
        const s = scoreMove(code, ctx)
        if (s > bestScore) { bestScore = s; best = code }
    }
    return {
        action: 'play',
        card: best,
        color: isWild(best) ? chooseColor(bot.hand.filter(c => c !== best)) : undefined
    }
}

/** Run one bot turn. Returns true if the game state changed. */
function takeTurn(game, bot) {
    if (game.status !== 'playing') return false
    if (E.currentPlayer(game).id !== bot.id) return false

    // call UNO before dropping to a single card — but sometimes forget, so a
    // human has something to catch, exactly as bots catch them
    if (bot.hand.length === 2 && Math.random() >= UNO_FORGET_RATE) E.callUno(game, bot.id)

    const move = chooseMove(game, bot)
    if (move.action === 'play') {
        const r = E.playCard(game, bot.id, move.card, move.color)
        if (!r.ok) { E.drawCard(game, bot.id); E.passTurn(game, bot.id) }
        return true
    }

    const r = E.drawCard(game, bot.id)
    if (!r.ok) return false
    // play the drawn card if it happens to be legal, otherwise the turn passed already
    if (r.playable) {
        const color = isWild(r.drawn) ? chooseColor(bot.hand) : undefined
        const played = E.playCard(game, bot.id, r.drawn, color)
        if (!played.ok) E.passTurn(game, bot.id)
    }
    return true
}

/** Bots police forgotten UNO calls too. */
function tryCatchUno(game) {
    for (const bot of game.players.filter(p => p.isBot)) {
        const target = game.players.find(p => p.id !== bot.id && p.hand.length === 1 && !p.saidUno)
        if (target && Math.random() < CATCH_ALERTNESS) {
            E.catchUno(game, bot.id, target.id)
            return true
        }
    }
    return false
}

module.exports = { takeTurn, chooseColor, chooseMove, tryCatchUno }

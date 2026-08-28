'use strict'

/*
 * Card codes match the existing art in client/src/assets/cards-front, so the
 * 54 PNGs keep working unchanged:
 *   number   '0R' .. '9Y'
 *   skip     'skipR' | 'skipG' | 'skipB' | 'skipY'
 *   reverse  '_R'    | '_G'    | '_B'    | '_Y'
 *   draw two 'D2R'   | 'D2G'   | 'D2B'   | 'D2Y'
 *   wild     'W'
 *   wild +4  'D4W'
 */

const COLORS = ['R', 'G', 'B', 'Y']

const KIND = {
    NUMBER: 'number',
    SKIP: 'skip',
    REVERSE: 'reverse',
    DRAW2: 'draw2',
    WILD: 'wild',
    WILD4: 'wild4'
}

function parseCard(code) {
    if (code === 'W') return { code, kind: KIND.WILD, color: null, value: null }
    if (code === 'D4W') return { code, kind: KIND.WILD4, color: null, value: null }
    if (code.startsWith('D2')) return { code, kind: KIND.DRAW2, color: code[2], value: null }
    if (code.startsWith('skip')) return { code, kind: KIND.SKIP, color: code[4], value: null }
    if (code.startsWith('_')) return { code, kind: KIND.REVERSE, color: code[1], value: null }
    return { code, kind: KIND.NUMBER, color: code[1], value: Number(code[0]) }
}

const isWild = code => code === 'W' || code === 'D4W'

/** Standard 108-card deck. Returns a fresh array every call — never a shared one. */
function createDeck() {
    const deck = []
    for (const c of COLORS) {
        deck.push(`0${c}`)
        for (let n = 1; n <= 9; n++) deck.push(`${n}${c}`, `${n}${c}`)
        deck.push(`skip${c}`, `skip${c}`)
        deck.push(`_${c}`, `_${c}`)
        deck.push(`D2${c}`, `D2${c}`)
    }
    for (let i = 0; i < 4; i++) deck.push('W', 'D4W')
    return deck
}

/** Fisher-Yates on a copy. The original mutated a shared module array. */
function shuffle(cards) {
    const out = cards.slice()
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

/** Can `code` legally go on a discard showing `currentColor` / `topCode`? */
function canPlay(code, currentColor, topCode) {
    if (isWild(code)) return true
    const card = parseCard(code)
    if (card.color === currentColor) return true

    const top = parseCard(topCode)
    if (isWild(topCode)) return false // colour already covered above
    if (card.kind === KIND.NUMBER && top.kind === KIND.NUMBER) return card.value === top.value
    return card.kind === top.kind // skip on skip, reverse on reverse, +2 on +2
}

/** Standard UNO scoring: numbers face value, actions 20, wilds 50. */
function cardScore(code) {
    const card = parseCard(code)
    if (card.kind === KIND.NUMBER) return card.value
    if (card.kind === KIND.WILD || card.kind === KIND.WILD4) return 50
    return 20
}

const handScore = hand => hand.reduce((sum, code) => sum + cardScore(code), 0)

module.exports = { COLORS, KIND, parseCard, isWild, createDeck, shuffle, canPlay, cardScore, handScore }

// Card art keyed by the same codes the server uses ('5R', 'skipG', '_B', 'D2Y', 'W', 'D4W').
const art = import.meta.glob('../assets/cards-front/*.png', { eager: true, import: 'default' })

export const cardUrl = code => art[`../assets/cards-front/${code}.png`]

export const COLOR_NAMES = { R: 'Red', G: 'Green', B: 'Blue', Y: 'Yellow' }
export const COLOR_HEX = { R: '#e4402f', G: '#3fa64a', B: '#2f7fe4', Y: '#f0b429' }

export function describeCard(code) {
  if (code === 'W') return 'Wild'
  if (code === 'D4W') return 'Wild Draw Four'
  if (code.startsWith('D2')) return `${COLOR_NAMES[code[2]]} Draw Two`
  if (code.startsWith('skip')) return `${COLOR_NAMES[code[4]]} Skip`
  if (code.startsWith('_')) return `${COLOR_NAMES[code[1]]} Reverse`
  return `${COLOR_NAMES[code[1]]} ${code[0]}`
}

export const isWild = code => code === 'W' || code === 'D4W'

// Mirrors the server's rule so the UI can grey out unplayable cards. The server
// is still the authority — this only avoids offering moves that will be refused.
export function canPlay(code, currentColor, topCode) {
  if (isWild(code)) return true
  if (!topCode) return true
  const color = code === 'W' || code === 'D4W' ? null : code.startsWith('D2') ? code[2] : code.startsWith('skip') ? code[4] : code.startsWith('_') ? code[1] : code[1]
  if (color === currentColor) return true
  if (isWild(topCode)) return false
  const kind = c => (c.startsWith('D2') ? 'D2' : c.startsWith('skip') ? 'skip' : c.startsWith('_') ? 'rev' : 'num')
  if (kind(code) === 'num' && kind(topCode) === 'num') return code[0] === topCode[0]
  return kind(code) === kind(topCode)
}

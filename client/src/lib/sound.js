import uno from '../assets/sounds/uno-sound.mp3'
import shuffle from '../assets/sounds/shuffling-cards-1.mp3'
import skip from '../assets/sounds/skip-sound.mp3'
import draw2 from '../assets/sounds/draw2-sound.mp3'
import wild from '../assets/sounds/wild-sound.mp3'
import draw4 from '../assets/sounds/draw4-sound.mp3'
import gameOver from '../assets/sounds/game-over-sound.mp3'

const files = { uno, shuffle, skip, draw2, wild, draw4, gameOver }
const cache = {}

// Replaces the use-sound/howler dependency with plain Audio elements.
export function play(name, muted) {
  if (muted) return
  try {
    if (!cache[name]) cache[name] = new Audio(files[name])
    const a = cache[name]
    a.currentTime = 0
    a.play().catch(() => {}) // autoplay policies — a blocked sound is not an error
  } catch { /* no audio available */ }
}

export function soundForCard(code) {
  if (code === 'D4W') return 'draw4'
  if (code === 'W') return 'wild'
  if (code.startsWith('D2')) return 'draw2'
  if (code.startsWith('skip') || code.startsWith('_')) return 'skip'
  return 'shuffle'
}

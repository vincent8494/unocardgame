import { useEffect, useRef, useState } from 'react'
import PoweredBy from './PoweredBy'
import Rules from './Rules'
import { cardUrl } from '../lib/cards'
import logo from '../assets/logo.png'
import '../styles/home.css'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 — easier to read aloud
const makeCode = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

// A fan of real card art drifting behind the panel, one per colour plus wilds.
const FLOATERS = ['5R', 'skipG', 'D2B', '7Y', 'W', '_R', '3G', 'D4W', '9B', 'skipY']

export default function Home({ initialRoom, onEnter }) {
  const [name, setName] = useState(() => localStorage.getItem('uno:name') || '')
  const [code, setCode] = useState(initialRoom || '')
  const [error, setError] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [stats, setStats] = useState(null)
  const sceneRef = useRef(null)

  // Something actually live rather than decorative: how busy the server is.
  useEffect(() => {
    let alive = true
    const load = () => fetch('/healthz')
      .then(r => r.json())
      .then(d => { if (alive) setStats(d) })
      .catch(() => {})
    load()
    const id = setInterval(load, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // Parallax — the card field leans away from the cursor.
  useEffect(() => {
    const el = sceneRef.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onMove = e => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      el.style.setProperty('--px', x.toFixed(3))
      el.style.setProperty('--py', y.toFixed(3))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const go = roomCode => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a name so other players can see who you are.'); return }
    localStorage.setItem('uno:name', trimmed)
    onEnter(roomCode, trimmed)
  }

  const join = e => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!clean) { setError('Enter the game code you were given.'); return }
    go(clean)
  }

  return (
    <div className="home">
      <div className="home-sky" aria-hidden="true">
        <span className="blob blob-r" /><span className="blob blob-g" />
        <span className="blob blob-b" /><span className="blob blob-y" />
      </div>

      <div className="home-scene" ref={sceneRef} aria-hidden="true">
        {FLOATERS.map((c, i) => (
          <img key={c} className={`floater f${i}`} src={cardUrl(c)} alt="" style={{ '--i': i }} />
        ))}
      </div>

      <div className="home-panel">
        <div className="home-panel-inner">
          <img className="home-logo" src={logo} alt="UNO" width="150" />
          <p className="home-lead">Play with friends, or fill the table with bots.</p>

          <label className="field">
            <span className="field-label">Your name</span>
            <input
              className="field-input"
              value={name}
              maxLength={16}
              placeholder="e.g. Vincent"
              onChange={e => { setName(e.target.value); setError('') }}
            />
          </label>

          <button className="btn-create" onClick={() => go(makeCode())}>
            <span>Create a game</span>
          </button>

          <div className="home-divider"><span>or join one</span></div>

          <form className="home-join" onSubmit={join}>
            <input
              className="field-input code-input"
              value={code}
              maxLength={6}
              placeholder="GAME CODE"
              aria-label="Game code"
              onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
            />
            <button className="btn-join" type="submit">Join</button>
          </form>

          {error && <p className="home-error" role="alert">{error}</p>}

          <div className="home-meta">
            <button className="btn-rules" onClick={() => setShowRules(true)}>How to play</button>
            {stats && (
              <p className="home-stats" aria-live="polite">
                <span className="live-dot" />
                {stats.activeGames > 0
                  ? `${stats.activeGames} game${stats.activeGames === 1 ? '' : 's'} in progress`
                  : 'Server awake — be the first on'}
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="home-footer">
        <p className="copyright">&copy; 2024 UNO Card Game</p>
        <PoweredBy />
      </footer>

      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </div>
  )
}

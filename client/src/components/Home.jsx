import { useState } from 'react'
import PoweredBy from './PoweredBy'
import Rules from './Rules'
import logo from '../assets/logo.png'
import '../styles/home.css'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 — easier to read aloud
const makeCode = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

export default function Home({ initialRoom, onEnter }) {
  const [name, setName] = useState(() => localStorage.getItem('uno:name') || '')
  const [code, setCode] = useState(initialRoom || '')
  const [error, setError] = useState('')
  const [showRules, setShowRules] = useState(false)

  const go = (roomCode) => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a name so other players can see who you are.'); return }
    localStorage.setItem('uno:name', trimmed)
    onEnter(roomCode, trimmed)
  }

  const join = (e) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!clean) { setError('Enter the game code you were given.'); return }
    go(clean)
  }

  return (
    <div className="home">
      <div className="home-panel card-surface">
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

        <button className="btn btn-primary home-create" onClick={() => go(makeCode())}>
          Create a game
        </button>

        <div className="home-divider"><span>or join one</span></div>

        <form className="home-join" onSubmit={join}>
          <input
            className="field-input"
            value={code}
            maxLength={6}
            placeholder="GAME CODE"
            aria-label="Game code"
            onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
          />
          <button className="btn" type="submit">Join</button>
        </form>

        {error && <p className="home-error" role="alert">{error}</p>}

        <button className="btn btn-ghost home-rules" onClick={() => setShowRules(true)}>
          How to play
        </button>
      </div>

      {showRules && <Rules onClose={() => setShowRules(false)} />}

      <footer className="home-footer">
        <p className="copyright">&copy; 2026 UNO Card Game</p>
        <PoweredBy />
      </footer>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import PoweredBy from './PoweredBy'
import cardBack from '../assets/card-back.png'
import '../styles/splash.css'

const AUTO_DISMISS_SECONDS = 4

export default function Splash({ onDismiss }) {
  const [remaining, setRemaining] = useState(AUTO_DISMISS_SECONDS)
  const dismissed = useRef(false)

  const finish = () => {
    if (dismissed.current) return
    dismissed.current = true
    onDismiss()
  }

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(id); finish(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="splash">
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-cards" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => (
          <img key={i} src={cardBack} alt="" className={`splash-card splash-card-${i}`} />
        ))}
      </div>

      <div className="splash-credit">
        Made by <span className="pulse">@marugevincent</span>
      </div>

      <main className="splash-content">
        <h1 className="splash-title">
          <span className="splash-title-uno">UNO</span>
          <span className="splash-title-sub">Card Game</span>
        </h1>
        <p className="splash-tagline">Play the classic — with friends or against bots.</p>

        <button className="btn splash-enter" onClick={finish} autoFocus>
          Enter Game
        </button>
        <p className="splash-countdown" aria-live="polite">
          Starting in {remaining}s
        </p>
      </main>

      <footer className="splash-footer">
        <PoweredBy />
      </footer>
    </div>
  )
}

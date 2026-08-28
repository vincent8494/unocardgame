import { cardUrl, describeCard } from '../lib/cards'
import cardBack from '../assets/card-back.png'

export function CardBack({ className = '', style }) {
  return <img className={`card card-back ${className}`} src={cardBack} alt="" style={style} aria-hidden="true" />
}

export default function Card({ code, playable, disabled, onClick, className = '', style }) {
  const label = describeCard(code)
  if (!onClick) {
    return <img className={`card ${className}`} src={cardUrl(code)} alt={label} style={style} />
  }
  return (
    <button
      type="button"
      className={`card-button ${playable ? 'is-playable' : ''} ${className}`}
      style={style}
      onClick={onClick}
      disabled={disabled}
      title={playable ? `Play ${label}` : label}
      aria-label={playable ? `Play ${label}` : `${label} (cannot be played)`}
    >
      <img className="card" src={cardUrl(code)} alt="" />
    </button>
  )
}

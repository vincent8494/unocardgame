import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket, closeSocket } from '../lib/socket'
import { canPlay, isWild, COLOR_HEX, COLOR_NAMES, describeCard } from '../lib/cards'
import { play as playSound, soundForCard } from '../lib/sound'
import Card, { CardBack } from './Card'
import Chat from './Chat'
import PoweredBy from './PoweredBy'
import Rules from './Rules'
import '../styles/game.css'

const COLORS = ['R', 'G', 'B', 'Y']

export default function Game({ roomCode, name, onLeave }) {
  const [state, setState] = useState(null)
  const [messages, setMessages] = useState([])
  const [toast, setToast] = useState('')
  const [wildFor, setWildFor] = useState(null)   // card awaiting a colour choice
  const [chatOpen, setChatOpen] = useState(false)
  const [muted, setMuted] = useState(() => localStorage.getItem('uno:muted') === '1')
  const [fatal, setFatal] = useState('')
  const [copied, setCopied] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const socketRef = useRef(null)
  const lastTop = useRef(null)

  /* ---- connection ------------------------------------------------------ */
  useEffect(() => {
    const socket = getSocket()
    socketRef.current = socket

    const onState = next => setState(next)
    const onMessage = m => setMessages(prev => [...prev, m])
    const onActionError = ({ error }) => setToast(error)
    const onDisconnect = () => setToast('Connection lost — reconnecting…')

    socket.on('gameState', onState)
    socket.on('message', onMessage)
    socket.on('actionError', onActionError)
    socket.on('disconnect', onDisconnect)

    const doJoin = () => {
      socket.emit('join', { roomCode, name }, reply => {
        if (!reply || reply.error) setFatal((reply && reply.error) || 'Could not join the room.')
      })
    }
    if (socket.connected) doJoin()
    socket.on('connect', doJoin)

    return () => {
      socket.off('gameState', onState)
      socket.off('message', onMessage)
      socket.off('actionError', onActionError)
      socket.off('disconnect', onDisconnect)
      socket.off('connect', doJoin)
      closeSocket()
    }
  }, [roomCode, name])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => { localStorage.setItem('uno:muted', muted ? '1' : '0') }, [muted])

  // sound follows whatever card just landed on the discard
  useEffect(() => {
    if (!state || !state.topCard) return
    if (lastTop.current && lastTop.current !== state.topCard) {
      playSound(soundForCard(state.topCard), muted)
    }
    lastTop.current = state.topCard
  }, [state && state.topCard, muted])

  const emit = useCallback((event, payload) => {
    if (socketRef.current) socketRef.current.emit(event, payload)
  }, [])

  /* ---- actions --------------------------------------------------------- */
  const playCard = code => {
    if (isWild(code)) { setWildFor(code); return }
    emit('playCard', { card: code })
  }

  const chooseColor = color => {
    emit('playCard', { card: wildFor, color })
    setWildFor(null)
  }

  const shareLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setToast(url)
    }
  }

  /* ---- render ---------------------------------------------------------- */
  if (fatal) {
    return (
      <div className="game-message">
        <div className="card-surface game-message-panel">
          <h2>Can’t join room {roomCode}</h2>
          <p>{fatal}</p>
          <button className="btn btn-primary" onClick={onLeave}>Back to menu</button>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="game-message">
        <div className="card-surface game-message-panel">
          <div className="spinner" aria-hidden="true" />
          <h2>Connecting…</h2>
          <p className="text-dim">Waking the server can take a few seconds on the free tier.</p>
        </div>
      </div>
    )
  }

  const me = state.you
  const myTurn = state.turnPlayerId === me?.id
  const opponents = state.players.filter(p => p.id !== me?.id)
  const inPlay = state.status === 'playing'
  const canStart = state.status === 'lobby' && state.players.length >= 2

  return (
    <div className="game">
      <header className="game-bar">
        <button className="btn btn-ghost game-leave" onClick={onLeave}>← Menu</button>
        <button className="room-chip" onClick={shareLink} title="Copy invite link">
          Room <strong>{state.roomCode}</strong>
          <span className="room-chip-hint">{copied ? 'link copied' : 'copy link'}</span>
        </button>
        <div className="game-bar-right">
          <button className="btn btn-ghost game-icon" onClick={() => setShowRules(true)} aria-label="How to play">?</button>
          <button className="btn btn-ghost game-icon" onClick={() => setMuted(m => !m)} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {/* ---- opponents ---- */}
      <section className="opponents" aria-label="Other players">
        {opponents.map(p => (
          <article key={p.id} className={`seat ${state.turnPlayerId === p.id ? 'is-turn' : ''}`}>
            <div className="seat-head">
              <span className="seat-name">{p.name}{p.isBot && <span className="seat-tag">bot</span>}</span>
              <span className="seat-score">{p.score}</span>
            </div>
            <div className="seat-cards" aria-label={`${p.cardCount} cards`}>
              {Array.from({ length: Math.min(p.cardCount, 8) }).map((_, i) => (
                <CardBack key={i} className="seat-card" style={{ '--i': i }} />
              ))}
              <span className="seat-count">{p.cardCount}</span>
            </div>
            {inPlay && p.cardCount === 1 && !p.saidUno && (
              <button className="btn catch-btn" onClick={() => emit('catchUno', { targetId: p.id })}>
                Catch — no UNO!
              </button>
            )}
          </article>
        ))}
        {opponents.length === 0 && (
          <p className="seat-empty">Waiting for players. Share the room code or add a bot.</p>
        )}
      </section>

      {/* ---- table ---- */}
      <section className="table">
        {inPlay ? (
          <>
            <div className="pile draw-pile">
              <button
                className="pile-button"
                onClick={() => emit('drawCard')}
                disabled={!myTurn}
                title={myTurn ? 'Draw a card' : 'Not your turn'}
              >
                <CardBack />
              </button>
              <span className="pile-label">Draw · {state.drawPileCount}</span>
            </div>

            <div className="pile discard-pile">
              {state.topCard && <Card code={state.topCard} className="discard-top" />}
              <span className="pile-label">{describeCard(state.topCard || '')}</span>
            </div>

            <div className="table-status">
              <span
                className="color-dot"
                style={{ background: COLOR_HEX[state.currentColor] }}
                title={COLOR_NAMES[state.currentColor]}
              />
              <span className="turn-text">
                {myTurn ? 'Your turn' : `${state.players.find(p => p.id === state.turnPlayerId)?.name ?? '—'}'s turn`}
              </span>
              <span className="direction" title={state.direction === 1 ? 'Clockwise' : 'Anticlockwise'}>
                {state.direction === 1 ? '↻' : '↺'}
              </span>
            </div>
          </>
        ) : (
          <div className="lobby card-surface">
            <h2>{state.status === 'lobby' ? 'Waiting to start' : 'Round finished'}</h2>
            <p className="text-dim">
              {state.players.length} of 4 players · first to {state.targetScore} points wins
            </p>
            <div className="lobby-actions">
              {state.players.length < 4 && (
                <button className="btn" onClick={() => emit('addBot')}>Add a bot</button>
              )}
              {state.status === 'lobby' && (
                <button className="btn btn-primary" disabled={!canStart} onClick={() => emit('startGame')}>
                  {canStart ? 'Start game' : 'Need 2 players'}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ---- your hand ---- */}
      <section className="hand-area">
        <div className="hand-bar">
          <span className="hand-you">
            {me?.name} · <strong>{me?.score ?? 0}</strong> pts
          </span>
          <button
            className={`btn uno-btn ${me && me.hand.length <= 2 ? 'is-live' : ''}`}
            disabled={!me || me.hand.length > 2}
            onClick={() => { emit('callUno'); playSound('uno', muted) }}
          >
            UNO!
          </button>
        </div>
        <div className="hand" role="list">
          {me?.hand.map((code, i) => {
            const playable = inPlay && myTurn && canPlay(code, state.currentColor, state.topCard)
            return (
              <div className="hand-slot" role="listitem" key={`${code}-${i}`} style={{ '--i': i }}>
                <Card
                  code={code}
                  playable={playable}
                  disabled={!playable}
                  onClick={() => playCard(code)}
                />
              </div>
            )
          })}
          {inPlay && me?.hand.length === 0 && <p className="text-dim">No cards.</p>}
        </div>
        {inPlay && myTurn && (
          <button className="btn btn-ghost pass-btn" onClick={() => emit('passTurn')}>
            Pass turn
          </button>
        )}
      </section>

      <Chat
        messages={messages}
        open={chatOpen}
        onToggle={() => setChatOpen(o => !o)}
        onSend={text => emit('sendMessage', { message: text })}
      />

      <footer className="game-footer"><PoweredBy /></footer>

      {/* ---- overlays ---- */}
      {wildFor && (
        <div className="overlay" role="dialog" aria-label="Choose a colour">
          <div className="card-surface overlay-panel">
            <h2>Pick a colour</h2>
            <div className="color-grid">
              {COLORS.map(c => (
                <button
                  key={c}
                  className="color-choice"
                  style={{ background: COLOR_HEX[c] }}
                  onClick={() => chooseColor(c)}
                >
                  {COLOR_NAMES[c]}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={() => setWildFor(null)}>Cancel</button>
          </div>
        </div>
      )}

      {(state.status === 'roundOver' || state.status === 'gameOver') && (
        <div className="overlay" role="dialog" aria-label="Round result">
          <div className="card-surface overlay-panel">
            <h2>
              {state.status === 'gameOver'
                ? `${state.players.find(p => p.id === state.winner)?.name ?? 'Someone'} wins!`
                : `${state.players.find(p => p.id === state.roundWinner)?.name ?? 'Someone'} took the round`}
            </h2>
            <ul className="scoreboard">
              {[...state.players].sort((a, b) => b.score - a.score).map(p => (
                <li key={p.id}>
                  <span>{p.name}{p.isBot && <span className="seat-tag">bot</span>}</span>
                  <strong>{p.score}</strong>
                </li>
              ))}
            </ul>
            <div className="lobby-actions">
              {state.status === 'roundOver'
                ? <button className="btn btn-primary" onClick={() => emit('nextRound')}>Next round</button>
                : <button className="btn btn-primary" onClick={() => emit('newGame')}>Play again</button>}
              <button className="btn btn-ghost" onClick={onLeave}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {showRules && <Rules onClose={() => setShowRules(false)} />}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

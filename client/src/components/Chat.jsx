import { useEffect, useRef, useState } from 'react'

export default function Chat({ messages, onSend, open, onToggle }) {
  const [draft, setDraft] = useState('')
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, open])

  const submit = e => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <div className={`chat ${open ? 'is-open' : ''}`}>
      <button className="chat-toggle" onClick={onToggle} aria-expanded={open}>
        Chat {messages.length > 0 && <span className="chat-badge">{messages.length}</span>}
      </button>
      {open && (
        <div className="chat-panel">
          <div className="chat-body" ref={bodyRef}>
            {messages.length === 0 && <p className="chat-empty">No messages yet.</p>}
            {messages.map((m, i) => (
              <p key={i} className="chat-line">
                <strong>{m.user}</strong> {m.text}
              </p>
            ))}
          </div>
          <form className="chat-form" onSubmit={submit}>
            <input
              className="field-input"
              value={draft}
              maxLength={200}
              placeholder="Say something…"
              aria-label="Chat message"
              onChange={e => setDraft(e.target.value)}
            />
            <button className="btn" type="submit">Send</button>
          </form>
        </div>
      )}
    </div>
  )
}

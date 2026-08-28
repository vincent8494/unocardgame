import { useCallback, useEffect, useState } from 'react'
import Splash from './components/Splash'
import Home from './components/Home'
import Game from './components/Game'

const SPLASH_KEY = 'uno:splash-seen'

function readRoomFromUrl() {
  const params = new URLSearchParams(window.location.search)
  const code = (params.get('room') || '').trim().toUpperCase()
  return code || null
}

export default function App() {
  // The old splash sat for 30s on every visit. Show it once per tab session,
  // and let a shared ?room= link skip it entirely.
  const deepLinked = readRoomFromUrl()
  const [showSplash, setShowSplash] = useState(() => !deepLinked && !sessionStorage.getItem(SPLASH_KEY))
  const [session, setSession] = useState(null) // { roomCode, name }

  const dismissSplash = useCallback(() => {
    sessionStorage.setItem(SPLASH_KEY, '1')
    setShowSplash(false)
  }, [])

  const enterGame = useCallback((roomCode, name) => {
    const url = new URL(window.location.href)
    url.searchParams.set('room', roomCode)
    window.history.replaceState({}, '', url)
    setSession({ roomCode, name })
  }, [])

  const leaveGame = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    window.history.replaceState({}, '', url)
    setSession(null)
  }, [])

  useEffect(() => {
    document.title = session ? `UNO — room ${session.roomCode}` : 'UNO Card Game'
  }, [session])

  if (showSplash) return <Splash onDismiss={dismissSplash} />
  if (session) return <Game roomCode={session.roomCode} name={session.name} onLeave={leaveGame} />
  return <Home initialRoom={deepLinked} onEnter={enterGame} />
}

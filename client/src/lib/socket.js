import { io } from 'socket.io-client'

// In dev, Vite proxies /socket.io to localhost:5000 (see vite.config.js), so a
// relative connection works in both dev and production. No hardcoded host.
const ENDPOINT = import.meta.env.VITE_SERVER_URL || undefined

let socket

export function getSocket() {
  if (!socket) {
    socket = io(ENDPOINT, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      timeout: 12000
    })
  }
  return socket
}

export function closeSocket() {
  if (socket) {
    socket.close()
    socket = undefined
  }
}

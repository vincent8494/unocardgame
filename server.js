'use strict'

const express = require('express')
const http = require('http')
const cors = require('cors')
const path = require('path')
const { Server } = require('socket.io')

const E = require('./game/engine')
const bot = require('./game/bot')

const PORT = process.env.PORT || 5000
const BOT_THINK_MS = 900
// Bots used to catch a missed UNO in the same tick as the play, leaving a human
// no chance to react. This is the window in which a human can call UNO late to
// save themselves, or catch a bot that forgot, before the bots pounce.
const CATCH_GRACE_MS = 2500

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } })

app.use(cors())

// Keep-alive probe for the external pinger. Declared before the production
// catch-all below, which would otherwise answer this with index.html.
app.get('/healthz', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        rooms: rooms.size,
        timestamp: new Date().toISOString()
    })
})

/* ---- rooms ------------------------------------------------------------- */

const rooms = new Map()        // roomCode -> game
const botTimers = new Map()    // roomCode -> timeout
const catchTimers = new Map()  // roomCode -> timeout

function getRoom(code) {
    if (!rooms.has(code)) rooms.set(code, E.createGame(code))
    return rooms.get(code)
}

function disposeRoom(code) {
    clearTimeout(botTimers.get(code))
    clearTimeout(catchTimers.get(code))
    botTimers.delete(code)
    catchTimers.delete(code)
    rooms.delete(code)
}

/** Let the bots police a missed UNO, but only after a human could have acted. */
function scheduleCatch(game) {
    clearTimeout(catchTimers.get(game.roomCode))
    if (!game.players.some(p => p.isBot)) return
    const timer = setTimeout(() => {
        if (!rooms.has(game.roomCode)) return
        if (bot.tryCatchUno(game)) broadcast(game)
    }, CATCH_GRACE_MS)
    catchTimers.set(game.roomCode, timer)
}

/** Every player gets their own view — hands are never broadcast wholesale. */
function broadcast(game) {
    for (const p of game.players) {
        if (p.isBot) continue
        io.to(p.id).emit('gameState', E.viewFor(game, p.id))
    }
}

/** Drive bot turns one at a time, with a pause so play is followable. */
function scheduleBots(game) {
    clearTimeout(botTimers.get(game.roomCode))
    if (game.status !== 'playing') return
    const active = E.currentPlayer(game)
    if (!active || !active.isBot) return

    const timer = setTimeout(() => {
        if (!rooms.has(game.roomCode)) return
        if (game.status === 'playing' && E.currentPlayer(game) && E.currentPlayer(game).isBot) {
            bot.takeTurn(game, E.currentPlayer(game))
            broadcast(game)
            scheduleCatch(game)
            scheduleBots(game)
        }
    }, BOT_THINK_MS)
    botTimers.set(game.roomCode, timer)
}

/** Wrap an action so every handler broadcasts and re-arms the bots identically. */
function apply(socket, game, result) {
    if (!result.ok) {
        socket.emit('actionError', { error: result.error })
        return false
    }
    broadcast(game)
    scheduleBots(game)
    return true
}

/* ---- sockets ----------------------------------------------------------- */

io.on('connection', socket => {
    let joinedRoom = null

    socket.on('join', ({ roomCode, name }, callback = () => {}) => {
        const code = String(roomCode || '').trim().toUpperCase()
        if (!code) return callback({ error: 'Missing room code' })

        const game = getRoom(code)
        const displayName = String(name || '').trim().slice(0, 16) || `Player ${game.players.length + 1}`

        const res = E.addPlayer(game, { id: socket.id, name: displayName })
        if (!res.ok) {
            if (game.players.length === 0) disposeRoom(code)
            return callback({ error: res.error })
        }

        joinedRoom = code
        socket.join(code)
        callback({ ok: true, playerId: socket.id })
        broadcast(game)
    })

    socket.on('addBot', () => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        const botNumber = game.players.filter(p => p.isBot).length + 1
        apply(socket, game, E.addPlayer(game, {
            id: `bot:${joinedRoom}:${Date.now()}:${botNumber}`,
            name: `Bot ${botNumber}`,
            isBot: true
        }))
    })

    socket.on('startGame', () => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        apply(socket, game, E.startRound(game))
    })

    socket.on('playCard', ({ card, color }) => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        if (apply(socket, game, E.playCard(game, socket.id, card, color))) scheduleCatch(game)
    })

    socket.on('drawCard', () => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        apply(socket, game, E.drawCard(game, socket.id))
    })

    socket.on('passTurn', () => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        apply(socket, game, E.passTurn(game, socket.id))
    })

    socket.on('callUno', () => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        apply(socket, game, E.callUno(game, socket.id))
    })

    socket.on('catchUno', ({ targetId }) => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        apply(socket, game, E.catchUno(game, socket.id, targetId))
    })

    socket.on('nextRound', () => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        apply(socket, game, E.nextRound(game))
    })

    socket.on('newGame', () => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        apply(socket, game, E.resetGame(game))
    })

    socket.on('sendMessage', ({ message }, callback = () => {}) => {
        const game = rooms.get(joinedRoom)
        if (!game) return callback()
        const me = E.findPlayer(game, socket.id)
        const text = String(message || '').trim().slice(0, 200)
        if (!me || !text) return callback()
        io.to(joinedRoom).emit('message', { user: me.name, text, at: Date.now() })
        callback()
    })

    socket.on('disconnect', () => {
        const game = rooms.get(joinedRoom)
        if (!game) return
        E.removePlayer(game, socket.id)
        if (game.players.every(p => p.isBot)) {
            disposeRoom(joinedRoom)
            return
        }
        broadcast(game)
        scheduleBots(game)
    })
})

/* ---- static assets in production --------------------------------------- */

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client', 'build')))
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'))
    })
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

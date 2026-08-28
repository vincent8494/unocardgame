# UNO Card Game

Online multiplayer UNO for 2–4 players, with bots to fill empty seats.
Live at **https://unocardgame-mt9d.onrender.com**

Built by Margravon. Originally forked from `mizanxali/uno-online`; the game
engine and client have since been rewritten.

---

## Stack

| | |
|---|---|
| Server | Node + Express + Socket.IO 4 |
| Client | React 18 + Vite 5 |
| Host | Render (free tier) |

## Running locally

```bash
npm run install-all     # installs server and client deps
npm start               # server on :5000
npm run client          # client on :3000 (proxies sockets to :5000)
```

Open http://localhost:3000. For a production check:

```bash
npm run build
NODE_ENV=production npm start   # serves the built client from :5000
```

## Tests

```bash
npm test
```

Covers the rule engine and the bots: 300 randomised games across 2–4 players
asserting the deck always totals 108 cards and no hand ever holds an undefined
card, 200 bot-vs-bot games asserting the bots always make progress, plus
regression tests for each bug fixed in the rewrite.

```bash
node test/integration.test.js
```

Boots the real server, connects real socket clients and plays a round through
to a rematch — also asserting no client is ever sent another player's hand.

---

## Architecture

The rules live entirely on the server. Clients send *intent* (`playCard`,
`drawCard`, `callUno`) and receive a view of the state; they never compute
rules and are never trusted.

```
game/cards.js    deck construction, card parsing, legality, scoring
game/engine.js   the state machine — turns, actions, UNO, scoring, rounds
game/bot.js      bot decision making
server.js        socket transport, rooms, bot scheduling
```

`engine.viewFor(game, playerId)` is the only thing sent to a client. Other
players appear as a card *count*, never a hand, so a player cannot read
opponents' cards out of the network tab — which the previous version allowed,
since it broadcast the whole state to everyone.

## Gameplay

- 2–4 players per room; empty seats can be filled with bots
- Standard action cards; reverse acts as a skip in a two-player game
- Call **UNO!** on your way down to one card, or any opponent (bots included)
  can catch you for a 2-card penalty
- Rounds score to 500 — number cards face value, actions 20, wilds 50
- Draw pile reshuffles from the discards when it runs out

## Fairness

Bots get no information a human doesn't: they see card counts, never hands.
Three things were deliberately balanced, and `npm run test:fairness` asserts
they stay that way.

**The lead rotates.** Whoever starts is worth 1–2 points of win rate, so the
starting seat moves round by round instead of always sitting with whoever
created the room.

**Bots forget to call UNO.** They used to call it every single time while a
human had to remember a button. Measured over 4000 matches, that cost a human
who forgets 30% of the time about 8 points of win rate heads-up, and a human
who never remembers won 13% instead of 50% — 0% in a four-player game. Bots now
forget at a human-ish 20%, so there is something to catch them on.

**Bots hesitate before catching.** They used to catch a missed UNO in the same
tick as the play, so a human never had a chance to react. There is now a 2.5s
window in which you can call UNO late to save yourself, or catch a bot that
forgot, before the bots act.

With those in place, a player using the same strategy and the same alertness as
a bot wins its fair share: ~50% heads-up and ~25% in a four-player game. What
is left is attention and card play — which is the point.

---

## Keeping the site awake

Render's free web services sleep after roughly 15 minutes without traffic, and
the next visitor then waits through a cold start. The app exposes a probe for an
external pinger:

```
GET /healthz  →  {"status":"ok","uptime":123.4,"rooms":2,"timestamp":"..."}
```

### UptimeRobot (recommended)

1. Sign up at <https://uptimerobot.com> (free plan).
2. **+ New monitor**
   - Monitor type: **HTTP(s)**
   - Friendly name: `UNO card game`
   - URL: `https://unocardgame-mt9d.onrender.com/healthz`
   - Monitoring interval: **5 minutes**
3. Create the monitor. You also get email alerts when the site is genuinely down.

### cron-job.org (alternative)

1. Sign up at <https://cron-job.org>.
2. **Create cronjob** → URL `https://unocardgame-mt9d.onrender.com/healthz`
3. Schedule: every 10 minutes. Under *Advanced*, raise the request timeout to
   ~60s so a cold start is not recorded as a failure.

### Before you rely on this

Keeping the service awake around the clock consumes roughly 730 instance-hours
a month, against a free allowance of 750 hours **shared across the account**.
That fits for this one service and essentially nothing else — a second always-on
free service will exhaust the allowance and both will be suspended for the rest
of the month. Check the current limits and your usage on the Render dashboard
before enabling the monitor, since these numbers do change.

If the cold start is acceptable, not pinging at all is the cheaper option.

---

## Deployment

`render.yaml` describes the service. Render runs `npm install && npm run build`
(which builds the client into `client/build`) and starts it with `npm start`;
`NODE_ENV=production` makes the server serve that build. `/healthz` is set as
the health check path.

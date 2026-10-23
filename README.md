# Skull King · Decadence Arcade

Mobile-first multiplayer card game with private word-code rooms, authoritative rules, bots, reconnect tokens, scores and PWA shell caching.

## Run

Node 22 or newer:

```sh
npm ci
npm start
```

Open http://localhost:3001. `PORT` overrides the listen port. Everyone joins the same server; for phones on your network, use the computer's reachable LAN address rather than localhost.

## Render

Create a Blueprint from this repository's `render.yaml`, or a Node web service with build `npm ci && npm run check`, start `npm start`, health path `/healthz`.

The Blueprint uses the **Free** web-service plan, with no paid disk or database. Verify Free is selected and the estimate is $0 before deployment. Use one instance: room coordination is in process and is not distributed across replicas. Do not expose or commit `.data`, tokens, or environment secrets.

Render Free sleeps after 15 minutes without inbound traffic, may take about a minute to wake, and loses local room snapshots on spin-down, restart or redeploy. Reconnection can reclaim a seat while that room still exists; it cannot recover a room erased by a platform restart. Long-term restart recovery is not provided by this free configuration. Free usage allowances still apply. See https://render.com/docs/free .

The same Render service serves the frontend and `/socket`. HTTPS uses secure WebSockets automatically. If the frontend is separately hosted, set `websocketUrl` in `config.js` to the Render service's `wss://…/socket` address before publishing. Static URLs are relative and work below a repository path. This repository does not provision a decadenceinc.com route or Render service by itself.

## Rules choices

Ten rounds; when a deck cannot support the round number at the current seat count, repeat its maximum deal. Host chooses base or full expansion. Base includes the named pirate powers. Two-seat games use actual seated hands rather than the physical ghost-hand variant.

User-selected rules: a sea creature preserves an established lead suit; First Mate uses captured powers in play order; Mary privately reveals a target hand and forces the selected card next trick, with her power unavailable throughout round 10. A Plank that removes the leading pirate does not establish a suit retroactively; surviving black trump, otherwise highest number, wins if only numbers remain. These choices should be communicated when teaching players familiar with different printings.

## Release verification

Run `npm test` for engine/room tests. Run `node scripts/live-smoke.mjs` against a running local service for the real WebSocket match/reconnect smoke test. Local checks do not prove Render deployment, real-phone installation, background alerts or performance. Verify create/join/play/reconnect and a full match against the deployed URL before declaring it live. Phone vibration and background sound depend on browser support and system settings.

## Repository layout

This folder is the deployable repository root. `package.json`, `package-lock.json`, `server.mjs`, `index.html` and `render.yaml` belong together here. In Render, leave Root Directory blank. Do not create a nested game folder.

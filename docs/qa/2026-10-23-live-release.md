# Live package verification · 2026-10-23

Production source: game/. User will push this folder to Strategamma/Skull-King. Git repository and local commit exist; HTTPS push failed because CLI authentication was unavailable. No hosted release is claimed.

## Automated evidence

51 tests pass: pure rules/scoring/legal moves, bot policy, complete ten-round engine simulations across 2–10 seats, powers and creature interactions, Plank ordering, Mary privacy/forced play, First Mate order, Last Volley extra/skipped turn, round-10 completion, private snapshots, room ready/start/host gates, secret tokens, disconnect/reclaim, restart persistence and stale-action rejection. Runtime syntax checks pass.

Real WebSocket smoke at localhost:3001 completed ten rounds with two independent clients (204 actions), including reconnect with the same seat. Tokens did not appear in public state. The smoke is paced below production rate limits. The unpaced version correctly triggered the message limit and was adjusted rather than bypassing it.

## Browser evidence

Actual server: created a private word-code room, selected expansion, added a bot, readied/started, locked a bid, inspected/played a card and reached scored trick review. No console errors.

Visual fixtures (outside game/; not shipped) isolate the user-reported states against the actual production client: Mary choices use green/purple suit faces, Tigress exposes ESCAPE / SURRENDER in the public card and enlarged explanation, Volley pair sits on one row with both cards and the seat inside the table at 390×703. Winner screen explicitly declares the winner and contains the ledger directly below. Round-history expansion contains a table. No page overflow or console errors in those fixture checks.

Regression: Volley + Escape beats Locker in either lead order, because Volley and Locker cannot win. Engine result supplies that explanation. Final round goes immediately to finished after final card powers; Harry's final bid choice completes before scores are awarded. A second continue cannot score again.

## Boundaries

Not verified: deployed Render service, decadenceinc.com routing, cross-device/physical phone play, installed PWA lifecycle/offline updates, background audio/haptics, or all publisher edge cases independently against printings. The README records the Mary/sea-suit/Plank interpretations and simplified two-seat variant. Persistent Render disk is required for restart recovery; use one service instance.

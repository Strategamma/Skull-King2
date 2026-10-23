# Goal
Build a complete, polished Skull King PWA for Decadence Arcade.

## Scope
2–10 private seats, base/full expansion, all abilities, bots/recovery, score history, mobile gestures, original dimensional art and victory effects.

## Approach
1. Verify current official rulebooks; specify timing, legal moves, scoring and interaction cases.
2. Create a wordmark/card/table visual target for review, then produce separate coherent card assets.
3. Implement and test a pure rules engine, authoritative room service, private snapshots and durable recovery.
4. Build mobile screens, contextual teaching, swipe controls, distinct ability animations and celebrations.
5. Integrate PWA, Render configuration and full multiplayer verification.

## Risks
Publisher printables include an older edition; do not treat that PDF as the current base rules. First Mate, forced plays, Last Volley and creature interactions require explicit timing tests. Ten seats constrain both deck capacity and narrow-screen readability. Generated mockups do not establish working UI or actual 3D models.

## Verification
Rules unit tests and full-match simulations; private-state/network lifecycle integration tests; browser QA at 320px/390px and desktop, gesture checks, PWA checks. Real phones, deployed Render and service-restart checks remain separate release gates.

## Current evidence
Opening/setup/oval ten-seat preview implemented, with shared center cards, complete special-card art/catalog, play validator and bonus ledger. Syntax and 11 targeted rules/scoring tests pass. In-app browser verified illegal Yellow 14 swipe preserves the hand, legal Black 9 moves once and locks the turn, all 19 guide images load, and bonus breakdown is readable. Standalone Playwright runner could not launch its missing Chromium binary. Preview at localhost:3000 (`PORT=3000 npm run dev`). Full trick/power execution, multiplayer, durable recovery, PWA and device/release checks remain pending.

Responsive refinement: fill the viewport, enlarge public cards, calculate 2–10 seat positions, and offer enlarged card inspection. Risk: ten-seat readability at 320px; verify no page overflow or hand clipping. Layout unit test covers all counts; browser checks cover 2/4/6/10 seats, 320×568 and 390×844.

Current UI refinement: replace detached plays with grouped player/card place settings. Scope: ownership clarity, upright card faces, mirrored sides, quiet waiting slots and leader outline; hide preview selectors behind gear. Verify compact ten-seat/ten-card fit, small-table bounds, and legal play inserting into the owner's panel. No multiplayer or rule scope change.

## Ability screen review
Goal/scope: prepare every base/advanced/expansion special screen and numbered bonus/mode variants. Approach: reuse card artwork and rules metadata; isolated interactive sample decisions behind ? and settings. Risks: previews are not authoritative effect execution; hidden-state and eligibility need server integration. Verification: all 24 screens opened in-browser; Mary two-step selection, Bendt exact-two discards and First Mate queue checked; 18 tests and syntax checks pass.

## Bug playtest
Goal: exercise current local preview. Scope: opening/setup, illegal/legal plays, bid privacy/reveal, standings, abilities, settings, mobile/desktop and keyboard. Approach: isolated in-app browser, reproduce before changing; targeted fixes and regression checks. Risks: no full-match/network runtime exists; browser testing cannot prove installed-device behavior. Verification: syntax/unit checks, responsive screenshots and affected interaction reruns.

## Game feel and bots
Goal: make turn changes unmistakable and interactions rewarding. Scope: event-driven avatar highlighting, optional turn chime/haptics, bid/card/result/ability feedback, and a legal-move bot policy using only its own hand and public plays. Approach: reuse WebAudio/DOM, add testable alert deduplication and bot helpers, expose sample bot and turn transitions in settings. Risks: mobile browsers restrict background audio and vibration; no live multiplayer controller exists. Verification: unit tests for legality/strategy/alerts, syntax checks, browser transitions and responsive screenshots; physical phone alert verification remains required.

## Live package and screenshot fixes
Goal: replace previews with working systems and create runtime-only game/ repository. Implemented authoritative engine, ws rooms, private snapshots, powers/bots/recovery, actual client flows, PWA caching, persisted state and Render blueprint. Screenshot fixes: public Tigress role, suit-colored power choices, contained horizontal Volley pair, immediate final winner plus ledger, tabular round history. Verified 51 tests, runtime syntax, actual 204-action WebSocket match with reconnect, live browser flow and isolated screenshot states. User will push prepared game/ repository; no GitHub upload or hosted deployment claimed.

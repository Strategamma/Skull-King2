# Goal
Resolve the 20 findings in `docs/qa/2026-10-23-ux-audit.md`: make every turn, choice and outcome understandable and operable on a phone, with reliable keyboard access and restrained event-driven feedback.

# Scope
Keep the existing DOM/CSS client, authoritative Node/ws service, rules, artwork and approved pirate identity. Cover lobby/join, bidding, inspection/play, all powers, trick/round/final results, library, settings and recovery notices. No dependencies, rule changes or deployment. Add server presentation metadata only where the client cannot safely infer public events. Preserve private hands and sealed bids.

# Approach
Implement in five reviewable phases; verify each before proceeding.

1. **Reliable interaction** — findings 1, 2, 6, 12, 17.
   - Track pending actions; recover enabled controls on rejection/disconnection without automatically replaying gameplay actions. Refresh authoritative state when necessary; preserve selections only while still valid.
   - Preserve focus by stable control/card identity across renders. Move focus deliberately on phase changes, inspection open/close and decision steps; announce concise turn/error changes without repeated snapshot announcements.
   - Keep bidding cards bright and inspectable. Separate inspection availability from play legality; show the actual restriction, including Mary-forced play.
   - Validate five-letter join codes, support Enter and show create/join pending feedback.
   - Gate: stale/rejected actions remain retryable; keyboard-only bidding/inspection/play works; no duplicate submissions or illegal plays.

2. **Clear turns and power choices** — findings 3, 4, 5, 14.
   - Add compact lead-suit/current-winner guidance, local won/bid progress and players still to act. Handle no established suit, destroyed tricks and Volley explicitly.
   - Structure card help into Role / Timing / Effect / Bonus; use explicit choice labels.
   - Give power steps stable identity and source-card context. First Mate identifies each inherited power; Bendt identifies discard progress.
   - Use select → consequence preview → Confirm for discards, wagers, target/forced-card choices and bid changes; leave simple informational Continue immediate. Validate confirmation against the current decision.
   - Gate: exercise every power, consecutive same-kind steps, decline paths and final-trick exceptions. Another player's view never reveals private choices or cards.

3. **Readable results and scoring** — findings 7, 8, 9, 20.
   - Replace the obstructive trick panel with a compact result tray; keep the winning play and owner visible and let players expand the explanation.
   - Put the local won/bid, exact/missed status, bid points, bonus, round delta and new total directly on round results.
   - Keep semantic score tables; add a sticky player column and visible overflow cue, with accessible per-player bonus details.
   - Use shared ranks for ties across seats, podium and final results; preserve the existing final celebration.
   - Gate: normal/destroyed tricks, positive/negative/zero-bid scoring, ties and long names read correctly at narrow widths. Scores match authoritative results.

4. **Meaningful animation and lifecycle feedback** — findings 10, 11, 19.
   - Key deal/play effects to stable card and round/trick identities. Initial/resumed snapshots establish a baseline; unrelated updates must not replay effects.
   - Add short labeled capture/removal/creature/Locker cues and public power outcomes. Keep static explanations available after motion ends. Add minimal public outcome metadata if snapshots lack sufficient evidence; do not infer hidden decisions.
   - Announce host changes, bot takeover and reconnect status with accurate grace/storage limits; provide an explicit turn-alert test.
   - Gate: duplicate snapshots, reconnect, hidden-page return and chained powers cause no duplicate effects/sounds. Reduced motion preserves all meaning; mute/visibility rules remain effective.

5. **Phone layout and teaching** — findings 13, 15, 16, 18.
   - Compact bidding and prioritize the hand; show selected-bid scoring stakes, including zero.
   - Improve functional text hierarchy and 44px touch areas where feasible. Dense tables get an accessible player-detail view; preserve ownership and all hand cards.
   - Add lobby/settings help, mode descriptions and specific start blockers. Explain two-player exclusions and the Mary house rule before starting.
   - Filter the library by Base / Expansion / All with current-mode cues, preserved return position and navigation back to rules.
   - Gate: no clipped controls, overlapping seat panels or hidden private cards in the responsive matrix; essential actions remain discoverable.

# Risks
- Ten seats plus ten cards at 320×568 require prioritization; do not solve density by shrinking critical text further.
- Wholesale rendering can reset focus or replay effects. Use small reconciliation helpers and stable identities rather than a framework rewrite.
- Decision metadata/outcome notices must respect per-viewer privacy. Server state remains the source of legality, scoring and progression.
- Confirmation adds taps: apply it only to consequential power choices, not ordinary card play or informational steps.
- The audit's source-only findings need reproduction during implementation. Reassess any finding that current runtime evidence disproves.

# Verification
- Per phase: targeted regressions for changed behavior, `npm run check`; run `npm test` after engine/room metadata changes and once for the integrated implementation. Add tests for decision identity, privacy, action recovery and event deduplication where appropriate.
- Browser: create/join/lobby → bidding → legal/illegal play → each power → trick/round/final results → rematch/leave; keyboard focus, stale rejection, disconnect/resume, takeover, host transfer and tied scores.
- Screenshots: 2/4/6/10 seats at 320×568, 390×844 and 1280×800; late rounds, ten-card hands, long names, Volley pairs, power choices and score overflow. Inspect actual screenshots as well as geometry.
- Accessibility: keyboard-only traversal, meaningful announcements, adequate targets, color-independent states and reduced-motion behavior. Use a real screen reader before claiming screen-reader certification.
- Physical phone: swipe cancellation/scroll interaction, audio unlock/mute and haptics. Installed PWA, deployed Render and background behavior remain separate checks; report any unperformed checks explicitly.
- Finish by updating the audit with resolved/open evidence and compressing durable decisions into `docs/PROJECT.md` (<500 words). No publication is part of this plan.

# Phase 1 execution · 2026-10-24

Goal/scope: implement reliable interaction only (findings 1, 2, 6, 12, 17). Approach: small request/ack additions to the existing protocol, client pending/focus state, accurate legality labels and a native join form. No rule changes.

Actionable items:
- [x] Correlate acknowledgments to the requester; unrelated broadcasts cannot clear pending actions.
- [x] Return fresh viewer-specific state on rejection; restore controls and valid bid selection.
- [x] Guard duplicate submission; disable pending gameplay controls; never queue/replay uncertain gameplay actions.
- [x] Reconcile by resume after connection loss or a 15-second response timeout. Block gameplay until the resumed state arrives.
- [x] Stop automatic reclaim when the seat is opened in another window (close code 4001).
- [x] Preserve stable card/control focus, inspection return focus and deliberate phase/decision heading focus; deduplicate turn announcements.
- [x] Keep bidding cards readable; explain forced-card versus follow-suit versus waiting restrictions.
- [x] Validate/normalize join codes, support Enter, retain failed-join dialog and show pending/error feedback.
- [ ] Complete physical-device and real screen-reader validation (separate release checks).

Contingencies:
| Condition | Handling |
| --- | --- |
| Incomplete or malformed join code | Normalize English letters; disable submission until exactly five; native form validation. |
| Missing/full/started room | Inline error, preserve input and allow retry on the same connection. |
| Repeated click / unrelated player update | One in-flight request; only matching acknowledgment settles it. |
| Stale revision / illegal action | Reject without client replay; refresh private snapshot, restore valid controls/selection. |
| Action applied but reply lost | Reconnect/resume and display actual state; do not resend the action. |
| No reply / stalled connection | 15-second watchdog closes the socket; resume if a session token is known, otherwise allow a new attempt. |
| Expired/removed seat or missing saved room | Clear unusable session, return to opening and explain the failure. |
| Seat opened elsewhere | Stop reconnecting; direct the player to the other window. |
| Card/control removed or decision changed | Focus current phase/decision heading; never retain a stale play action. |
| Modal open during remote updates | Do not steal modal focus; restore a valid game target after close. |
| Server storage lost on restart | Report missing room; recovery cannot reconstruct lost server data. |

Risks: live deployment requires matching client/server acknowledgment support; physical touch and screen-reader behavior require separate verification. Existing reduced-motion, rules and privacy behavior must remain unchanged.

Verification evidence is recorded in `docs/qa/2026-10-24-phase1.md`; phases 2–5 remain pending.

Reassessment: the final randomized simulation exposed an existing First Mate Mary → Bendt deadlock (marked card could be discarded). Scope expanded by one engine filter and one deterministic regression to preserve the required next play; 52 tests and 900 additional expansion matches pass. No new house rule introduced.

# Next selected workstream · animation and recovery

Plan only, requested 2026-10-24. Detailed goal/scope/approach/risks/verification: `docs/ANIMATION_RECOVERY_PLAN.md`. Implement phase 4 next while leaving phases 2–3 pending. Prioritize stable event identity and privacy before visual cues; preserve phase-1 action recovery and focus. No runtime changes in this planning pass.

# Animation and recovery implementation · 2026-10-24

Implemented: stable match identity (including saved-match migration), bounded public outcome summaries, snapshot event tracking, accepted play/deal/reveal/leader/round cues, sea-effect overlays and persistent removal/cancellation/suit-neutralization labels, private-safe power summaries/source portraits, final-trick explanation, reconnect baselines, host/takeover/return notices, separate recovery controls/elapsed wait, lobby countdown and alert test. Motion cancels on navigation/hidden page/preference change; unrelated renders retain elapsed cue time. Sound is capped to one cue per snapshot batch.

Verification: 63 tests and syntax/diff checks pass; live create/bid/play, two-client disconnect/host transfer/reclaim, alert test and ten-seat 320px special-effect fixture checked. Ten-seat 390px/desktop screenshots and integrated rejection/timeout checks also passed. Evidence and remaining QA are in `docs/qa/2026-10-24-feedback.md`. Full 2/4/6/10-seat responsive coverage, every animated special outcome, real reduced-motion/screen-reader and physical-phone checks remain open. No deployment. Phases 2–3 and unrelated teaching work remain pending.

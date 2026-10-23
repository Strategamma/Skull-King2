# Goal
Make gameplay changes and connection recovery easy to understand through short, event-driven cues and persistent explanations. This is the next selected workstream (phase 4 of the overall UX plan); phases 2 and 3 remain separate.

# Scope
Improve live dealing/plays, bid reveal, trick effects, power outcomes, host/seat transitions and alert preview. Preserve the existing artwork, rules, authoritative server, phase-1 recovery protocol, focus behavior and final celebration. No dependencies, new artwork, publishing or general screen redesign.

# Approach

## 1. Establish reliable presentation events first

Current gaps: `renderContent()` rebuilds cards and phase panels. Existing `.arriving`/`.dealing` styles are unused; other CSS effects can restart on unrelated renders. `lastEvent` detects broad phase changes, not each outcome. Reconnect and rematch need distinct identities.

- Add a match-instance identity and stable identities for decisions/outcomes. A revision identifies state updates; it must not independently trigger animation.
- Diff public snapshots for new public plays, revealed bids, host changes and seat-state transitions. Compare local hand IDs only for the local player's deal/exchange.
- Add minimal structured server metadata for outcomes that cannot be inferred reliably: source power, resolved effect, affected public cards, next-leader change and final-trick effects. Filter any private payload per viewer before transmission.
- Use bounded current-trick/current-decision summaries rather than an unbounded event history. If continuity is lost, show the latest state and summary without reconstructing a theatrical sequence.
- Keep a small presentation controller separate from the render function. Initial/resumed snapshots establish a baseline; duplicate snapshots and acknowledgments do not create effects. Retain active visual state across harmless rerenders, then clear it on completion or context change.

Acceptance: one accepted event produces one cue; an unrelated snapshot produces none. Rematch receives a new identity even when round/card IDs repeat. Rejected actions produce error feedback, never a successful-play cue.

## 2. Wire useful everyday cues

| Event | Proposed feedback | Text that remains usable without motion |
| --- | --- | --- |
| New round dealt | Local hand arrives in a short capped stagger, about 250–500 ms total; optional soft deal sound | Round and cards-dealt label |
| Accepted play | Card settles beside its owner in 160–220 ms; one subtle swish | Named ownership and declared role |
| All bids locked | One coordinated 200–300 ms reveal | Public bid/tricks counters |
| Current winner changes | Brief gold border emphasis, separate from mint active-turn cue | Current winner label |
| Round scored | One brief emphasis on authoritative round change | Signed round score and existing ledger |

- Keep the ordinary pointer/button response immediate, but play the committed-play sound only after authoritative acceptance. Avoid making an optimistic swish sound like a successful play when the server rejects it.
- Keep controls usable throughout. Do not introduce screen shake, full-screen flashes or gameplay delays for routine card actions.
- Reuse the approved final celebration; trigger it once per finished match, not once per render/resume. Explicit Replay remains intentional.

## 3. Explain special-card outcomes where they happen

| Rule event | Visual cue | Required explanation |
| --- | --- | --- |
| Winning capture | Winner outline and short inward emphasis; retain inspectable plays | Winner and capture relationships; bonuses are provisional until exact bid is known |
| Plank | Mark removed pirate, brief fade/cross-out | Named pirate removed; no capture bonus |
| Kraken | Brief localized sea sweep over affected plays | Trick destroyed; nobody wins; who leads next |
| Whale / Stingray | De-emphasize special ranks and suit cues without hiding card identities; highlight winning number | Highest/lowest number wins; tie order if relevant |
| Locker | Mark cancelled creatures distinctly | Which creatures were cancelled; conditional bonus |
| Volley | Emphasize second play in its owner's pair | Extra play now; that seat skips the final trick |
| Mary | Local required-card marker; public generic resolution only | A card was selected; actual card/hand visible only to authorized viewers |
| Rosie / Harry / Rascal | Highlight changed leader/bid/wager near its owner | Before/after value or confirmed next leader; distinguish decline |
| Bendt / Juanita | Private exchange/inspection cue only | Completion and remaining steps; no hidden card details in public notices |
| First Mate | Source portrait/name and step transition | Identify each inherited power and its outcome separately |

Keep explanations available in a compact current-trick summary, including effects resolved before the final result or final victory screen. Never delay server progression to finish a visual queue; cancel obsolete movement and update the summary if the next state arrives first. Do not change decision confirmation behavior here (phase 2).

## 4. Separate recovery status from gameplay feedback

Current gap: `notice()` shares one channel for pending actions, connection errors and lifecycle information. Host/bot changes silently alter badges; successful resume has no explicit confirmation. Starting every request with a large notice can also cause layout movement.

- Use a persistent connection-status area for connecting/reconnecting/lost room, local pending/error feedback beside the relevant action, and a compact dismissible lifecycle notice for host/seat changes. Keep layout space stable and deduplicate announcements.
- Show elapsed retry/wait state without claiming a reliable server ETA. Give Retry now and an explicit Leave table route when recovery stalls; neither automatically replays an uncertain action.
- Show a remote seat's disconnect grace countdown from server timestamps. At expiry, explain bot takeover; on successful reclaim, identify the returning human. Never promise an own-seat grace deadline unless the server actually supplies it.
- Name the new host and state when the local player becomes host. Distinguish temporary bot takeover from permanent replacement/removal.
- After a resumed snapshot arrives, show Connected and table restored briefly. If the table has changed, summarize the current phase instead of replaying missed animations.
- Keep missing room, unreclaimable seat and seat-opened-elsewhere outcomes distinct. Offer an appropriate return/join route; do not imply lost Render Free storage can be recovered.
- Lifecycle messages must not replace pending-action errors or steal focus from a dialog. Coalesce rapid changes; retain the latest important status until acknowledged or superseded.

## 5. Accessibility, sound and cancellation

- Add an explicit Test turn alert control. Report unsupported vibration/audio activation honestly; respect the separate saved chime and vibration settings without silently enabling them.
- Honor reduced motion with immediate stable outlines/labels and no decorative movement. Recheck a preference change while an effect is active.
- Stop transient motion/audio on hidden page, navigation, leave and rematch. On return, show current state; only the existing deduplicated current-turn alert may be deferred.
- Bound every effect/queue, remove completed nodes/listeners and avoid stacking sounds during burst updates. Use short transforms/opacity changes; animate overlays rather than moving focusable hit targets.
- Use text and symbols alongside color. Ensure one useful screen-reader announcement per important outcome; do not announce every card frame or countdown second.

# Risks
- Render rebuilding can restart motion and disturb focus; presentation state needs stable event/card identity, not blanket animation classes.
- Some outcomes disappear before the next snapshot (including final-trick powers). Structured server summaries must survive long enough to explain them without exposing private information.
- Ten-seat tables have little spare space. Keep cues anchored and short; the result-tray redesign belongs to phase 3, so do not depend on it.
- Disconnected viewers may miss intermediate events. Prefer truthful current-state summaries over inferred histories. Match identity must survive normal resume and change on rematch.
- Avoid treating a provisional capture bonus as awarded points or changing established special-card rules while adding feedback.
- Browser audio/vibration restrictions and Render Free data loss remain product constraints, not problems an animation can solve.

# Verification

1. Unit tests: event diff/deduplication; initial/resume baseline; out-of-context cancellation; rematch identity; bounded bursts; private/public event filtering. Extend existing turn/audio tests where behavior changes.
2. Engine/room tests: event metadata matches actual resolution for each creature, Locker, Plank, Volley, inherited powers, declined powers and final-trick transitions; no extra rule execution or scoring.
3. Deterministic browser fixtures: ordinary cues plus every special outcome; repeated identical states, unrelated seat updates, rapid Continue, rejection, applied-action/lost-reply and 15-second timeout recovery. Confirm cues finish and inputs/focus remain usable.
4. Lifecycle browser checks with two real clients: disconnect/countdown, takeover, reclaim, host transfer, opened-elsewhere, missing/unreclaimable room, modal open during updates and successful resume. Confirm no automatic action replay or missed-event celebration burst.
5. Screenshots/video inspection at 320×568, 390×844 and desktop, including ten seats/ten cards and Volley pairs. Inspect reduced motion, mute, hidden-page return and mid-effect navigation. Verify actual movement as well as static layouts.
6. Run runtime syntax and relevant tests, then the integrated suite. Record physical-phone sound/swipe/haptics and real screen-reader validation separately. No deployment claim from local checks.

Implementation order: event identity and privacy → everyday cues → special outcomes → recovery/lifecycle messages → alert preview/accessibility → integrated QA. Each step must preserve the completed phase-1 recovery checks before the next begins.

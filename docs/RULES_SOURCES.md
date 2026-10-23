# Rules sources

Current English rulebook linked from https://www.grandpabecksgames.com/pages/skull-king : https://heyzine.com/flip-book/46b5bd7166.html . All 20 pages extracted and read on 2026-10-23. Underlying PDF: https://cdnm.heyzine.com/files/uploaded/46b5bd7166a9f579404e175e4990c9d415b4aac7.pdf .

Edition conflict: linked English PDF p.19 releases suit obligations after creatures; website FAQ retains an established suit. User selected the FAQ interpretation: preserve the established lead after a creature is played; a creature-led trick has no assigned suit. Validator and tests now follow this choice.

Deck: 70 classic cards; full mode adds four advanced cards and 19 expansion cards = 93. Physical blank/reference/bid-reminder cards are not gameplay cards. Two-player omissions and ghost-hand dealing need separate handling. Pirate Map/purple, Treasure Chest/yellow, Parrot/green and Jolly Roger/black are the actual suit identities.

Current pirate ability reference: https://cdn.shopify.com/s/files/1/0565/3230/4053/files/SK_Pirate_Abilities.jpg?v=1672938216

Expansion source: https://cdn.shopify.com/s/files/1/0565/3230/4053/files/Skull_King_Expansion_Rulebook_Web.pdf?v=1753214318

Do not use the old printable basic rules as current authority. Official illustrations/reference sheets are reference material, not assets to ship.

## Verified expansion timing cases to test

- First Mate offers captured pirate powers after winning; handle multiple powers independently, in the order those pirate cards were played (user-confirmed rule).
- User-selected Mary house rule: winner privately sees the target hand and chooses a card; preselect and force that card next trick. Disable Mary’s power throughout round 10, and on any final trick with no next trick. This differs from the printed unseen selection.
- Plank removes a standard pirate after all plays; resolve target selection before winner/bonuses.
- Last Volley adds a late play and skips its owner's final trick, except when used on that final trick.
- Locker removes every sea monster regardless of play order; attribute its bonus separately.
- Last sea monster determines the effect unless Locker cancels them.
- Added 7/8 duplicates use first-played tie breaks; added 0/14 requires mode choice. Wild 15 never declares trump.
- Two-player expansion omissions affect deck composition and capacity.
- Discard tricks with no eligible winning card.

`public/cards.js` holds all card descriptions, powers, deck construction and bonus metadata. `public/rules.js` currently implements play validation and round scoring, not full trick/effect resolution. Score samples are clearly illustrative. Never claim powers are fully activated from the existence of guide text.

`resolvePlankTrick` resolves ordinary tricks with Plank removal before winner and bonus attribution; it explicitly rejects creature/Volley combinations pending that pipeline. `recordResolvedTrick` prevents duplicate trick recording. Mary selection/preselection helpers are tested but not connected to authoritative multiplayer.

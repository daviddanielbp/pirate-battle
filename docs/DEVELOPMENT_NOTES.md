# Development notes

This file records how the project was built and verified, so the delivery can be judged on what actually happened rather than on the size of the diff.

## How it was built

The project was built in one intensive day (17 September 2026). An AI coding assistant was used to accelerate implementation: scaffolding, the first version of most modules, the translation dictionaries and large parts of the Playwright suite were drafted with it. Direction, scope decisions, play-testing, review and acceptance were done by hand, and every requirement of the brief was checked section by section before delivery. The extras (random arenas, mouse steering, progression, Shipyard, languages) were added only after the required behavior was complete and tested, and each one was checked against the brief so that no rule was changed.

The order of work was: read the brief and the asset pack → decide the architecture (pure simulation, Pixi renderer, React shell, typed config, atomic UI) → build the core loop → play-test → review → end-to-end tests → documentation → extras → final verification.

## Problems found in manual play-testing

These were found by playing the game in the browser and were fixed before delivery.

| Problem | Fix |
| --- | --- |
| The arena rendered in a quarter of the screen on Retina displays: the stage fit divided by the device pixel ratio twice | `fitStage` now uses the renderer's logical size; the water also fills the letterbox area and the arena boundary is drawn |
| Enemies felt too fast and the player's damage too low; a stationary player died in 15 s | Rebalanced the typed config (player speed and turn rate, front cannon 40 damage, Chaser 50 HP / 20 contact damage, Shooter 8 damage, first spawn at 3 s) |
| The Options form was clipped inside the pause dialog because the steering select sized itself to its longest option | Form and selects constrained to the panel width; short option labels with the explanation below |
| The title art was left-aligned and the single-column menu was cramped | Menu redesigned into three columns: controls guide, actions, your ship |
| The Shipyard was too tall to reach the Main menu button without scrolling | Cards, sprites and rows compacted |
| A water-splash sound played for every cannonball that simply expired | Sound only on island hits; expiry in open water is silent |
| Transient confirmations ("scenario applied", "options saved", purchases) pushed the buttons around inside dialogs | Toast system in the top-right corner above every layer, sliding in from the right |
| Screen changes were abrupt and surviving a battle looked the same as losing | Screen and dialog transitions; victory banner, animated score and a Shipyard shortcut on the result screen |
| Portrait phones paused the game and asked to rotate | The world container is rotated 90° in portrait so the whole arena stays visible; pointer input maps through the same transform |
| A start screen had been added before the main menu; the brief describes the main menu as the entry screen | Removed so the main menu is the first screen, exactly as specified |
| The volume label read "80 percent" | Number only |
| Taking damage had little feedback beyond the health bar, and cannon readiness was invisible | Short camera shake when the player is hit or rammed; cooldown bars for the three cannons in the HUD |

## Problems found in code review and automated testing

A structured review of the codebase (five perspectives: rules, runtime, React, data, UI kit; each finding independently re-verified) and the end-to-end suite found the following, all fixed before delivery.

| Problem | Fix |
| --- | --- |
| Chasers could orbit forever behind an island when the player parked in a pocket of the map (greedy look-ahead steering) | Navigation grid (breadth-first flow field toward the player) used whenever the straight line is blocked; look-ahead capped at the target distance. Verified with a headless harness at every arena pocket |
| Shooters parked behind an island without line of sight and never fired | Line of sight forces the approach behavior |
| Ships aligned bow-to-stern interpenetrated and crawled at a tenth of their speed | Separation uses the closest points between the two capsules |
| The audio autoplay unlock resumed the context while the game was paused | Pause silences the loops through their gain nodes instead of suspending the context |
| A match that ended less than a second before a reload was never recorded | The record is persisted the instant the simulation reports the end; only the screen change is delayed |
| A confirmed submission could be missed by a list request that was already in flight | Queries are cancelled before invalidation |
| Match registration bypassed TanStack Query | Submissions run through a `MutationObserver` scoped per match id |
| The dialog focus trap was bound to the backdrop, so a click on it let focus escape | Document-level key handling, focus-in guard and an inert application root while a dialog is open |
| Touch buttons released a held control when another finger moved focus | Blur only releases keyboard presses; pointer presses end with pointer events |
| The fixed-step accumulator drifted one frame per call because of floating point | Epsilon comparison |
| Destroying a Pixi application with `releaseGlobalResources` under React Strict Mode broke the live renderer | Applications are destroyed without releasing shared resources |
| Taps shorter than one simulation step never fired | One-step latch in the control state |
| The configured maximum speed was unreachable with the drag and acceleration values | Values tuned so the cap is reached |
| Fixture scores of 1 450 points were impossible for one-point kills | Scaled to plausible values while keeping the tie cases |
| A test run reused a stale preview server and reported 68 false failures | Process fix: the preview is always restarted before the suite |

## Verification before delivery

- `pnpm lint`, `pnpm typecheck` and `pnpm build` clean.
- The full Playwright suite passing on the production build, desktop and mobile Chromium, with committed visual baselines and an axe-core accessibility audit of every screen (report in `reports/playwright-report`).
- Performance profile of a full three-minute battle and five start/play/leave cycles, with a screenshot, frame-time and memory charts as evidence (`PERFORMANCE.md`, `reports/`).
- The published build was smoke-tested after deployment: menu, ranking served by MSW, a battle start, no console errors.

## Decisions

- Where an extra could conflict with the brief, the brief won: the default cannon fires a single projectile, keyboard steering and English are the defaults, the whole arena stays visible, and ranking and history remain simulated by MSW in the published build.
- Social login and a shared online leaderboard were considered and rejected because the brief requires the mocked API in the published build and no dependency on private services.
- The README of the brief was left untouched; the solution is documented in `SOLUTION.md`, `ARCHITECTURE.md`, `EXTRAS.md` and this file.

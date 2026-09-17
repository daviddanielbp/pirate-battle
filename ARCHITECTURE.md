# Architecture

Pirate Battle is a single-page application. React owns every menu, form, panel and dialog; PixiJS owns the arena. The two never share ownership of the same state: the battle lives in a pure TypeScript simulation, React reads a throttled snapshot of it, and Pixi draws it.

```
src/
  app/        screen state machine, match session, audio provider, formatting helpers
  game/
    config/   typed gameplay configuration (the only place with balance numbers)
    core/     simulation: entities, arena geometry and generator, collisions, steering, navigation grid, rules
    progression/ coins, experience, levels and Shipyard catalog applied to the config snapshot
    render/   PixiJS scene: arena layer, ship views, projectiles, effects, stage fitting
    input/    keyboard bindings, pointer steering and the held-control state shared with touch buttons
    assets/   atlas manifest and loader with progress, failure and reuse
    audio/    Web Audio engine and the battle sound mapping
    battleRuntime.ts  fixed-step loop, pause, clock modes, HUD snapshot store
  ui/         React interface organized by atomic design
    atoms/      Button, IconButton, Slider, Toggle, StatusMessage, ProgressBar, Kbd, VisuallyHidden
    molecules/  Panel, Stepper, Tabs, Pagination, DataTable, HullSprite, TouchButton
    organisms/  Dialog, ToastProvider, Hud, TouchControls, PauseDialog, OptionsForm, NetworkLabDialog
    templates/  SceneBackground, ScreenTemplate
    pages/      Menu, Options, Shipyard, Loading, Battle, Result, Captain's Log
    shared/     icon and asset URL maps, focus helpers
  i18n/       typed message dictionaries (English source of truth) and the translate helper
  data/       Axios client, contracts, TanStack Query hooks, pending submissions
  mocks/      MSW handlers, fixtures, in-browser database and network scenarios
  storage/    localStorage adapters with validation
  testing/    test ids shared with Playwright, URL flags and the test API
```

## React ↔ PixiJS integration

`BattleScreen` mounts a host `<div>` and creates one `BattleRuntime` per match inside `useEffect`. The runtime creates the Pixi `Application` asynchronously; if the effect is cleaned up before `init` resolves (React Strict Mode does exactly this), the `disposed` flag makes the runtime destroy the application as soon as it exists instead of attaching it. Cleanup removes the ticker callback, the resize listener, window `blur`/`visibilitychange` listeners, keyboard listeners, every sprite and generated texture, and finally the canvas. Atlas textures are shared across matches and stay cached in `Assets`, so restarting never re-downloads or re-uploads them.

The canvas uses `resizeTo` the host element with `resolution = min(devicePixelRatio, 2)` and `autoDensity`. `fitWorld` scales a world container uniformly to fit the 1856×1024 arena inside the canvas (letterboxed, never stretched) and centers it; the world is padded with water and a boundary line so the playable limits are always visible. Keyboard and touch input never depend on canvas coordinates; the optional mouse steering maps pointer positions back to arena space with the inverse of the same letterbox transform (`BattleRuntime.toArenaPoint`).

The in-canvas HUD (score, time, health bar, cannon cooldown bars) is a Pixi layer placed in screen space over the letterboxed stage; it switches to a stacked layout on narrow screens. The React layer holds the pause button and a visually hidden semantic copy of the same values. The runtime publishes a `HudSnapshot` (status, score, whole seconds left, health, enemy count) through a subscribe/getSnapshot pair consumed with `useSyncExternalStore`, and it only notifies when a field actually changes. In practice React re-renders about once per second plus on hits, never per frame. The same snapshot feeds the semantic status region and the polite live region, which announces phase changes only (started, 30 s, 10 s, paused, ended).

## Simulation loop

`MatchSimulation` is plain TypeScript with no Pixi imports. `BattleRuntime.advance(ms)` accumulates real time (clamped to 250 ms per frame to avoid spirals after a stall) and runs fixed 1/60 s steps; movement, cooldowns, projectile life and spawns are integrated per step, so the outcome is independent of frame rate. Every step:

1. cooldown timers tick;
2. the player integrates thrust, drag, rotation, then settles against islands and arena bounds;
3. each enemy steers, integrates and, for Shooters, fires when aligned, in range, off cooldown and with a clear line of fire;
4. projectiles move, expire, leave the arena, hit islands or hit the first opposing ship; damage is applied once and the projectile is removed in the same step;
5. ship/ship overlaps are resolved (Chaser × player detonates, others push apart), followed by a final settle against obstacles;
6. the spawner counts down and places an enemy on a free spot at least `minDistanceFromPlayer` away;
7. end conditions are checked (`defeated` before `time_up`), after which `step` becomes a no-op.

Randomness comes from a seeded `mulberry32` generator (`?seed=` fixes it in tests), so the same inputs produce the same match. The runtime has two clock modes: `auto` (Pixi ticker drives `advance`) and `manual` (only the test API advances time), which is how the E2E suite controls the clock while keeping the real rules, inputs, collisions and rendering.

Pausing (manual, on window blur or on hidden tab) stops stepping, clears the held controls and the accumulator, and silences the battle loops. Resuming clears the controls again, so nothing pressed during the pause is ever applied and no time is caught up.

## Arena generation

Every match builds its own `ArenaDefinition` from the match seed (`generateArena`): islands are rectangles of 64 px cells with random shapes, kept one cell away from the borders, two cells apart, and outside a clear zone around the player start; a breadth-first search over the cell grid rejects layouts where any water cell is unreachable. Enemies path around islands with a navigation grid (`NavigationGrid`, BFS flow field toward the player) whenever the straight line is blocked, and with local look-ahead steering otherwise.

## Collisions

- Islands are rounded rectangles built from the tile grid (`circleRoundedRectPenetration`). Ships are capsules sampled as three circles (stern, center, bow); penetration pushes the ship out and damps its speed. Projectiles are points tested against the same shapes.
- Ship hitboxes are capsules; projectile hits use point-to-segment distance, ship overlaps use segment-to-segment distance. Arena bounds clamp the capsule extent, so no part of a hull leaves the water.
- Enemy steering samples candidate headings around the desired direction and keeps the first one whose look-ahead points are free of islands and inside the arena, plus a soft separation term between enemies. Shooters approach until `attackRange`, hold at `preferredDistance`, and back off when too close.

## Resource management

`loadGameAtlases` fetches the three atlas descriptors and images (ships, tiles, UI), parses them into `Spritesheet`s and caches them; failures reject with the offending URL so the loading screen can show it and offer a retry. Concurrent callers share one in-flight load and all receive progress. Sounds are decoded lazily by the `AudioEngine` and never block the battle; missing audio just stays silent. Ship views, projectile views and effect sprites are pooled and released on destroy; generated textures (water tile, splash ring) are destroyed with the renderer.

## Local persistence

| Key | Content |
| --- | --- |
| `pirate-battle.options.v1` | session time and spawn interval (validated against limits on read) |
| `pirate-battle.audio.v1` | volume and mute |
| `pirate-battle.player.v1` | local player id and name |
| `pirate-battle.last-result.v1` | last completed match record |
| `pirate-battle.screen.v1` | marker that the result screen was open, so a refresh restores it |
| `pirate-battle.pending-submissions.v1` | pending records and confirmed ids |
| `pirate-battle.mock-database.v1` | records accepted by the mock API |
| `pirate-battle.network-scenario.v1` | selected network scenario |
| `pirate-battle.progress.v1` | coins, experience, hull, cannon and upgrade levels (Shipyard) |
| `pirate-battle.last-rewards.v1` | rewards granted by the last completed match |

Every read goes through a type guard; corrupted values fall back to defaults. A reload during a battle boots into the menu: the match is abandoned and nothing is recorded.

## Ranking and match history

Contracts live in `src/data/contracts.ts` (`MatchRecord`, `RankingEntry`, `Page<T>`, queries). Axios (`httpClient`) performs the requests with a 6 s timeout and maps failures to `ApiError { kind, status, retryable }`. TanStack Query hooks (`useRankingQuery`, `useHistoryQuery`) use `keepPreviousData` for pagination, refetch on every mount so the tabs are fresh when reopened, forward the abort signal so superseded requests are cancelled, and retry retryable errors twice with backoff. Delayed responses cannot overwrite newer data: keys are per page and per configuration, in-flight requests are deduplicated, and invalidation cancels the previous fetch.

A finished match becomes a `MatchRecord` with a client-generated id, is stored as the last result, enqueued in the pending store and submitted. `POST /api/matches` is idempotent on the id (201 created / 200 existing), so retries after a timeout or repeated clicks never duplicate. The submission manager runs each submission through a TanStack `MutationObserver` scoped per match id, keeps a single in-flight promise per id, marks failures with the error, and on success removes the record from the pending store, cancels in-flight list requests and invalidates both query roots. Pending records survive refreshes and are flushed on startup and when the log opens; the result screen and the history tab expose manual retries.

## Mocking

MSW handlers implement the four endpoints on top of an in-browser database (fixtures merged with persisted submissions). `planRequest` decides latency and failure per request from the active scenario (URL `?scenario=`, persisted choice, or `default`). Scenarios are deterministic: jitter uses the seeded generator, out-of-order alternates latencies, and the recover scenarios count attempts per match id. The worker is started before React renders and is part of the production build.

## Limitations and balancing decisions

- Arenas are generated per match; enemy spawn points are sampled randomly within them and validated against islands, other ships and the player distance.
- Ships collide as capsules rather than pixel-accurate hulls; sails may visually overlap an island edge by a few pixels.
- Both orientations are supported on mobile. In portrait the world container is rotated 90° so the whole arena stays visible with the same rules; HUD and touch controls stay in screen space.
- Progression (extras) multiplies these values at match start through `applyLoadout`; the loadout is stored with each match record, while the ranking key remains session time + spawn interval as required.
- Default balance: player 100 HP, 205 px/s; Chaser 50 HP, 150 px/s, 20 contact damage; Shooter 80 HP, 105 px/s, 8 damage per shot at 400 px range; front cannon 40 damage / 0.4 s; broadside 3 × 25 damage / 1.2 s. These values sit in `DEFAULT_GAMEPLAY_CONFIG` and can be changed without touching systems.
- Audio uses AAC files converted from the provided WAVs; browsers without Web Audio simply play nothing.

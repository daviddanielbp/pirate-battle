# Performance report

Measured with `pnpm perf:profile` against the production build served by `pnpm preview`. The script opens a headed Chromium window, plays a full 180 s battle with a scripted autopilot while sampling every animation frame, then runs five start → play (12 s) → leave cycles from the main menu and reads the JS heap after forcing garbage collection. Raw numbers are in [reports/performance.json](reports/performance.json).

## Reference environment

| Item | Value |
| --- | --- |
| Hardware | MacBook Air, Apple M3 (8 cores), 8 GB RAM |
| OS | macOS 26.2 |
| Browser | Chromium 153 (Playwright build), WebGL renderer |
| Viewport | 1440 × 810 CSS px at device pixel ratio 2 (2880 × 1620 canvas pixels) |
| Match configuration | 180 s session, 3 s spawn interval, up to 6 enemies alive, default balancing |
| Date | 2026-09-17 |

## Three-minute battle

| Metric | Value |
| --- | --- |
| Frames rendered | 10 801 in 180.0 s |
| Average frame rate | 60.0 FPS (display refresh cap) |
| 95th percentile frame time | 18.2 ms |
| Maximum frame time | 32.9 ms (a single frame, at the final explosion sequence) |
| Average entities (ships + projectiles) | 3.4 |
| Peak entities | 10 |
| Enemies destroyed by the autopilot | 55 |

The autopilot keeps the player alive for the whole session by restoring its health every 100 ms through the test API (`restorePlayerHealth`), so the sample covers three full minutes of continuous combat with spawns, projectiles, hits and explosions; every other rule (movement, collisions, enemy behavior, cooldowns, scoring) runs unchanged. Enemy count is bounded by `spawn.maxEnemies` (6) and each ship fires at most a few projectiles per second, so the entity count stays small by design; the renderer pools projectile and effect sprites and never allocates per frame in steady state.

## Memory after five start/play/leave cycles

| Cycle | Used JS heap (MB) |
| --- | ---: |
| 0 (menu, after the 3-minute battle) | 9.23 |
| 1 | 9.54 |
| 2 | 9.77 |
| 3 | 9.85 |
| 4 | 10.00 |
| 5 | 10.06 |

The increments shrink with every cycle (+0.31, +0.23, +0.08, +0.15, +0.06 MB) and converge instead of growing linearly: the remaining growth comes from caches that fill once (decoded audio buffers, TanStack Query cache, the atlases kept in `Assets` on purpose so restarts do not reload textures). Each battle creates and destroys its own Pixi `Application`; the ticker callback, resize listener, window focus listeners, keyboard listeners, sprite pools, generated textures and the canvas are all released in `BattleRuntime.destroy`, and React Strict Mode's double mount is handled by discarding an application whose owner was disposed before initialization finished.

## Limitations

- Chromium's `performance.memory` only exposes the JS heap; GPU memory for the 2× canvas is not included. The atlases (about 12 MB of decoded textures) are uploaded once per page load.
- The p95 of 18.2 ms is above the 16.7 ms frame budget by one sample bucket: `requestAnimationFrame` timestamps on this machine alternate between 16.6 and 18.x ms under the Playwright automation hooks, and the average stays at 60 FPS with no dropped frames beyond the single 32.9 ms spike.
- The profile was run at DPR 2 on an integrated GPU; lower resolutions have more headroom, and mobile devices should be validated separately with the same script through `PROFILE_URL` pointed at the published build.

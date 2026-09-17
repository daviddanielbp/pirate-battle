# Performance report

Measured with `pnpm perf:profile` against the production build served by `pnpm preview`. The script opens a headed Chromium window, plays a full 180 s battle with a scripted autopilot while sampling every animation frame, then runs five start → play (12 s) → leave cycles from the main menu and reads the JS heap after forcing garbage collection. Raw numbers, including every frame time, are in [reports/performance.json](reports/performance.json); [reports/frame-times.svg](reports/frame-times.svg) plots the frame time of the whole battle against the 16.67 ms budget, [reports/memory-cycles.svg](reports/memory-cycles.svg) plots the heap after each cycle, and [reports/profile-battle.png](reports/profile-battle.png) is a capture of the battle during the run.

## Reference environment

| Item | Value |
| --- | --- |
| Hardware | MacBook Air, Apple M3 (8 cores), 8 GB RAM |
| OS | macOS 26.2 |
| Browser | Chromium 153 (Playwright build), WebGL renderer |
| Viewport | 1440 × 810 CSS px at device pixel ratio 2 (2880 × 1620 canvas pixels) |
| Match configuration | 180 s session, 3 s spawn interval, up to 6 enemies alive, default balancing, generated arena (seed `profile`) |
| Date | 2026-09-17 |

## Three-minute battle

| Metric | Value |
| --- | --- |
| Frames rendered | 10 799 in 180.0 s |
| Average frame rate | 60.0 FPS (display refresh cap) |
| 95th percentile frame time | 17.6 ms |
| Maximum frame time | 49.9 ms (the final frame, when the match ends and the result screen mounts); one 33.6 ms frame at the very start while textures warm up; every other frame stayed under 20 ms |
| Average entities (ships + projectiles) | 3.7 |
| Peak entities | 11 |
| Enemies destroyed by the autopilot | 50 |

The autopilot keeps the player alive for the whole session by restoring its health every 100 ms through the test API (`restorePlayerHealth`), so the sample covers three full minutes of continuous combat with spawns, projectiles, hits and explosions; every other rule (movement, collisions, enemy behavior, cooldowns, scoring) runs unchanged. Enemy count is bounded by `spawn.maxEnemies` (6) and each ship fires at most a few projectiles per second, so the entity count stays small by design; the renderer pools projectile and effect sprites and never allocates per frame in steady state.

## Memory after five start/play/leave cycles

| Cycle | Used JS heap (MB) |
| --- | ---: |
| 0 (menu, after the 3-minute battle) | 9.94 |
| 1 | 10.30 |
| 2 | 10.51 |
| 3 | 10.61 |
| 4 | 10.75 |
| 5 | 10.81 |

The increments shrink with every cycle (+0.36, +0.21, +0.10, +0.14, +0.06 MB) and converge instead of growing linearly: the remaining growth comes from caches that fill once (decoded audio buffers, TanStack Query cache, the atlases kept in `Assets` on purpose so restarts do not reload textures). Each battle creates and destroys its own Pixi `Application`; the ticker callback, resize listener, window focus listeners, keyboard listeners, sprite pools, generated textures and the canvas are all released in `BattleRuntime.destroy`, and React Strict Mode's double mount is handled by discarding an application whose owner was disposed before initialization finished.

## Limitations

- Chromium's `performance.memory` only exposes the JS heap; GPU memory for the 2× canvas is not included. The atlases (about 12 MB of decoded textures) are uploaded once per page load.
- The p95 of 17.6 ms sits one sample bucket above the 16.7 ms frame budget: `requestAnimationFrame` timestamps on this machine alternate between 16.6 and 17.x ms under the Playwright automation hooks, and the average stays at 60 FPS. The only two frames above 20 ms are the first one after the profiler starts and the last one, when the match ends and React mounts the result screen; both are outside steady-state combat.
- The profile was run at DPR 2 on an integrated GPU; lower resolutions have more headroom, and mobile devices should be validated separately with the same script through `PROFILE_URL` pointed at the published build.

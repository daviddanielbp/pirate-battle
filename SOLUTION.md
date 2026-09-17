# Pirate Battle

A top-down 2D naval shooter for the browser. Sail between islands, sink Chasers and Shooters before the clock runs out, and climb the ranking.

Built with React 19, TypeScript (strict), PixiJS 8, TanStack Query 5, Axios, MSW 2 and Playwright.

- Live build: https://pirate-battle-nine.vercel.app/
- Architecture notes: [ARCHITECTURE.md](ARCHITECTURE.md)
- Performance report: [docs/PERFORMANCE.md](docs/PERFORMANCE.md)
- Network scenarios: [src/mocks/README.md](src/mocks/README.md)
- Original brief: [README.md](README.md)
- Extras beyond the brief: [EXTRAS.md](EXTRAS.md)

## Setup

Requirements: Node.js 20+ and pnpm 10 (`corepack enable` installs the pinned version from `package.json`).

```bash
pnpm install
pnpm exec playwright install chromium   # only needed for the E2E suite
pnpm dev                                # http://localhost:5173
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server with the MSW mock API |
| `pnpm build` | Type-check and produce the optimized build in `dist/` |
| `pnpm preview` | Serve the production build on http://localhost:4173 |
| `pnpm lint` | ESLint (type-aware rules) |
| `pnpm typecheck` | `tsc` over the app and tooling projects |
| `pnpm test:e2e` | Playwright suite (desktop + mobile Chromium) |
| `pnpm test:e2e:ui` | Playwright UI mode |
| `pnpm test:e2e:update` | Refresh visual regression baselines |
| `pnpm test:report` | Open the last HTML report |
| `pnpm perf:profile` | Run the automated performance profile against the production build |
| `pnpm assets:build` | Regenerate `public/assets` from the source pack in `assets/` |

## Environment variables

Copy `.env.example` to `.env` if you need to change anything. Both variables are optional.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_BASE_URL` | empty (same origin) | Base URL prepended to `/api/...` requests. Leave empty so MSW intercepts them. |
| `VITE_PLAYER_NAME` | `Captain Jack` | Display name of the local player when the identity is first created |

The ranking and match history APIs are fully simulated by MSW in every environment, including the published build. No backend or private service is required.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | `W` or `↑` | Forward button |
| Turn left / right | `A` / `D` or `←` / `→` | Turn buttons |
| Fire front cannon (1 projectile) | `Space` | Front fire button |
| Port broadside (3 parallel projectiles) | `Q` | Left fire button |
| Starboard broadside (3 parallel projectiles) | `E` | Right fire button |
| Pause | `Esc` or `P` | Pause button in the HUD |

With `Options → Steering → Mouse` the ship turns toward the cursor (rate-limited by the same rotation speed) and sails while the left mouse button or `W` is held; cannons keep their keys. See [EXTRAS.md](EXTRAS.md).

Movement and firing can be held simultaneously. Keys are only captured while a battle is running; menus and dialogs keep normal keyboard behavior. Touch controls appear automatically on coarse-pointer devices (or with `?touch=1`). Mobile is supported in **landscape**; in portrait the battle pauses and asks you to rotate the device.

The battle also pauses automatically when the window loses focus or the tab is hidden. Resuming always requires pressing **Resume**.

## Gameplay configuration

All balancing lives in [`src/game/config/gameplayConfig.ts`](src/game/config/gameplayConfig.ts) (`DEFAULT_GAMEPLAY_CONFIG`): session duration, spawn interval/initial delay/cap/distribution, health, movement and rotation speeds, hitboxes, projectile damage/speed/lifetime/radius, cooldowns, Shooter range and aim tolerance, and the fixed simulation step. Systems read the config and never hard-code values, so balancing changes do not touch game logic.

The **Options** screen exposes two of those parameters and persists them in `localStorage`:

| Option | Limits | Default |
| --- | --- | --- |
| Game session time | 60–180 s, steps of 10 | 120 s |
| Enemy spawn time | 1–10 s, steps of 1 | 3 s |

Options also hold the steering mode, the sound volume and the mute switch. Every battle takes a snapshot of the options (and of the Shipyard loadout, see [EXTRAS.md](EXTRAS.md)) when it starts; later changes apply to the next battle only.

Each battle is played on a randomly generated island layout derived from the match seed; `?seed=<value>` makes it reproducible.

### Rules summary

- One point per enemy destroyed by your cannons. A Chaser that explodes against you does not score.
- The battle ends when the timer reaches zero or your health reaches zero. Everything freezes at that moment.
- Reloading the page or leaving the battle abandons it; abandoned battles are not recorded.
- The last completed result is persisted locally, so refreshing the result screen brings it back.
- Completed battles also grant coins and experience for the Shipyard (extras); abandoned battles grant nothing.

## Ranking and match history

Completed battles are submitted to `POST /api/matches` with a client-generated id, which makes the request idempotent: resubmitting the same id returns the existing record instead of creating a duplicate. Submissions that fail are kept in `localStorage` as pending, retried when the app starts or when the log opens, and can be retried manually from the result screen or the Match History tab.

The ranking shows the best battle per captain for the currently configured session time and spawn interval; ties are broken by shorter duration, then earlier date, then id. Other captains come from fixtures.

## Network scenarios

Ranking and history run against an MSW mock API. Open **Network simulator** in the main menu footer to pick a scenario, or add `?scenario=<id>` to the URL. **Reset** restores the fixtures, clears pending submissions and the query cache, and returns to the default scenario.

| Scenario | Behavior |
| --- | --- |
| `default` | Success with a fixed 150 ms latency |
| `empty` | Empty ranking and history (submissions still work) |
| `paginated` | Extra fixtures so both tabs have several pages |
| `slow` | 2.5 s latency |
| `jitter` | Random 100–2000 ms latency, seeded with `?seed=` |
| `out-of-order` | Alternating 1.8 s / 0.1 s latency so later responses arrive first |
| `timeout` | Responses take longer than the 6 s client timeout |
| `network-error` | Connection failure on every request |
| `server-error` | HTTP 500 on every request |
| `client-error` | HTTP 404 on reads, 400 on submissions |
| `ranking-failure` | Only the ranking fails |
| `history-failure` | Only the history fails |
| `submit-timeout-recover` | First submission of a match times out after being stored; the retry returns the existing record |
| `submit-unavailable-recover` | Submissions get HTTP 503 twice, then succeed |

Test helpers: `?latency=0` removes artificial latency (timeouts keep their semantics) and `?seed=<value>` fixes the random source used by the simulation and by the jitter scenario. See [src/mocks/README.md](src/mocks/README.md) for details.

### Reproducing failures by hand

1. Open the main menu, choose **Network simulator**, select `submit-unavailable-recover`, press **Apply**.
2. Play a battle. The result screen reports the battle as not recorded and offers **Try again**.
3. Press **Try again** twice: the third attempt succeeds, the status turns green, and both tabs show the new record exactly once.
4. Refresh the page during step 2 instead: the pending battle survives the reload, appears at the top of **Match History** with a **Send again** button, and is retried automatically when the app starts.

## Test instrumentation

Append `?test=1` to expose `window.__pirateBattle` (state inspection, manual clock, virtual controls) and `&clock=manual` to stop the simulation from advancing on its own; the E2E suite uses these together with `seed` to make battles reproducible while still running the real rules, inputs, collisions and rendering.

## Playwright

```bash
pnpm test:e2e            # runs against a fresh `pnpm preview` build
pnpm test:report         # HTML report in playwright-report/
```

Traces are recorded on the first retry of a failing test. Visual baselines live next to the specs in `e2e/__screenshots__/`.

## Deployment

The app is a static build (`dist/`) plus the MSW service worker, so any static host works. `vercel.json` adds the SPA rewrite and the `Service-Worker-Allowed` header.

Vercel (recommended):

1. Push the repository to GitHub.
2. In Vercel choose **Add New → Project**, import the repository and keep the detected settings (framework Vite, build `pnpm build`, output `dist`).
3. Deploy. Every push to `main` redeploys; the published URL serves the mocked ranking and history exactly like `pnpm preview`.

The published version must match the delivered code, so deploy from the same commit you hand in.

## Assets

The visual and audio assets in `assets/` were provided with the brief. `pnpm assets:build` derives the runtime files in `public/assets/`: the ship, tile and UI atlases are packed from the original sheets, and the WAV sound effects are converted to AAC (`.m4a`) with `afconvert` (macOS) or `ffmpeg`. No third-party fonts are bundled; the interface uses the system font stack.

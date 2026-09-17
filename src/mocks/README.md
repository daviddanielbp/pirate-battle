# Mock API and network scenarios

The ranking and match-history APIs are served entirely in the browser by [Mock Service Worker](https://mswjs.io). The same handlers run in development, in end-to-end tests and in the production build, so the app never needs a real backend.

## Endpoints

| Method | Route              | Purpose                                                |
| ------ | ------------------ | ------------------------------------------------------ |
| GET    | `/api/ranking`     | Best match per player for one configuration, paginated |
| GET    | `/api/matches`     | A player's match history, newest first, paginated      |
| POST   | `/api/matches`     | Register a finished match (idempotent by match id)     |
| GET    | `/api/matches/:id` | Fetch a single match                                   |

Query parameters are validated (`page >= 1`, `pageSize` between 1 and 50, numeric `sessionSeconds` and `spawnIntervalSeconds`, non-empty `playerId`) and invalid requests answer HTTP 400 with `{ code, message }`. The submission body must be a complete match record; otherwise it answers HTTP 400 as well.

Submitting a match returns HTTP 201 with `{ record, created: true }` the first time and HTTP 200 with `{ record, created: false }` for every later submission of the same id, so retries never create duplicates.

## Data

`fixtures.ts` holds deterministic matches played by other captains. Records submitted from the game are stored in `localStorage` under `pirate-battle.mock-database.v1` and merged with the fixtures on every request, so confirmed matches survive a refresh.

The ranking keeps the best match per player for the requested configuration. Ties are resolved deterministically: higher score, then shorter duration, then earlier date, then match id.

## Scenarios

| Id                           | Behaviour                                                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`                    | Every request succeeds after 150 ms.                                                                                                                                                   |
| `empty`                      | Fixtures are hidden; the lists only contain matches you submit.                                                                                                                        |
| `paginated`                  | Extra captains and extra matches for the local player, so the ranking has at least four pages and history can be paged.                                                                |
| `slow`                       | Every response takes 2.5 s.                                                                                                                                                            |
| `jitter`                     | Latency is drawn uniformly between 100 ms and 2 s from a seeded generator.                                                                                                             |
| `out-of-order`               | Latency alternates per request (1.8 s, 100 ms, 1.8 s, ...) so later requests resolve before earlier ones.                                                                              |
| `timeout`                    | Every response is delayed 20 s, beyond the 6 s client timeout.                                                                                                                         |
| `network-error`              | Every request fails at the network level.                                                                                                                                              |
| `server-error`               | Every request answers HTTP 500.                                                                                                                                                        |
| `client-error`               | Reads answer HTTP 404, submissions answer HTTP 400.                                                                                                                                    |
| `ranking-failure`            | Only the ranking request answers HTTP 500.                                                                                                                                             |
| `history-failure`            | Only the history request answers HTTP 500.                                                                                                                                             |
| `submit-timeout-recover`     | The first submission of a match id is stored but its response is delayed 20 s, so the client times out. Any later submission of the same id answers immediately with `created: false`. |
| `submit-unavailable-recover` | The first two submissions of a match id answer HTTP 503; the third succeeds. Reads are unaffected.                                                                                     |

The attempt counters behind `out-of-order`, `submit-timeout-recover` and `submit-unavailable-recover` live in memory only. Reloading the page restarts them.

## Selecting a scenario

The active scenario is resolved in this order:

1. The `?scenario=<id>` URL parameter. When present it is also persisted, so it stays active after the parameter is removed.
2. The value persisted in `localStorage` under `pirate-battle.network-scenario.v1`.
3. `default`.

The Network Lab panel in the main menu lists the same scenarios; applying one persists it, restarts the attempt counters and refreshes the ranking and history queries. Programmatic access goes through `networkLab.ts` (`listScenarios`, `getActiveScenarioId`, `applyScenario`, `resetEverything`).

## Resetting

`resetEverything()` (the Reset action in the Network Lab) clears the submitted matches, restores the `default` scenario, drops pending submissions and empties the query cache. Fixtures are never removed because they live in code.

## Test parameters

- `?latency=0` removes the artificial latency from every scenario so tests run fast. `timeout` and the first attempt of `submit-timeout-recover` keep their 20 s delay because the timeout is the point, and `out-of-order` alternates 300 ms / 0 ms so responses still cross.
- `?seed=<integer>` seeds the generator used by `jitter`. The default seed is `1`, so a run without the parameter is reproducible as well.

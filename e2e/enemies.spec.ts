import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_GAMEPLAY_CONFIG } from '../src/game/config/gameplayConfig';
import type { DebugShip, DebugState } from '../src/game/battleRuntime';
import { advance, battleState, enemies, player, startBattle } from './support/app';

const FRAME_MS = 1000 / 60;
const SPAWN = DEFAULT_GAMEPLAY_CONFIG.spawn;
const SHOOTER = DEFAULT_GAMEPLAY_CONFIG.shooter;
const CHASER = DEFAULT_GAMEPLAY_CONFIG.chaser;

type Rect = DebugState['arena']['obstacles'][number];

function insideRect(x: number, y: number, rect: Rect, inset: number): boolean {
  return (
    x > rect.x + inset && x < rect.x + rect.width - inset && y > rect.y + inset && y < rect.y + rect.height - inset
  );
}

function insideAnyIsland(x: number, y: number, islands: readonly Rect[], inset: number): boolean {
  return islands.some((rect) => insideRect(x, y, rect, inset));
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

interface SpawnCheckpoint {
  elapsed: number;
  seen: { id: number; kind: DebugShip['kind'] }[];
}

async function observeSpawns(page: Page, checkpointsMs: number[]): Promise<SpawnCheckpoint[]> {
  return page.evaluate(
    ({ frameMs, checkpoints }) => {
      const api = window.__pirateBattle;
      if (!api) return [];
      const seen = new Map<number, DebugShip['kind']>();
      const results: SpawnCheckpoint[] = [];
      let advanced = 0;
      for (const target of checkpoints) {
        while (advanced < target) {
          api.advance(frameMs);
          advanced += frameMs;
          const state = api.getState();
          if (!state) return results;
          for (const ship of state.ships) if (ship.kind !== 'player') seen.set(ship.id, ship.kind);
        }
        const state = api.getState();
        if (!state) return results;
        results.push({
          elapsed: state.elapsedSeconds,
          seen: [...seen.entries()].map(([id, kind]) => ({ id, kind })),
        });
      }
      return results;
    },
    { frameMs: FRAME_MS, checkpoints: checkpointsMs },
  );
}

test.describe('Enemy spawning', () => {
  test('spawns the first chaser at 3 s, a shooter at 6 s and a third enemy at 9 s with a 3 s interval', async ({
    page,
  }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 3 } });

    const checkpoints = await observeSpawns(page, [2900, 3100, 5900, 6100, 8900, 9100]);
    expect(checkpoints).toHaveLength(6);
    const [beforeFirst, afterFirst, beforeSecond, afterSecond, beforeThird, afterThird] = checkpoints;

    expect(beforeFirst?.seen).toHaveLength(0);
    expect(afterFirst?.seen.map((ship) => ship.kind)).toEqual(['chaser']);
    expect(beforeSecond?.seen).toHaveLength(1);
    expect(afterSecond?.seen.map((ship) => ship.kind)).toEqual(['chaser', 'shooter']);
    expect(beforeThird?.seen).toHaveLength(2);
    expect(afterThird?.seen).toHaveLength(3);

    const living = enemies(await battleState(page));
    expect(living.length).toBeGreaterThanOrEqual(1);
    for (const ship of living) expect(afterThird?.seen.map((entry) => entry.id)).toContain(ship.id);
  });

  test('respects a 5 s interval after the initial delay', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 5 } });

    const checkpoints = await observeSpawns(page, [3100, 7900, 8100]);
    expect(checkpoints).toHaveLength(3);
    const [afterFirst, beforeSecond, afterSecond] = checkpoints;
    expect(afterFirst?.seen.map((ship) => ship.kind)).toEqual(['chaser']);
    expect(beforeSecond?.seen).toHaveLength(1);
    expect(afterSecond?.seen.map((ship) => ship.kind)).toEqual(['chaser', 'shooter']);
  });

  test('brings both enemy types into a default match', async ({ page }) => {
    await startBattle(page);
    await expect(page.getByTestId('hud-time')).toContainText('02:00');
    await advance(page, 6100);
    const kinds = new Set(enemies(await battleState(page)).map((ship) => ship.kind));
    expect(kinds.has('chaser')).toBe(true);
    expect(kinds.has('shooter')).toBe(true);
  });

  test('spawns every enemy far from the player and outside islands', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 1 } });
    const islands = (await battleState(page)).arena.obstacles;
    expect(islands.length).toBeGreaterThanOrEqual(4);

    const spawns = await page.evaluate(
      ({ frameMs, sampleMs, totalMs }) => {
        const api = window.__pirateBattle;
        if (!api) return [];
        const initial = api.getState();
        if (!initial) return [];
        const known = new Set(initial.ships.map((ship) => ship.id));
        const found: { ship: DebugShip; player: DebugShip; elapsed: number }[] = [];
        let advanced = 0;
        while (advanced < totalMs) {
          let chunk = 0;
          while (chunk < sampleMs) {
            api.advance(frameMs);
            chunk += frameMs;
            const state = api.getState();
            if (state?.status !== 'running') return found;
            const pilot = state.ships.find((ship) => ship.kind === 'player');
            for (const ship of state.ships) {
              if (known.has(ship.id)) continue;
              known.add(ship.id);
              if (pilot) found.push({ ship, player: pilot, elapsed: state.elapsedSeconds });
            }
          }
          advanced += chunk;
        }
        return found;
      },
      { frameMs: FRAME_MS, sampleMs: 250, totalMs: 20_000 },
    );

    expect(spawns.length).toBeGreaterThanOrEqual(6);
    for (const spawn of spawns) {
      expect(spawn.ship.kind).not.toBe('player');
      expect(distanceBetween(spawn.ship, spawn.player)).toBeGreaterThanOrEqual(SPAWN.minDistanceFromPlayer);
      expect(insideAnyIsland(spawn.ship.x, spawn.ship.y, islands, 0)).toBe(false);
    }
  });
});

test.describe('Chaser', () => {
  test('closes in on a still player and detonates on contact for 20 damage without scoring', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 10 } });
    await advance(page, 3100);
    const initial = await battleState(page);
    const chaser = enemies(initial)[0];
    if (!chaser) throw new Error('Chaser did not spawn');
    expect(chaser.kind).toBe('chaser');
    expect(player(initial).health).toBe(DEFAULT_GAMEPLAY_CONFIG.player.maxHealth);

    const trace = await page.evaluate(
      ({ chaserId, sampleMs, maxSamples }) => {
        const api = window.__pirateBattle;
        if (!api) return null;
        const distances: number[] = [];
        let contact: { health: number; score: number; ships: number; elapsed: number } | null = null;
        for (let sample = 0; sample < maxSamples; sample += 1) {
          api.advance(sampleMs);
          const state = api.getState();
          if (!state) return null;
          const pilot = state.ships.find((ship) => ship.kind === 'player');
          const target = state.ships.find((ship) => ship.id === chaserId);
          if (!pilot) return null;
          if (!target) {
            contact = { health: pilot.health, score: state.score, ships: state.ships.length, elapsed: state.elapsedSeconds };
            break;
          }
          distances.push(Math.hypot(target.x - pilot.x, target.y - pilot.y));
        }
        return { distances, contact };
      },
      { chaserId: chaser.id, sampleMs: 250, maxSamples: 40 },
    );

    if (!trace) throw new Error('Battle runtime is not active');
    expect(trace.distances.length).toBeGreaterThanOrEqual(4);
    for (let index = 1; index < trace.distances.length; index += 1) {
      const previous = trace.distances[index - 1];
      const current = trace.distances[index];
      if (previous === undefined || current === undefined) throw new Error('Missing distance sample');
      expect(current).toBeLessThan(previous);
    }
    expect(trace.contact).not.toBeNull();
    expect(trace.contact?.health).toBe(DEFAULT_GAMEPLAY_CONFIG.player.maxHealth - CHASER.contactDamage);
    expect(trace.contact?.score).toBe(0);
    expect(trace.contact?.ships).toBe(1);
    expect(trace.contact?.elapsed).toBeLessThan(13);

    await expect(page.getByTestId('hud-health')).toHaveAttribute('aria-valuenow', '80');
    await expect(page.getByTestId('hud-score')).toContainText('0');
  });
});

test.describe('Shooter', () => {
  test('approaches, fires within range once aligned and deals 8 damage per hit', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 10 } });
    await advance(page, 13_100);
    const spawned = enemies(await battleState(page));
    expect(spawned.map((ship) => ship.kind)).toEqual(['shooter']);
    const shooter = spawned[0];
    if (!shooter) throw new Error('Shooter did not spawn');
    const initialDistance = distanceBetween(shooter, player(await battleState(page)));
    expect(initialDistance).toBeGreaterThan(SHOOTER.attackRange);

    const outcome = await page.evaluate(
      ({ frameMs, maxMs }) => {
        const api = window.__pirateBattle;
        if (!api) return null;
        const before = api.getState();
        if (!before) return null;
        const pilot = before.ships.find((ship) => ship.kind === 'player');
        if (!pilot) return null;
        const startHealth = pilot.health;
        let approachDistance: number | null = null;
        let firstShot: {
          shooter: DebugShip;
          player: DebugShip;
          elapsed: number;
          health: number;
        } | null = null;
        let hit: { health: number; elapsed: number } | null = null;
        let advanced = 0;
        while (advanced < maxMs) {
          api.advance(frameMs);
          advanced += frameMs;
          const state = api.getState();
          if (state?.status !== 'running') break;
          const me = state.ships.find((ship) => ship.kind === 'player');
          if (!me) break;
          if (!firstShot) {
            const shot = state.projectiles.find((projectile) => projectile.faction === 'enemy');
            if (shot) {
              const shooters = state.ships.filter((ship) => ship.kind === 'shooter');
              let nearest: DebugShip | null = null;
              let best = Number.POSITIVE_INFINITY;
              for (const candidate of shooters) {
                const gap = Math.hypot(candidate.x - shot.x, candidate.y - shot.y);
                if (gap < best) {
                  best = gap;
                  nearest = candidate;
                }
              }
              if (!nearest) return null;
              firstShot = { shooter: nearest, player: me, elapsed: state.elapsedSeconds, health: me.health };
            } else if (advanced >= 1000 && approachDistance === null) {
              const gunner = state.ships.find((ship) => ship.kind === 'shooter');
              if (gunner) approachDistance = Math.hypot(gunner.x - me.x, gunner.y - me.y);
            }
          } else if (me.health < firstShot.health) {
            hit = { health: me.health, elapsed: state.elapsedSeconds };
            break;
          }
        }
        return { startHealth, approachDistance, firstShot, hit };
      },
      { frameMs: FRAME_MS, maxMs: 25_000 },
    );

    if (!outcome) throw new Error('Battle runtime is not active');
    expect(outcome.approachDistance).not.toBeNull();
    expect(outcome.approachDistance ?? Number.POSITIVE_INFINITY).toBeLessThan(initialDistance);

    const shot = outcome.firstShot;
    if (!shot) throw new Error('Shooter never fired');
    const range = distanceBetween(shot.shooter, shot.player);
    expect(range).toBeLessThanOrEqual(SHOOTER.attackRange + 5);
    const aim = Math.atan2(shot.player.y - shot.shooter.y, shot.player.x - shot.shooter.x);
    expect(Math.abs(angleDelta(shot.shooter.heading, aim))).toBeLessThanOrEqual(SHOOTER.aimToleranceRadians + 0.05);
    expect(shot.health).toBe(outcome.startHealth);

    const hit = outcome.hit;
    if (!hit) throw new Error('Shooter never hit the player');
    const damage = shot.health - hit.health;
    expect(damage).toBeGreaterThan(0);
    expect(damage % SHOOTER.cannon.damage).toBe(0);
    await expect(page.getByTestId('hud-health')).toHaveAttribute('aria-valuenow', String(hit.health));
  });
});

test.describe('Enemy navigation', () => {
  test('never places an enemy inside an island across 30 s of play', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 2 } });
    const islands = (await battleState(page)).arena.obstacles;
    expect(islands.length).toBeGreaterThanOrEqual(4);

    const samples = await page.evaluate(
      ({ sampleMs, totalMs }) => {
        const api = window.__pirateBattle;
        if (!api) return [];
        const collected: { elapsed: number; enemies: DebugShip[] }[] = [];
        for (let advanced = 0; advanced < totalMs; advanced += sampleMs) {
          api.advance(sampleMs);
          const state = api.getState();
          if (!state) break;
          collected.push({
            elapsed: state.elapsedSeconds,
            enemies: state.ships.filter((ship) => ship.kind !== 'player'),
          });
          if (state.status !== 'running') break;
        }
        return collected;
      },
      { sampleMs: 250, totalMs: 30_000 },
    );

    const populated = samples.filter((sample) => sample.enemies.length > 0);
    expect(populated.length).toBeGreaterThanOrEqual(40);
    for (const sample of samples) {
      for (const enemy of sample.enemies) {
        expect(insideAnyIsland(enemy.x, enemy.y, islands, 10)).toBe(false);
      }
    }
  });
});

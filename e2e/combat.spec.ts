import { expect, test, type Page } from '@playwright/test';
import type { DebugShip, DebugState } from '../src/game/battleRuntime';
import type { ControlAction } from '../src/game/input/controls';
import { TEST_IDS } from '../src/testing/testIds';
import {
  advance,
  advanceInSteps,
  battleState,
  byTestId,
  enemies,
  player,
  press,
  release,
  releaseAll,
  startBattle,
} from './support/app';

const STEP_MS = 1000 / 60;
const ROTATION_STEP = 2.7 / 60;
const AIM_TOLERANCE = 0.05;
const HUNT_POLL_MS = 200;
const START = { x: 160, y: 544 };
const HALF_LENGTH = 32;
const FRONT_DAMAGE = 40;
const FRONT_COOLDOWN = 0.4;
const BROADSIDE_COUNT = 3;
const BROADSIDE_COOLDOWN = 1.2;
const CHASER_HEALTH = 50;
const SHOOTER_DAMAGE = 8;
const SPAWN_DELAY_MS = 3000;
const SPAWN_INTERVAL_MS = 3000;

function wrapAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function playerProjectiles(state: DebugState) {
  return state.projectiles.filter((projectile) => projectile.faction === 'player');
}

function enemyProjectiles(state: DebugState) {
  return state.projectiles.filter((projectile) => projectile.faction === 'enemy');
}

interface HuntResult {
  healthTrail: number[];
  scoreTrail: number[];
  destroyed: boolean;
}

async function huntEnemy(page: Page, targetId: number, maxMs: number): Promise<HuntResult> {
  const healthTrail: number[] = [];
  const scoreTrail: number[] = [];
  let destroyed = false;
  let turning: ControlAction | null = null;
  let firing = false;
  for (let elapsed = 0; elapsed < maxMs;) {
    const state = await battleState(page);
    const target = state.ships.find((ship) => ship.id === targetId);
    if (scoreTrail[scoreTrail.length - 1] !== state.score) scoreTrail.push(state.score);
    if (!target) {
      destroyed = true;
      break;
    }
    if (healthTrail[healthTrail.length - 1] !== target.health) healthTrail.push(target.health);
    const me = player(state);
    const desired = Math.atan2(target.y - me.y, target.x - me.x);
    const delta = wrapAngle(desired - me.heading);
    if (Math.abs(delta) < AIM_TOLERANCE) {
      if (turning) {
        await release(page, turning);
        turning = null;
      }
      if (!firing) {
        await press(page, 'fireFront');
        firing = true;
      }
      await advance(page, HUNT_POLL_MS);
      elapsed += HUNT_POLL_MS;
    } else {
      if (firing) {
        await release(page, 'fireFront');
        firing = false;
      }
      const action: ControlAction = delta < 0 ? 'turnLeft' : 'turnRight';
      if (turning !== action) {
        if (turning) await release(page, turning);
        await press(page, action);
        turning = action;
      }
      const steps = Math.min(6, Math.max(1, Math.floor(Math.abs(delta) / ROTATION_STEP)));
      await advance(page, steps * STEP_MS);
      elapsed += steps * STEP_MS;
    }
  }
  await releaseAll(page);
  return { healthTrail, scoreTrail, destroyed };
}

async function firstChaser(page: Page): Promise<DebugShip> {
  await advanceInSteps(page, SPAWN_DELAY_MS - 100);
  expect(enemies(await battleState(page))).toHaveLength(0);
  await advance(page, 150);
  const spawned = enemies(await battleState(page));
  expect(spawned).toHaveLength(1);
  const chaser = spawned[0];
  if (!chaser) throw new Error('Chaser did not spawn');
  expect(chaser.kind).toBe('chaser');
  expect(chaser.health).toBe(CHASER_HEALTH);
  return chaser;
}

test.describe('Combat', () => {
  test('front cannon fires one projectile per shot and respects its cooldown', async ({ page }) => {
    await startBattle(page);
    expect(playerProjectiles(await battleState(page))).toHaveLength(0);

    await press(page, 'fireFront');
    await advance(page, STEP_MS);
    const afterShot = await battleState(page);
    const first = playerProjectiles(afterShot);
    expect(first).toHaveLength(1);
    expect(afterShot.projectiles).toHaveLength(1);
    expect(first[0]?.x).toBeGreaterThan(START.x + HALF_LENGTH);
    expect(first[0]?.y).toBeCloseTo(START.y, 6);
    expect(afterShot.cooldowns.front).toBeGreaterThan(0);
    expect(afterShot.cooldowns.front).toBeLessThanOrEqual(FRONT_COOLDOWN);

    await advance(page, 200);
    const heldEarly = await battleState(page);
    expect(playerProjectiles(heldEarly)).toHaveLength(1);
    expect(playerProjectiles(heldEarly)[0]?.x).toBeGreaterThan(first[0]?.x ?? Number.POSITIVE_INFINITY);
    expect(heldEarly.cooldowns.front).toBeGreaterThan(0);

    await advance(page, 250);
    const afterCooldown = await battleState(page);
    expect(playerProjectiles(afterCooldown)).toHaveLength(2);
    expect(afterCooldown.cooldowns.front).toBeGreaterThan(0);
    await release(page, 'fireFront');

    await advanceInSteps(page, 1200, 400);
    const expired = await battleState(page);
    expect(playerProjectiles(expired)).toHaveLength(0);
    expect(expired.cooldowns.front).toBe(0);
    expect(player(expired)).toMatchObject({ x: START.x, y: START.y });
  });

  test('broadsides fire three projectiles per side and respect their cooldown', async ({ page }) => {
    await startBattle(page);
    await press(page, 'fireRight');
    await advance(page, STEP_MS);
    const volley = await battleState(page);
    const right = playerProjectiles(volley);
    expect(right).toHaveLength(BROADSIDE_COUNT);
    for (const projectile of right) expect(projectile.y).toBeGreaterThan(START.y);
    const xs = right.map((projectile) => projectile.x).sort((a, b) => a - b);
    expect((xs[2] ?? 0) - (xs[0] ?? 0)).toBeCloseTo(40, 3);
    expect(volley.cooldowns.right).toBeGreaterThan(0);
    expect(volley.cooldowns.right).toBeLessThanOrEqual(BROADSIDE_COOLDOWN);
    expect(volley.cooldowns.left).toBe(0);

    await advance(page, 600);
    const held = await battleState(page);
    expect(playerProjectiles(held)).toHaveLength(BROADSIDE_COUNT);
    for (const projectile of playerProjectiles(held)) expect(projectile.y).toBeGreaterThan(START.y + 200);

    await advance(page, 400);
    const expired = await battleState(page);
    expect(playerProjectiles(expired)).toHaveLength(0);
    expect(expired.cooldowns.right).toBeGreaterThan(0);

    await advance(page, 250);
    const second = await battleState(page);
    expect(playerProjectiles(second)).toHaveLength(BROADSIDE_COUNT);
    expect(second.cooldowns.right).toBeGreaterThan(BROADSIDE_COOLDOWN - 0.2);
    await release(page, 'fireRight');

    await press(page, 'fireLeft');
    await advance(page, STEP_MS);
    const both = await battleState(page);
    const left = playerProjectiles(both).filter((projectile) => projectile.y < START.y);
    expect(left).toHaveLength(BROADSIDE_COUNT);
    expect(playerProjectiles(both)).toHaveLength(BROADSIDE_COUNT * 2);
    expect(both.cooldowns.left).toBeGreaterThan(0);
    await release(page, 'fireLeft');
    await advance(page, 200);
    expect(playerProjectiles(await battleState(page))).toHaveLength(BROADSIDE_COUNT * 2);
    await advanceInSteps(page, 1000);
    expect(playerProjectiles(await battleState(page))).toHaveLength(0);
    expect(player(await battleState(page))).toMatchObject({ x: START.x, y: START.y, heading: 0 });
  });

  test('front cannon hits reduce chaser health by 40 and destroying it scores exactly once', async ({
    page,
  }) => {
    await startBattle(page);
    const chaser = await firstChaser(page);
    expect(Math.hypot(chaser.x - START.x, chaser.y - START.y)).toBeGreaterThan(200);
    await expect(byTestId(page, TEST_IDS.hudScore)).toContainText('0');

    const hunt = await huntEnemy(page, chaser.id, 8000);
    expect(hunt.destroyed).toBe(true);
    expect(hunt.healthTrail).toEqual([CHASER_HEALTH, CHASER_HEALTH - FRONT_DAMAGE]);
    expect(hunt.scoreTrail).toEqual([0, 1]);

    const afterKill = await battleState(page);
    expect(afterKill.score).toBe(1);
    expect(afterKill.ships.some((ship) => ship.id === chaser.id)).toBe(false);
    expect(player(afterKill).health).toBe(100);
    await expect(byTestId(page, TEST_IDS.hudScore)).toContainText('1');
    await expect(byTestId(page, TEST_IDS.hudHealth)).toHaveAttribute('aria-valuenow', '100');

    for (let elapsed = 0; elapsed < 1200; elapsed += 400) {
      await advance(page, 400);
      expect((await battleState(page)).score).toBe(1);
    }
    expect(playerProjectiles(await battleState(page))).toHaveLength(0);
    for (let elapsed = 0; elapsed < 2000; elapsed += 500) {
      await advance(page, 500);
      const state = await battleState(page);
      expect(state.score).toBe(1);
      expect(playerProjectiles(state)).toHaveLength(0);
    }
    await expect(byTestId(page, TEST_IDS.hudScore)).toContainText('1');
    await expect(byTestId(page, TEST_IDS.hudScore)).not.toContainText('2');
  });

  test('a chaser reaching the player explodes for 20 damage without scoring', async ({ page }) => {
    await startBattle(page);
    const chaser = await firstChaser(page);
    let impacted = false;
    for (let elapsed = 0; elapsed < 8000; elapsed += 250) {
      await advance(page, 250);
      const state = await battleState(page);
      if (!state.ships.some((ship) => ship.id === chaser.id)) {
        impacted = true;
        expect(player(state).health).toBe(80);
        expect(state.score).toBe(0);
        break;
      }
      expect(player(state).health).toBe(100);
    }
    expect(impacted).toBe(true);
    await expect(byTestId(page, TEST_IDS.hudHealth)).toHaveAttribute('aria-valuenow', '80');
    await expect(byTestId(page, TEST_IDS.hudScore)).toContainText('0');
  });

  test('shooter projectiles damage the player in multiples of 8', async ({ page }) => {
    await startBattle(page, { seed: 'delta' });
    const chaser = await firstChaser(page);
    const hunt = await huntEnemy(page, chaser.id, 8000);
    expect(hunt.destroyed).toBe(true);
    expect(player(await battleState(page)).health).toBe(100);

    const shooterSpawnMs = SPAWN_DELAY_MS + SPAWN_INTERVAL_MS;
    const now = (await battleState(page)).elapsedSeconds * 1000;
    if (now < shooterSpawnMs + 100) await advanceInSteps(page, shooterSpawnMs + 100 - now, 500);
    const shooters = enemies(await battleState(page)).filter((ship) => ship.kind === 'shooter');
    expect(shooters).toHaveLength(1);
    expect(shooters[0]?.health).toBe(80);

    let sawEnemyProjectile = false;
    let damaged: number | null = null;
    for (let elapsed = 0; elapsed < 10_000 && damaged === null; elapsed += 250) {
      await advance(page, 250);
      const state = await battleState(page);
      if (enemyProjectiles(state).length > 0) sawEnemyProjectile = true;
      const health = player(state).health;
      if (health < 100) damaged = health;
    }
    expect(sawEnemyProjectile).toBe(true);
    expect(damaged).not.toBeNull();
    const drop = 100 - (damaged ?? 100);
    expect(drop).toBeGreaterThan(0);
    expect(drop % SHOOTER_DAMAGE).toBe(0);
    await expect(byTestId(page, TEST_IDS.hudHealth)).toHaveAttribute('aria-valuenow', String(damaged));
    const state = await battleState(page);
    expect(state.score).toBe(1);
    expect(state.status).toBe('running');
    expect(enemies(state).filter((ship) => ship.kind === 'chaser')).toHaveLength(0);
  });
});

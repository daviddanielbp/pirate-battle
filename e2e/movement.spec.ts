import { expect, test, type Page } from '@playwright/test';
import type { DebugState } from '../src/game/battleRuntime';
import { TEST_IDS } from '../src/testing/testIds';
import {
  advance,
  advanceInSteps,
  battleState,
  byTestId,
  player,
  press,
  release,
  releaseAll,
  startBattle,
} from './support/app';

const STEP_MS = 1000 / 60;
const ARENA_WIDTH = 1856;
const ARENA_HEIGHT = 1024;
const CELL = 64;
const HITBOX_RADIUS = 21;
const HALF_LENGTH = 32;
const MAX_SPEED = 205;
const CRUISE_SPEED = 205;
const ROTATION_SPEED = 2.7;
const START = { x: 160, y: 544, heading: 0 };
const START_CLEARANCE_CELLS = 3;
const MIN_ISLANDS = 4;
const MAX_ISLANDS = 8;
const OPEN_WATER_SEED = 'north';
const LANE_MARGIN = HITBOX_RADIUS + HALF_LENGTH;

type RoundedRect = DebugState['arena']['obstacles'][number];

function maxXFor(heading: number): number {
  return ARENA_WIDTH - (Math.abs(Math.cos(heading)) * HALF_LENGTH + HITBOX_RADIUS);
}

function minYFor(heading: number): number {
  return Math.abs(Math.sin(heading)) * HALF_LENGTH + HITBOX_RADIUS;
}

function wrapAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function distanceToRoundedRect(px: number, py: number, rect: RoundedRect): number {
  const innerLeft = rect.x + rect.radius;
  const innerTop = rect.y + rect.radius;
  const innerRight = rect.x + rect.width - rect.radius;
  const innerBottom = rect.y + rect.height - rect.radius;
  const nearestX = Math.min(Math.max(px, innerLeft), innerRight);
  const nearestY = Math.min(Math.max(py, innerTop), innerBottom);
  return Math.hypot(px - nearestX, py - nearestY) - rect.radius;
}

function rectCenter(rect: RoundedRect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function laneIsClear(
  obstacles: readonly RoundedRect[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  margin: number,
  ignore?: RoundedRect,
): boolean {
  const samples = 200;
  for (let index = 0; index <= samples; index += 1) {
    const x = from.x + ((to.x - from.x) * index) / samples;
    const y = from.y + ((to.y - from.y) * index) / samples;
    for (const rect of obstacles) {
      if (rect === ignore) continue;
      if (distanceToRoundedRect(x, y, rect) < margin) return false;
    }
  }
  return true;
}

function nearestReachableObstacle(obstacles: readonly RoundedRect[]): RoundedRect {
  const sorted = [...obstacles].sort(
    (a, b) => distanceToRoundedRect(START.x, START.y, a) - distanceToRoundedRect(START.x, START.y, b),
  );
  const target = sorted.find((rect) => laneIsClear(obstacles, START, rectCenter(rect), LANE_MARGIN, rect));
  if (!target) throw new Error('No island is reachable in a straight line from the start');
  return target;
}

function expectOpenLane(
  state: DebugState,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  expect(laneIsClear(state.arena.obstacles, from, to, LANE_MARGIN)).toBe(true);
}

function expectGeneratedArena(state: DebugState): void {
  expect(state.arena.width).toBe(ARENA_WIDTH);
  expect(state.arena.height).toBe(ARENA_HEIGHT);
  const obstacles = state.arena.obstacles;
  expect(obstacles.length).toBeGreaterThanOrEqual(MIN_ISLANDS);
  expect(obstacles.length).toBeLessThanOrEqual(MAX_ISLANDS);
  const zone = {
    left: START.x - (START_CLEARANCE_CELLS + 0.5) * CELL,
    top: START.y - (START_CLEARANCE_CELLS + 0.5) * CELL,
    right: START.x + (START_CLEARANCE_CELLS + 0.5) * CELL,
    bottom: START.y + (START_CLEARANCE_CELLS + 0.5) * CELL,
  };
  for (const rect of obstacles) {
    expect(rect.x % CELL).toBe(0);
    expect(rect.y % CELL).toBe(0);
    expect(rect.width % CELL).toBe(0);
    expect(rect.height % CELL).toBe(0);
    expect(rect.radius).toBeGreaterThan(0);
    expect(rect.x).toBeGreaterThanOrEqual(CELL);
    expect(rect.y).toBeGreaterThanOrEqual(CELL);
    expect(rect.x + rect.width).toBeLessThanOrEqual(ARENA_WIDTH - CELL);
    expect(rect.y + rect.height).toBeLessThanOrEqual(ARENA_HEIGHT - CELL);
    const overlapsStartZone =
      rect.x < zone.right && rect.x + rect.width > zone.left && rect.y < zone.bottom && rect.y + rect.height > zone.top;
    expect(overlapsStartZone).toBe(false);
  }
}

async function turnTo(page: Page, target: number): Promise<void> {
  const initial = player(await battleState(page));
  const initialDelta = wrapAngle(target - initial.heading);
  const action = initialDelta < 0 ? 'turnLeft' : 'turnRight';
  const steps = Math.floor(Math.abs(initialDelta) / (ROTATION_SPEED / 60));
  if (steps > 0) {
    await press(page, action);
    await advance(page, steps * STEP_MS);
    await release(page, action);
  }
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const ship = player(await battleState(page));
    const delta = wrapAngle(target - ship.heading);
    if (Math.abs(delta) < 0.05) break;
    const correction = delta < 0 ? 'turnLeft' : 'turnRight';
    await press(page, correction);
    await advance(page, STEP_MS);
    await release(page, correction);
  }
  const ship = player(await battleState(page));
  expect(Math.abs(wrapAngle(target - ship.heading))).toBeLessThan(0.05);
}

test.describe('Battle start and movement', () => {
  test('starts with the player at the arena start position and a visible HUD', async ({ page }) => {
    await startBattle(page);
    const state = await battleState(page);
    expect(state.status).toBe('running');
    expect(state.clock).toBe('manual');
    expect(state.elapsedSeconds).toBe(0);
    expect(state.remainingSeconds).toBe(120);
    expect(state.score).toBe(0);
    expect(state.ships).toHaveLength(1);
    expect(state.projectiles).toHaveLength(0);
    expect(state.kills).toEqual({ chaser: 0, shooter: 0 });
    expectGeneratedArena(state);

    const ship = player(state);
    expect(ship.x).toBe(START.x);
    expect(ship.y).toBe(START.y);
    expect(ship.heading).toBe(START.heading);
    expect(ship.speed).toBe(0);
    expect(ship.health).toBe(100);
    expect(ship.maxHealth).toBe(100);

    await expect(byTestId(page, TEST_IDS.battleCanvas)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.hudScore)).toContainText('0');
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('02:00');
    await expect(byTestId(page, TEST_IDS.hudHealth)).toHaveAttribute('aria-valuenow', '100');
    await expect(byTestId(page, TEST_IDS.hudPause)).toBeEnabled();

    await advance(page, 1000);
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('01:59');
    const after = await battleState(page);
    expect(after.elapsedSeconds).toBeCloseTo(1, 5);
    expect(player(after)).toMatchObject({ x: START.x, y: START.y, heading: 0, speed: 0 });
  });

  test('sails forward along its heading and coasts to a stop when released', async ({ page }) => {
    await startBattle(page, { seed: OPEN_WATER_SEED });
    expectOpenLane(await battleState(page), START, { x: ARENA_WIDTH, y: START.y });
    await press(page, 'forward');
    await advance(page, 500);
    const midway = player(await battleState(page));
    expect(midway.x).toBeGreaterThan(START.x + 20);
    expect(midway.y).toBe(START.y);
    expect(midway.heading).toBe(0);
    expect(midway.speed).toBeGreaterThan(0);
    expect(midway.speed).toBeLessThanOrEqual(MAX_SPEED);

    await advance(page, 1500);
    const cruising = player(await battleState(page));
    expect(cruising.x).toBeGreaterThan(midway.x + 150);
    expect(cruising.y).toBe(START.y);
    expect(cruising.speed).toBeGreaterThan(CRUISE_SPEED * 0.9);
    expect(cruising.speed).toBeLessThanOrEqual(MAX_SPEED);

    await release(page, 'forward');
    await advanceInSteps(page, 4000);
    const stopped = player(await battleState(page));
    expect(stopped.speed).toBe(0);
    expect(stopped.x).toBeGreaterThan(cruising.x);
    await advance(page, 500);
    expect(player(await battleState(page)).x).toBe(stopped.x);
  });

  test('rotates counter-clockwise with turnLeft and clockwise with turnRight without moving', async ({
    page,
  }) => {
    await startBattle(page);
    await press(page, 'turnLeft');
    await advance(page, 500);
    await release(page, 'turnLeft');
    const left = player(await battleState(page));
    expect(left.heading).toBeLessThan(0);
    expect(Math.abs(left.heading + ROTATION_SPEED * 0.5)).toBeLessThan(0.05);
    expect(left.x).toBe(START.x);
    expect(left.y).toBe(START.y);
    expect(left.speed).toBe(0);

    await press(page, 'turnRight');
    await advance(page, 1000);
    await release(page, 'turnRight');
    const right = player(await battleState(page));
    expect(right.heading).toBeGreaterThan(0);
    expect(Math.abs(right.heading - ROTATION_SPEED * 0.5)).toBeLessThan(0.1);
    expect(right.x).toBe(START.x);
    expect(right.y).toBe(START.y);

    await press(page, 'turnLeft');
    await press(page, 'turnRight');
    await advance(page, 500);
    await releaseAll(page);
    expect(player(await battleState(page)).heading).toBeCloseTo(right.heading, 6);
  });

  test('moves along a rotated heading in both axes', async ({ page }) => {
    await startBattle(page);
    await turnTo(page, Math.PI / 4);
    const heading = player(await battleState(page)).heading;
    await press(page, 'forward');
    await advance(page, 1000);
    await release(page, 'forward');
    const ship = player(await battleState(page));
    const dx = ship.x - START.x;
    const dy = ship.y - START.y;
    expect(dx).toBeGreaterThan(50);
    expect(dy).toBeGreaterThan(50);
    expect(Math.atan2(dy, dx)).toBeCloseTo(heading, 3);
  });

  test('responds to keyboard bindings for forward and turning', async ({ page }) => {
    await startBattle(page);
    await page.keyboard.down('KeyW');
    await advance(page, 1000);
    await page.keyboard.up('KeyW');
    const moved = player(await battleState(page));
    expect(moved.x).toBeGreaterThan(START.x + 60);
    expect(moved.y).toBe(START.y);

    await advanceInSteps(page, 4000);
    const rested = player(await battleState(page));
    expect(rested.speed).toBe(0);

    await page.keyboard.down('KeyA');
    await advance(page, 500);
    await page.keyboard.up('KeyA');
    const left = player(await battleState(page));
    expect(left.heading).toBeLessThan(-1);
    expect(left.x).toBe(rested.x);

    await page.keyboard.down('KeyD');
    await advance(page, 1000);
    await page.keyboard.up('KeyD');
    const right = player(await battleState(page));
    expect(right.heading).toBeGreaterThan(1);

    await page.keyboard.down('ArrowLeft');
    await advance(page, 1000);
    await page.keyboard.up('ArrowLeft');
    expect(Math.abs(player(await battleState(page)).heading - (right.heading - ROTATION_SPEED))).toBeLessThan(
      0.1,
    );

    await advance(page, 500);
    expect(player(await battleState(page)).x).toBe(rested.x);
  });

  test('is clamped to the arena edges on the right and top', async ({ page }) => {
    await startBattle(page, { seed: OPEN_WATER_SEED });
    const maxX = maxXFor(START.heading);
    const initial = await battleState(page);
    expectOpenLane(initial, START, { x: ARENA_WIDTH, y: START.y });
    expectOpenLane(initial, { x: maxX, y: START.y }, { x: maxX, y: 0 });
    await press(page, 'forward');
    for (let elapsed = 0; elapsed < 10_000; elapsed += 500) {
      await advance(page, 500);
      const ship = player(await battleState(page));
      expect(ship.x).toBeLessThanOrEqual(maxX + 0.001);
      expect(ship.y).toBe(START.y);
    }
    await release(page, 'forward');
    const atWall = player(await battleState(page));
    expect(atWall.x).toBeCloseTo(maxX, 3);
    expect(atWall.speed).toBeLessThan(CRUISE_SPEED * 0.2);

    await turnTo(page, -Math.PI / 2);
    await press(page, 'forward');
    for (let elapsed = 0; elapsed < 6000; elapsed += 500) {
      await advance(page, 500);
      const ship = player(await battleState(page));
      expect(ship.y).toBeGreaterThanOrEqual(minYFor(ship.heading) - 0.001);
      expect(ship.x).toBeLessThanOrEqual(maxXFor(ship.heading) + 0.001);
      expect(ship.x).toBeGreaterThan(maxX - HALF_LENGTH);
    }
    await release(page, 'forward');
    const atTop = player(await battleState(page));
    expect(atTop.y).toBeCloseTo(minYFor(atTop.heading), 3);
    expect(atTop.y).toBeGreaterThanOrEqual(HITBOX_RADIUS);
    expect(atTop.speed).toBeLessThan(CRUISE_SPEED * 0.2);
  });

  test('stops against an island instead of sailing through it', async ({ page }) => {
    await startBattle(page);
    const obstacles = (await battleState(page)).arena.obstacles;
    const island = nearestReachableObstacle(obstacles);
    const target = rectCenter(island);
    const approach = Math.atan2(target.y - START.y, target.x - START.x);
    await turnTo(page, approach);

    let closest = Number.POSITIVE_INFINITY;
    let topSpeed = 0;
    await press(page, 'forward');
    for (let elapsed = 0; elapsed < 8000; elapsed += 250) {
      await advance(page, 250);
      const ship = player(await battleState(page));
      const bowX = ship.x + Math.cos(ship.heading) * HALF_LENGTH;
      const bowY = ship.y + Math.sin(ship.heading) * HALF_LENGTH;
      for (const rect of obstacles) {
        expect(distanceToRoundedRect(ship.x, ship.y, rect)).toBeGreaterThanOrEqual(HITBOX_RADIUS - 0.01);
        expect(distanceToRoundedRect(bowX, bowY, rect)).toBeGreaterThanOrEqual(HITBOX_RADIUS - 0.01);
      }
      closest = Math.min(closest, distanceToRoundedRect(bowX, bowY, island));
      topSpeed = Math.max(topSpeed, ship.speed);
    }
    const blocked = player(await battleState(page));
    await release(page, 'forward');

    expect(topSpeed).toBeGreaterThan(150);
    expect(closest).toBeLessThan(HITBOX_RADIUS + 1);
    expect(distanceToRoundedRect(blocked.x, blocked.y, island)).toBeLessThan(HITBOX_RADIUS + HALF_LENGTH + 5);
    expect(blocked.speed).toBeLessThan(40);
    expect(Math.hypot(blocked.x - START.x, blocked.y - START.y)).toBeLessThan(
      Math.hypot(target.x - START.x, target.y - START.y),
    );
  });

  test('generates a different island layout per seed and the same layout for the same seed', async ({
    context,
  }) => {
    const layoutFor = async (seed: string) => {
      const page = await context.newPage();
      await startBattle(page, { seed });
      const state = await battleState(page);
      expectGeneratedArena(state);
      expect(player(state)).toMatchObject(START);
      await page.close();
      return state.arena.obstacles;
    };
    const alpha = await layoutFor('alpha');
    const beta = await layoutFor('beta');
    const alphaAgain = await layoutFor('alpha');
    expect(alphaAgain).toEqual(alpha);
    expect(beta).not.toEqual(alpha);
  });

  test('produces identical results for the same seed and scripted inputs', async ({ context }) => {
    const script = async (page: Page) => {
      await startBattle(page, { seed: 'determinism' });
      await press(page, 'forward');
      await press(page, 'turnRight');
      await advanceInSteps(page, 700, 100);
      await release(page, 'turnRight');
      await advanceInSteps(page, 1500, 300);
      await press(page, 'fireFront');
      await advance(page, 100);
      await release(page, 'fireFront');
      await press(page, 'turnLeft');
      await advanceInSteps(page, 2500, 500);
      await releaseAll(page);
      await press(page, 'fireLeft');
      await advance(page, 100);
      await release(page, 'fireLeft');
      await advanceInSteps(page, 2000, 500);
      return battleState(page);
    };

    const first = await context.newPage();
    const stateA = await script(first);
    await first.close();
    const second = await context.newPage();
    const stateB = await script(second);
    expect(stateA.elapsedSeconds).toBeCloseTo(6.9, 1);
    expect(stateA.ships.length).toBeGreaterThan(1);
    expect(stateA.ships).toEqual(stateB.ships);
    expect(stateA.projectiles).toEqual(stateB.projectiles);
    expect(stateA.score).toBe(stateB.score);
    expect(stateA.elapsedSeconds).toBe(stateB.elapsedSeconds);
    expect(player(stateA)).not.toMatchObject({ x: START.x, y: START.y });
    await second.close();
  });
});

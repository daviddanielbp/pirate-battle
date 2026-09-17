import { expect, test, type Page } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import {
  advance,
  advanceInSteps,
  battleState,
  byTestId,
  openMenu,
  player,
  press,
  readStorage,
  releaseAll,
  startBattle,
  STORAGE,
  type StoredOptions,
} from './support/app';

const ARENA_WIDTH = 1856;
const ARENA_HEIGHT = 1024;
const ROTATION_SPEED = 2.7;
const STEP_MS = 1000 / 60;
const HALF_LENGTH = 32;
const START = { x: 160, y: 544, heading: 0 };
const ABOVE_PLAYER = { x: START.x, y: 96 };
const RIGHT_OF_PLAYER = { x: START.x + 640, y: START.y };
const MOUSE_OPTIONS: StoredOptions = { sessionSeconds: 60, spawnIntervalSeconds: 3, steering: 'mouse' };
const KEYBOARD_OPTIONS: StoredOptions = { sessionSeconds: 60, spawnIntervalSeconds: 3, steering: 'keyboard' };
const POINTER_SETTLE_MS = 100;

function wrapAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

async function screenPoint(page: Page, arena: { x: number; y: number }): Promise<{ x: number; y: number }> {
  const box = await byTestId(page, TEST_IDS.battleCanvas).boundingBox();
  if (!box) throw new Error('Battle canvas has no layout box');
  const scale = Math.min(box.width / ARENA_WIDTH, box.height / ARENA_HEIGHT);
  const offsetX = (box.width - ARENA_WIDTH * scale) / 2;
  const offsetY = (box.height - ARENA_HEIGHT * scale) / 2;
  return { x: box.x + offsetX + arena.x * scale, y: box.y + offsetY + arena.y * scale };
}

async function pointAt(page: Page, arena: { x: number; y: number }): Promise<void> {
  const point = await screenPoint(page, arena);
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(POINTER_SETTLE_MS);
}

test.describe('Steering options', () => {
  test('persists the steering mode after a refresh and defaults to keyboard', async ({ page }) => {
    await openMenu(page, { options: { sessionSeconds: 90, spawnIntervalSeconds: 4 } });
    await byTestId(page, TEST_IDS.menuOptions).click();
    const select = byTestId(page, TEST_IDS.optionsSteering);
    await expect(select).toHaveValue('keyboard');

    await select.selectOption('mouse');
    await expect(select).toHaveValue('mouse');
    await byTestId(page, TEST_IDS.optionsSave).click();
    await expect(page.getByText('Options saved.')).toBeVisible();
    expect(await readStorage<StoredOptions>(page, STORAGE.options)).toEqual({
      sessionSeconds: 90,
      spawnIntervalSeconds: 4,
      steering: 'mouse',
    });

    await page.reload();
    await byTestId(page, TEST_IDS.splashStart).click();
    await byTestId(page, TEST_IDS.menuOptions).click();
    await expect(byTestId(page, TEST_IDS.optionsSteering)).toHaveValue('mouse');
    await expect(byTestId(page, TEST_IDS.optionsSession)).toHaveAttribute('aria-valuenow', '90');

    await byTestId(page, TEST_IDS.optionsSteering).selectOption('keyboard');
    await byTestId(page, TEST_IDS.optionsSave).click();
    await expect(page.getByText('Options saved.')).toBeVisible();
    expect(await readStorage<StoredOptions>(page, STORAGE.options)).toMatchObject({ steering: 'keyboard' });
  });
});

test.describe('Mouse steering', () => {
  test('turns the ship toward the pointer at the rotation speed', async ({ page }) => {
    await startBattle(page, { options: MOUSE_OPTIONS });
    expect(player(await battleState(page))).toMatchObject(START);

    await pointAt(page, ABOVE_PLAYER);
    await advance(page, 100);
    const partial = player(await battleState(page));
    expect(partial.heading).toBeLessThan(0);
    expect(Math.abs(partial.heading)).toBeLessThanOrEqual(ROTATION_SPEED * 0.1 + 0.01);
    expect(partial.x).toBe(START.x);
    expect(partial.y).toBe(START.y);
    expect(partial.speed).toBe(0);

    await advance(page, 1000);
    const aligned = player(await battleState(page));
    expect(Math.abs(wrapAngle(-Math.PI / 2 - aligned.heading))).toBeLessThan(0.05);
    expect(aligned.x).toBe(START.x);
    expect(aligned.y).toBe(START.y);
    expect(aligned.speed).toBe(0);

    await pointAt(page, RIGHT_OF_PLAYER);
    await advance(page, 100);
    const turningBack = player(await battleState(page));
    expect(turningBack.heading).toBeGreaterThan(aligned.heading);
    expect(turningBack.heading - aligned.heading).toBeLessThanOrEqual(ROTATION_SPEED * 0.1 + 0.01);
    await advance(page, 1000);
    expect(Math.abs(player(await battleState(page)).heading)).toBeLessThan(0.05);
  });

  test('the left mouse button fires the front cannon while W sails', async ({ page }) => {
    await startBattle(page, { options: MOUSE_OPTIONS });
    await pointAt(page, RIGHT_OF_PLAYER);
    await advance(page, 500);
    const still = player(await battleState(page));
    expect(still.speed).toBe(0);
    expect(still).toMatchObject({ x: START.x, y: START.y });
    expect((await battleState(page)).projectiles).toHaveLength(0);

    await page.mouse.down();
    await advance(page, STEP_MS);
    const fired = await battleState(page);
    expect(fired.projectiles).toHaveLength(1);
    expect(fired.projectiles[0]?.faction).toBe('player');
    expect(fired.projectiles[0]?.x).toBeGreaterThan(START.x + HALF_LENGTH);
    expect(fired.cooldowns.front).toBeGreaterThan(0);
    expect(player(fired)).toMatchObject({ x: START.x, y: START.y, speed: 0 });

    await advance(page, 450);
    expect((await battleState(page)).projectiles).toHaveLength(2);
    await page.mouse.up();
    await advanceInSteps(page, 1500);
    const released = await battleState(page);
    expect(released.projectiles).toHaveLength(0);
    expect(released.cooldowns.front).toBe(0);
    expect(player(released)).toMatchObject({ x: START.x, y: START.y, speed: 0 });

    await page.keyboard.down('KeyW');
    await advance(page, 1000);
    await page.keyboard.up('KeyW');
    const sailing = player(await battleState(page));
    expect(sailing.speed).toBeGreaterThan(100);
    expect(sailing.x).toBeGreaterThan(START.x + 60);
    expect(Math.abs(sailing.y - START.y)).toBeLessThan(1);
    expect(Math.abs(sailing.heading)).toBeLessThan(0.05);

    await advanceInSteps(page, 5000);
    expect(player(await battleState(page)).speed).toBe(0);
  });

  test('ignores the keyboard turn keys and keeps Space, Q and E for the cannons', async ({ page }) => {
    await startBattle(page, { options: MOUSE_OPTIONS });
    await pointAt(page, RIGHT_OF_PLAYER);
    await page.keyboard.down('KeyA');
    await advance(page, 500);
    await page.keyboard.up('KeyA');
    const unturned = player(await battleState(page));
    expect(Math.abs(unturned.heading)).toBeLessThan(0.01);
    expect(unturned).toMatchObject({ x: START.x, y: START.y, speed: 0 });

    await press(page, 'turnRight');
    await advance(page, 500);
    await releaseAll(page);
    expect(player(await battleState(page)).heading).toBeGreaterThan(1);
    await advance(page, 1000);
    expect(Math.abs(player(await battleState(page)).heading)).toBeLessThan(0.05);

    await page.keyboard.down('Space');
    await advance(page, STEP_MS);
    await page.keyboard.up('Space');
    const front = await battleState(page);
    expect(front.projectiles).toHaveLength(1);
    expect(front.cooldowns.front).toBeGreaterThan(0);

    await page.keyboard.down('KeyQ');
    await advance(page, STEP_MS);
    await page.keyboard.up('KeyQ');
    const port = await battleState(page);
    expect(port.projectiles).toHaveLength(4);
    expect(port.cooldowns.left).toBeGreaterThan(0);

    await page.keyboard.down('KeyE');
    await advance(page, STEP_MS);
    await page.keyboard.up('KeyE');
    const starboard = await battleState(page);
    expect(starboard.projectiles).toHaveLength(7);
    expect(starboard.cooldowns.right).toBeGreaterThan(0);
  });
});

test.describe('Keyboard steering', () => {
  test('ignores the pointer for heading and sailing', async ({ page }) => {
    await startBattle(page, { options: KEYBOARD_OPTIONS });
    await pointAt(page, ABOVE_PLAYER);
    await advance(page, 1000);
    expect(player(await battleState(page))).toMatchObject(START);

    await page.mouse.down();
    await advance(page, 1000);
    await page.mouse.up();
    const after = await battleState(page);
    expect(player(after)).toMatchObject({ x: START.x, y: START.y, heading: START.heading, speed: 0 });
    expect(after.projectiles).toHaveLength(0);
    expect(after.cooldowns.front).toBe(0);

    await page.keyboard.down('KeyA');
    await advance(page, 500);
    await page.keyboard.up('KeyA');
    expect(player(await battleState(page)).heading).toBeLessThan(-1);
  });
});

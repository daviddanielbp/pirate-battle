import { expect, test, type Page } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import { DEFAULT_GAMEPLAY_CONFIG } from '../src/game/config/gameplayConfig';
import { advance, battleState, byTestId, player, press, release, startBattle } from './support/app';

const FRAME_MS = 1000 / 60;
const OPTIONS = { sessionSeconds: 60, spawnIntervalSeconds: 10 };
const FOCUS_MESSAGE = 'The battle paused while the window was away.';

async function blurWindow(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
}

async function setVisibility(page: Page, value: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}

async function expectPaused(page: Page): Promise<void> {
  await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeVisible();
  await expect(byTestId(page, TEST_IDS.hudStatus)).toContainText('Paused');
  expect((await battleState(page)).status).toBe('paused');
}

async function expectRunning(page: Page): Promise<void> {
  await expect(byTestId(page, TEST_IDS.pauseDialog)).toHaveCount(0);
  await expect(byTestId(page, TEST_IDS.hudStatus)).toContainText('In battle');
  expect((await battleState(page)).status).toBe('running');
}

test.describe('Pause', () => {
  test('pauses from the HUD button and keeps the clock frozen while advancing time', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    await advance(page, 2500);
    const before = await battleState(page);
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('00:58');

    await byTestId(page, TEST_IDS.hudPause).click();
    await expectPaused(page);
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toContainText('Ready when you are.');

    await advance(page, 5000);
    const paused = await battleState(page);
    expect(paused.status).toBe('paused');
    expect(paused.elapsedSeconds).toBe(before.elapsedSeconds);
    expect(paused.remainingSeconds).toBe(before.remainingSeconds);
    expect(paused.ships).toEqual(before.ships);
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('00:58');
    await expect(byTestId(page, TEST_IDS.hudPause)).toBeDisabled();
  });

  test('pauses with the Escape key and resumes only through the dialog button', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    await advance(page, 1500);
    const before = await battleState(page);

    await page.keyboard.press('Escape');
    await expectPaused(page);

    await advance(page, 5000);
    await page.keyboard.press('Escape');
    await advance(page, 5000);
    await expectPaused(page);
    expect((await battleState(page)).elapsedSeconds).toBe(before.elapsedSeconds);

    await byTestId(page, TEST_IDS.pauseResume).click();
    await expectRunning(page);
    const resumed = await battleState(page);
    expect(resumed.elapsedSeconds).toBe(before.elapsedSeconds);

    await advance(page, 1000);
    const later = await battleState(page);
    expect(later.elapsedSeconds).toBeCloseTo(before.elapsedSeconds + 1, 1);
    expect(later.elapsedSeconds).toBeGreaterThan(before.elapsedSeconds);
  });

  test('suspends weapon cooldowns while paused', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    await press(page, 'fireFront');
    await advance(page, FRAME_MS);
    await release(page, 'fireFront');
    const fired = await battleState(page);
    expect(fired.projectiles).toHaveLength(1);
    expect(fired.cooldowns.front).toBeCloseTo(DEFAULT_GAMEPLAY_CONFIG.player.frontCannon.cooldownSeconds, 5);

    await byTestId(page, TEST_IDS.hudPause).click();
    await expectPaused(page);
    await advance(page, 2000);
    expect((await battleState(page)).cooldowns.front).toBe(fired.cooldowns.front);

    await byTestId(page, TEST_IDS.pauseResume).click();
    await expectRunning(page);
    const resumed = await battleState(page);
    expect(resumed.cooldowns.front).toBe(fired.cooldowns.front);
    expect(resumed.cooldowns.front).toBeGreaterThan(0);
    expect(resumed.projectiles.map((projectile) => projectile.id)).toEqual(
      fired.projectiles.map((projectile) => projectile.id),
    );

    await advance(page, FRAME_MS);
    const stepped = await battleState(page);
    expect(stepped.cooldowns.front).toBeGreaterThan(0);
    expect(stepped.cooldowns.front).toBeLessThan(fired.cooldowns.front);
  });

  test('discards controls held across a pause', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    const before = await battleState(page);
    const start = player(before);
    expect(start.speed).toBe(0);

    await press(page, 'forward');
    await press(page, 'fireFront');
    await byTestId(page, TEST_IDS.hudPause).click();
    await expectPaused(page);
    await advance(page, 3000);

    await byTestId(page, TEST_IDS.pauseResume).click();
    await expectRunning(page);
    await advance(page, FRAME_MS);
    const after = await battleState(page);
    const pilot = player(after);
    expect(pilot.x).toBe(start.x);
    expect(pilot.y).toBe(start.y);
    expect(pilot.speed).toBe(0);
    expect(after.projectiles).toEqual([]);
    expect(after.cooldowns.front).toBe(0);
    expect(after.elapsedSeconds).toBeCloseTo(before.elapsedSeconds + 1 / 60, 5);
  });

  test('auto-pauses when the window loses focus', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    await advance(page, 2500);
    const before = await battleState(page);

    await blurWindow(page);
    await expectPaused(page);
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toContainText(FOCUS_MESSAGE);

    await advance(page, 5000);
    await expectPaused(page);
    expect((await battleState(page)).elapsedSeconds).toBe(before.elapsedSeconds);
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('00:58');

    await byTestId(page, TEST_IDS.pauseResume).click();
    await expectRunning(page);
    expect((await battleState(page)).elapsedSeconds).toBe(before.elapsedSeconds);
    await advance(page, 1000);
    expect((await battleState(page)).elapsedSeconds).toBeCloseTo(before.elapsedSeconds + 1, 1);
  });

  test('auto-pauses when the tab becomes hidden', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    await advance(page, 2500);
    const before = await battleState(page);

    await setVisibility(page, 'hidden');
    await expectPaused(page);
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toContainText(FOCUS_MESSAGE);
    await setVisibility(page, 'visible');
    await expectPaused(page);

    await advance(page, 5000);
    await expectPaused(page);
    expect((await battleState(page)).elapsedSeconds).toBe(before.elapsedSeconds);

    await byTestId(page, TEST_IDS.pauseResume).click();
    await expectRunning(page);
    expect((await battleState(page)).elapsedSeconds).toBe(before.elapsedSeconds);
  });

  test('opens the options form inside the dialog and returns to the pause menu', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    await advance(page, 1000);
    const before = await battleState(page);

    await byTestId(page, TEST_IDS.hudPause).click();
    await expectPaused(page);
    await byTestId(page, TEST_IDS.pauseOptions).click();
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.optionsSession)).toHaveAttribute('aria-valuenow', '60');
    await expect(byTestId(page, TEST_IDS.optionsSpawn)).toHaveAttribute('aria-valuenow', '10');
    await expect(byTestId(page, TEST_IDS.pauseResume)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.screenBattle)).toBeVisible();

    await byTestId(page, TEST_IDS.optionsBack).click();
    await expect(byTestId(page, TEST_IDS.pauseResume)).toBeVisible();
    await expectPaused(page);
    expect((await battleState(page)).elapsedSeconds).toBe(before.elapsedSeconds);
  });

  test('cancelling the main menu confirmation keeps the battle paused', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    await advance(page, 1000);
    const before = await battleState(page);

    await byTestId(page, TEST_IDS.hudPause).click();
    await expectPaused(page);
    await byTestId(page, TEST_IDS.pauseMainMenu).click();
    await expect(byTestId(page, TEST_IDS.confirmDialog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.confirmAccept)).toBeVisible();

    await byTestId(page, TEST_IDS.confirmCancel).click();
    await expect(byTestId(page, TEST_IDS.confirmDialog)).toHaveCount(0);
    await expectPaused(page);
    await expect(byTestId(page, TEST_IDS.screenBattle)).toBeVisible();
    expect((await battleState(page)).elapsedSeconds).toBe(before.elapsedSeconds);

    await byTestId(page, TEST_IDS.pauseResume).click();
    await expectRunning(page);
  });

  test('moves keyboard focus into the dialog and ignores gameplay keys while paused', async ({ page }) => {
    await startBattle(page, { options: OPTIONS });
    await byTestId(page, TEST_IDS.hudPause).click();
    await expectPaused(page);
    await expect(byTestId(page, TEST_IDS.pauseResume)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(byTestId(page, TEST_IDS.pauseOptions)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(byTestId(page, TEST_IDS.pauseMainMenu)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(byTestId(page, TEST_IDS.pauseResume)).toBeFocused();

    await byTestId(page, TEST_IDS.pauseDialog).focus();
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('KeyW');
    await expectPaused(page);
    expect((await battleState(page)).projectiles).toEqual([]);

    await byTestId(page, TEST_IDS.pauseResume).click();
    await expectRunning(page);
    await advance(page, FRAME_MS);
    const after = await battleState(page);
    expect(after.projectiles).toEqual([]);
    expect(after.cooldowns.front).toBe(0);
    expect(player(after).speed).toBe(0);
  });
});

import { expect, test, type Locator, type Page } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import { CONTROL_GUIDE } from '../src/game/input/controls';
import {
  advance,
  battleState,
  byTestId,
  collectConsoleErrors,
  openMenu,
  player,
  readStorage,
  startBattle,
  STORAGE,
  waitForBattle,
} from './support/app';

const TOUCH_POINTER = { pointerId: 1, button: 0, isPrimary: true, pointerType: 'touch' };

async function abandonBattle(page: Page): Promise<void> {
  await byTestId(page, TEST_IDS.hudPause).click();
  await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeVisible();
  await byTestId(page, TEST_IDS.pauseMainMenu).click();
  await expect(byTestId(page, TEST_IDS.confirmDialog)).toBeVisible();
  await byTestId(page, TEST_IDS.confirmAccept).click();
  await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
  await expect(byTestId(page, TEST_IDS.screenBattle)).toHaveCount(0);
  expect(await page.evaluate(() => window.__pirateBattle?.hasBattle() ?? false)).toBe(false);
}

async function playFromMenu(page: Page): Promise<void> {
  await byTestId(page, TEST_IDS.menuPlay).click();
  await waitForBattle(page);
}

async function expectEmptyHistory(page: Page): Promise<void> {
  await byTestId(page, TEST_IDS.menuHistory).click();
  await expect(byTestId(page, TEST_IDS.screenLog)).toBeVisible();
  await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
  await expect(byTestId(page, TEST_IDS.logEmpty)).toHaveText('You have not completed a battle yet.');
  await expect(byTestId(page, TEST_IDS.logPanelHistory).getByTestId(TEST_IDS.logRow)).toHaveCount(0);
  await expect(byTestId(page, TEST_IDS.logPendingRow)).toHaveCount(0);
}

async function expectNothingRecorded(page: Page): Promise<void> {
  expect(await readStorage<unknown>(page, STORAGE.lastResult)).toBeNull();
  expect(await readStorage<unknown>(page, STORAGE.pending)).toBeNull();
  expect(await readStorage<unknown>(page, STORAGE.screen)).toBeNull();
}

async function holdWhileAdvancing(page: Page, button: Locator, milliseconds: number): Promise<void> {
  await button.dispatchEvent('pointerdown', TOUCH_POINTER);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await advance(page, milliseconds);
  await button.dispatchEvent('pointerup', TOUCH_POINTER);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
}

test.describe('Abandoning a battle', () => {
  test('leaves to the menu through the pause dialog without recording anything', async ({ page }) => {
    await startBattle(page);
    await advance(page, 2000);
    expect((await battleState(page)).elapsedSeconds).toBeGreaterThan(1.9);

    await byTestId(page, TEST_IDS.hudPause).click();
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeVisible();
    expect((await battleState(page)).status).toBe('paused');
    await byTestId(page, TEST_IDS.pauseMainMenu).click();
    await expect(byTestId(page, TEST_IDS.confirmDialog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.confirmAccept)).toBeFocused();

    await byTestId(page, TEST_IDS.confirmCancel).click();
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.confirmDialog)).toHaveCount(0);
    await byTestId(page, TEST_IDS.pauseMainMenu).click();
    await byTestId(page, TEST_IDS.confirmAccept).click();

    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.screenBattle)).toHaveCount(0);
    await expectNothingRecorded(page);

    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logPanelRanking)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logPanelRanking).getByTestId(TEST_IDS.logRow).first()).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logPanelRanking).getByText('You', { exact: true })).toHaveCount(0);
    await byTestId(page, TEST_IDS.logMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();

    await expectEmptyHistory(page);
  });

  test('a reload during a battle boots to the splash and the match is discarded', async ({ page }) => {
    await startBattle(page);
    await advance(page, 3000);
    expect((await battleState(page)).elapsedSeconds).toBeGreaterThan(2.9);

    await page.reload();
    await expect(byTestId(page, TEST_IDS.screenSplash)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.screenBattle)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.screenResult)).toHaveCount(0);
    expect(await page.evaluate(() => window.__pirateBattle?.hasBattle() ?? false)).toBe(false);

    await byTestId(page, TEST_IDS.splashStart).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await expect(page.getByText('waiting to be recorded')).toHaveCount(0);
    await expectNothingRecorded(page);
    await expectEmptyHistory(page);
  });
});

test.describe('Repeated navigation', () => {
  test('cycles through every screen three times without console errors', async ({ page }) => {
    test.slow();
    const errors = collectConsoleErrors(page);
    await openMenu(page);

    for (let loop = 0; loop < 3; loop += 1) {
      await byTestId(page, TEST_IDS.menuOptions).click();
      await expect(byTestId(page, TEST_IDS.screenOptions)).toBeVisible();
      await byTestId(page, TEST_IDS.optionsBack).click();
      await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();

      await byTestId(page, TEST_IDS.menuRanking).click();
      await expect(byTestId(page, TEST_IDS.screenLog)).toBeVisible();
      await expect(byTestId(page, TEST_IDS.logPanelRanking)).toBeVisible();
      await byTestId(page, TEST_IDS.logMainMenu).click();
      await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();

      await byTestId(page, TEST_IDS.menuHistory).click();
      await expect(byTestId(page, TEST_IDS.screenLog)).toBeVisible();
      await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
      await byTestId(page, TEST_IDS.logMainMenu).click();
      await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();

      for (let round = 0; round < 2; round += 1) {
        await playFromMenu(page);
        await advance(page, 500);
        await abandonBattle(page);
      }
    }

    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await expectNothingRecorded(page);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the menu lists the six control rows', async ({ page }) => {
    await openMenu(page);
    const controls = byTestId(page, TEST_IDS.menuControls);
    await expect(controls).toBeVisible();
    await expect(controls.getByRole('heading', { level: 2, name: 'Controls' })).toBeVisible();
    const terms = controls.getByRole('term');
    await expect(terms).toHaveCount(6);
    await expect(terms).toHaveText(CONTROL_GUIDE.map((entry) => entry.action));
    for (const entry of CONTROL_GUIDE) {
      await expect(controls.getByText(entry.keys, { exact: true })).toBeVisible();
      await expect(controls.getByText(entry.touch, { exact: true })).toBeVisible();
    }
  });

  test('the menu is operable with the keyboard', async ({ page }) => {
    await openMenu(page);
    await expect(byTestId(page, TEST_IDS.menuPlay)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(byTestId(page, TEST_IDS.menuOptions)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(byTestId(page, TEST_IDS.screenOptions)).toBeVisible();
    await byTestId(page, TEST_IDS.optionsBack).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();

    await expect(byTestId(page, TEST_IDS.menuPlay)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(byTestId(page, TEST_IDS.menuShipyard)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(byTestId(page, TEST_IDS.screenShipyard)).toBeVisible();
    await byTestId(page, TEST_IDS.shipyardBack).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();

    await expect(byTestId(page, TEST_IDS.menuPlay)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(byTestId(page, TEST_IDS.menuRanking)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(byTestId(page, TEST_IDS.screenLog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logTabRanking)).toHaveAttribute('aria-selected', 'true');
    await byTestId(page, TEST_IDS.logMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();

    await expect(byTestId(page, TEST_IDS.menuPlay)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(byTestId(page, TEST_IDS.menuHistory)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(byTestId(page, TEST_IDS.screenLog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logTabHistory)).toHaveAttribute('aria-selected', 'true');
    await byTestId(page, TEST_IDS.logMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();

    await expect(byTestId(page, TEST_IDS.menuPlay)).toBeFocused();
    await page.keyboard.press('Enter');
    await waitForBattle(page);
  });
});

test.describe('Touch controls', () => {
  test('buttons have accessible names and are grouped', async ({ page }) => {
    await startBattle(page, { touch: true });
    await expect(page.getByRole('group', { name: 'Touch controls' })).toBeVisible();
    const expected: [string, string][] = [
      [TEST_IDS.touchForward, 'Sail forward'],
      [TEST_IDS.touchTurnLeft, 'Turn left'],
      [TEST_IDS.touchTurnRight, 'Turn right'],
      [TEST_IDS.touchFireFront, 'Fire front cannon'],
      [TEST_IDS.touchFireLeft, 'Fire port broadside'],
      [TEST_IDS.touchFireRight, 'Fire starboard broadside'],
    ];
    for (const [id, name] of expected) {
      const button = byTestId(page, id);
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      await expect(button).toHaveAccessibleName(name);
      await expect(button).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('holding forward moves the ship and releasing lets it coast', async ({ page }) => {
    await startBattle(page, { touch: true });
    const forward = byTestId(page, TEST_IDS.touchForward);
    const start = player(await battleState(page));
    expect(start.speed).toBe(0);

    await forward.dispatchEvent('pointerdown', TOUCH_POINTER);
    await expect(forward).toHaveAttribute('aria-pressed', 'true');
    await advance(page, 1000);
    const held = player(await battleState(page));
    expect(held.x).toBeGreaterThan(start.x);
    expect(held.speed).toBeGreaterThan(0);
    const heldDistance = held.x - start.x;

    await forward.dispatchEvent('pointerup', TOUCH_POINTER);
    await expect(forward).toHaveAttribute('aria-pressed', 'false');
    await advance(page, 1000);
    const coasting = player(await battleState(page));
    const coastDistance = coasting.x - held.x;
    expect(coastDistance).toBeGreaterThan(0);
    expect(coastDistance).toBeLessThan(heldDistance);
    expect(coasting.speed).toBeLessThan(held.speed);
    expect(coasting.heading).toBeCloseTo(start.heading, 5);
  });

  test('turn left changes the heading and fire front launches a projectile', async ({ page }) => {
    await startBattle(page, { touch: true });
    const start = player(await battleState(page));

    await holdWhileAdvancing(page, byTestId(page, TEST_IDS.touchTurnLeft), 500);
    const turned = player(await battleState(page));
    expect(turned.heading).not.toBeCloseTo(start.heading, 3);
    expect(turned.heading).toBeLessThan(start.heading);
    expect(turned.x).toBeCloseTo(start.x, 3);
    expect(turned.y).toBeCloseTo(start.y, 3);

    expect((await battleState(page)).projectiles).toHaveLength(0);
    await holdWhileAdvancing(page, byTestId(page, TEST_IDS.touchFireFront), 50);
    const afterFire = await battleState(page);
    expect(afterFire.projectiles).toHaveLength(1);
    expect(afterFire.projectiles[0]?.faction).toBe('player');
    expect(afterFire.cooldowns.front).toBeGreaterThan(0);
  });

  test('a touch tap on fire front launches exactly one projectile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Touch input is only emulated on the mobile project');
    await startBattle(page, { touch: true });
    const fire = byTestId(page, TEST_IDS.touchFireFront);
    const box = await fire.boundingBox();
    if (!box) throw new Error('Fire button has no layout box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await expect(fire).toHaveAttribute('aria-pressed', 'true');
    await advance(page, 50);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(fire).toHaveAttribute('aria-pressed', 'false');
    await cdp.detach();

    await advance(page, 50);
    let state = await battleState(page);
    expect(state.projectiles).toHaveLength(1);
    await advance(page, 300);
    state = await battleState(page);
    expect(state.projectiles).toHaveLength(1);
  });
});

test.describe('Orientation', () => {
  test('portrait shows the rotate hint and pauses, landscape restores the pause dialog', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Portrait handling applies to the mobile project only');
    await startBattle(page, { touch: true });
    await expect(byTestId(page, TEST_IDS.orientationHint)).toHaveCount(0);
    await advance(page, 500);
    const before = await battleState(page);
    expect(before.status).toBe('running');

    await page.setViewportSize({ width: 393, height: 851 });
    await expect(byTestId(page, TEST_IDS.orientationHint)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.hudStatus)).toContainText('Paused');
    const paused = await battleState(page);
    expect(paused.status).toBe('paused');
    await advance(page, 1000);
    expect((await battleState(page)).elapsedSeconds).toBe(paused.elapsedSeconds);

    await page.setViewportSize({ width: 851, height: 393 });
    await expect(byTestId(page, TEST_IDS.orientationHint)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeVisible();
    expect((await battleState(page)).status).toBe('paused');

    await byTestId(page, TEST_IDS.pauseResume).click();
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toHaveCount(0);
    expect((await battleState(page)).status).toBe('running');
    await advance(page, 500);
    expect((await battleState(page)).elapsedSeconds).toBeCloseTo(paused.elapsedSeconds + 0.5, 1);
  });
});

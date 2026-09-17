import { expect, test } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import { byTestId, openMenu, readStorage, STORAGE, type StoredOptions } from './support/app';

test.describe('Options', () => {
  test('navigates from the menu, validates limits and persists after refresh', async ({ page }) => {
    await openMenu(page);
    await byTestId(page, TEST_IDS.menuOptions).click();
    await expect(byTestId(page, TEST_IDS.screenOptions)).toBeVisible();

    const session = byTestId(page, TEST_IDS.optionsSession);
    const spawn = byTestId(page, TEST_IDS.optionsSpawn);
    await expect(session).toHaveAttribute('aria-valuenow', '120');
    await expect(spawn).toHaveAttribute('aria-valuenow', '3');

    for (let index = 0; index < 6; index += 1) await byTestId(page, TEST_IDS.optionsSessionIncrease).click();
    await expect(session).toHaveAttribute('aria-valuenow', '180');
    await expect(byTestId(page, TEST_IDS.optionsSessionIncrease)).toBeDisabled();

    for (let index = 0; index < 2; index += 1) await byTestId(page, TEST_IDS.optionsSpawnDecrease).click();
    await expect(spawn).toHaveAttribute('aria-valuenow', '1');
    await expect(byTestId(page, TEST_IDS.optionsSpawnDecrease)).toBeDisabled();

    await byTestId(page, TEST_IDS.optionsSpawnIncrease).click();
    await byTestId(page, TEST_IDS.optionsSave).click();
    await expect(page.getByText('Options saved.')).toBeVisible();

    await page.reload();
    await byTestId(page, TEST_IDS.splashStart).click();
    await byTestId(page, TEST_IDS.menuOptions).click();
    await expect(byTestId(page, TEST_IDS.optionsSession)).toHaveAttribute('aria-valuenow', '180');
    await expect(byTestId(page, TEST_IDS.optionsSpawn)).toHaveAttribute('aria-valuenow', '2');

    const stored = await readStorage<StoredOptions>(page, STORAGE.options);
    expect(stored).toEqual({ sessionSeconds: 180, spawnIntervalSeconds: 2, steering: 'keyboard' });
  });

  test('supports keyboard navigation and spinbutton keys', async ({ page }) => {
    await openMenu(page);
    await page.keyboard.press('Tab');
    await expect(byTestId(page, TEST_IDS.menuOptions)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(byTestId(page, TEST_IDS.screenOptions)).toBeVisible();

    const session = byTestId(page, TEST_IDS.optionsSession);
    await session.focus();
    await page.keyboard.press('ArrowDown');
    await expect(session).toHaveAttribute('aria-valuenow', '110');
    await page.keyboard.press('Home');
    await expect(session).toHaveAttribute('aria-valuenow', '60');
    await page.keyboard.press('End');
    await expect(session).toHaveAttribute('aria-valuenow', '180');
  });

  test('rejects corrupted stored values and falls back to defaults', async ({ page }) => {
    await openMenu(page);
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ sessionSeconds: 999, spawnIntervalSeconds: 0 })), STORAGE.options);
    await page.reload();
    await byTestId(page, TEST_IDS.splashStart).click();
    await byTestId(page, TEST_IDS.menuOptions).click();
    await expect(byTestId(page, TEST_IDS.optionsSession)).toHaveAttribute('aria-valuenow', '120');
    await expect(byTestId(page, TEST_IDS.optionsSpawn)).toHaveAttribute('aria-valuenow', '3');
  });

  test('is reachable from the pause menu and applies to the next battle only', async ({ page }) => {
    await openMenu(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 3 } });
    await byTestId(page, TEST_IDS.menuPlay).click();
    await page.waitForFunction(() => window.__pirateBattle?.getState()?.status === 'running');
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('01:00');
    await byTestId(page, TEST_IDS.hudPause).click();
    await byTestId(page, TEST_IDS.pauseOptions).click();
    await byTestId(page, TEST_IDS.optionsSessionIncrease).click();
    await byTestId(page, TEST_IDS.optionsSave).click();
    await byTestId(page, TEST_IDS.optionsBack).click();
    await byTestId(page, TEST_IDS.pauseResume).click();
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('01:00');
  });
});

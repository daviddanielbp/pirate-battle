import { expect, test, type Page } from '@playwright/test';
import type { PlayerProgress } from '../src/game/progression/progression';
import { TEST_IDS } from '../src/testing/testIds';
import { byTestId, openMenu, readStorage, STORAGE } from './support/app';

const RED_HULL_PRICE = 30;
const YELLOW_HULL_PRICE = 60;
const TWIN_CANNON_PRICE = 50;
const HEALTH_UPGRADE_PRICES = [20, 35, 50, 70] as const;
const MAX_TAB_PRESSES = 40;

const DEFAULT_PROGRESS: PlayerProgress = {
  coins: 0,
  xp: 0,
  hull: 'skull',
  cannon: 'single',
  upgrades: { health: 0, damage: 0, speed: 0 },
  ownedHulls: ['skull'],
  ownedCannons: ['single'],
};

function progressWith(overrides: Partial<PlayerProgress>): PlayerProgress {
  return { ...DEFAULT_PROGRESS, ...overrides, upgrades: { ...DEFAULT_PROGRESS.upgrades, ...overrides.upgrades } };
}

function item(page: Page, testId: string, id: string) {
  return byTestId(page, testId).and(page.locator(`[data-item="${id}"]`));
}

async function openShipyard(page: Page, progress: PlayerProgress): Promise<void> {
  await openMenu(page, { progress });
  await byTestId(page, TEST_IDS.menuShipyard).click();
  await expect(byTestId(page, TEST_IDS.screenShipyard)).toBeVisible();
}

async function storedProgress(page: Page): Promise<PlayerProgress> {
  const stored = await readStorage<PlayerProgress>(page, STORAGE.progress);
  if (!stored) throw new Error('Progress is not stored');
  return stored;
}

test.describe('Shipyard', () => {
  test('shows the treasury, rank and experience', async ({ page }) => {
    await openShipyard(page, progressWith({ coins: 200, xp: 35 }));
    await expect(byTestId(page, TEST_IDS.shipyardCoins)).toContainText('200');
    await expect(byTestId(page, TEST_IDS.shipyardLevel)).toContainText('Level 2');
    await expect(byTestId(page, TEST_IDS.shipyardXp)).toContainText('5 / 40 XP');
    await expect(item(page, TEST_IDS.shipyardHull, 'skull')).toBeDisabled();
    await expect(item(page, TEST_IDS.shipyardCannon, 'single')).toBeDisabled();
    await expect(byTestId(page, TEST_IDS.shipyardHull)).toHaveCount(6);
    await expect(byTestId(page, TEST_IDS.shipyardCannon)).toHaveCount(3);
    await expect(byTestId(page, TEST_IDS.shipyardUpgrade)).toHaveCount(3);
  });

  test('buys and equips a hull', async ({ page }) => {
    const seeded = progressWith({ coins: 200 });
    await openShipyard(page, seeded);
    await item(page, TEST_IDS.shipyardHull, 'red').click();
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText('purchased');
    await expect(byTestId(page, TEST_IDS.shipyardCoins)).toContainText(String(200 - RED_HULL_PRICE));
    await expect(item(page, TEST_IDS.shipyardHull, 'red')).toBeDisabled();
    await expect(item(page, TEST_IDS.shipyardHull, 'skull')).toBeEnabled();

    const stored = await storedProgress(page);
    expect(stored.hull).toBe('red');
    expect(stored.coins).toBe(200 - RED_HULL_PRICE);
    expect(stored.ownedHulls).toEqual(['skull', 'red']);

    await item(page, TEST_IDS.shipyardHull, 'skull').click();
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText('equipped');
    expect((await storedProgress(page)).hull).toBe('skull');
    expect((await storedProgress(page)).coins).toBe(200 - RED_HULL_PRICE);
  });

  test('refuses a purchase without enough coins', async ({ page }) => {
    const seeded = progressWith({ coins: 10 });
    await openShipyard(page, seeded);
    await item(page, TEST_IDS.shipyardHull, 'yellow').click();
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText('Not enough coins');
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText(String(YELLOW_HULL_PRICE));
    await expect(byTestId(page, TEST_IDS.shipyardCoins)).toContainText('10');
    expect(await storedProgress(page)).toEqual(seeded);

    await item(page, TEST_IDS.shipyardCannon, 'double').click();
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText('Not enough coins');
    expect(await storedProgress(page)).toEqual(seeded);
  });

  test('upgrades the hull twice at increasing prices', async ({ page }) => {
    await openShipyard(page, progressWith({ coins: 200 }));
    const upgrade = item(page, TEST_IDS.shipyardUpgrade, 'health');
    await upgrade.click();
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText('level 1');
    await expect(byTestId(page, TEST_IDS.shipyardCoins)).toContainText(String(200 - HEALTH_UPGRADE_PRICES[0]));
    await upgrade.click();
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText('level 2');
    const remaining = 200 - HEALTH_UPGRADE_PRICES[0] - HEALTH_UPGRADE_PRICES[1];
    await expect(byTestId(page, TEST_IDS.shipyardCoins)).toContainText(String(remaining));

    const stored = await storedProgress(page);
    expect(stored.upgrades).toEqual({ health: 2, damage: 0, speed: 0 });
    expect(stored.coins).toBe(remaining);
  });

  test('buys the twin cannon', async ({ page }) => {
    await openShipyard(page, progressWith({ coins: 200 }));
    await item(page, TEST_IDS.shipyardCannon, 'double').click();
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText('purchased');
    await expect(item(page, TEST_IDS.shipyardCannon, 'double')).toBeDisabled();
    await expect(item(page, TEST_IDS.shipyardCannon, 'single')).toBeEnabled();

    const stored = await storedProgress(page);
    expect(stored.cannon).toBe('double');
    expect(stored.ownedCannons).toEqual(['single', 'double']);
    expect(stored.coins).toBe(200 - TWIN_CANNON_PRICE);
  });

  test('is operable with the keyboard and returns to the menu', async ({ page }) => {
    await openShipyard(page, progressWith({ coins: 200 }));
    const whiteHull = item(page, TEST_IDS.shipyardHull, 'white');
    const back = byTestId(page, TEST_IDS.shipyardBack);
    await page.keyboard.press('Tab');
    await expect(whiteHull).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(byTestId(page, TEST_IDS.shipyardMessage)).toContainText('purchased');
    expect((await storedProgress(page)).hull).toBe('white');

    let reached = false;
    for (let press = 0; press < MAX_TAB_PRESSES && !reached; press += 1) {
      await page.keyboard.press('Tab');
      reached = await back.evaluate((element) => element === document.activeElement);
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.screenShipyard)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.screenMenu)).toContainText('Level 1 · 180 coins · 0/30 XP');
  });
});

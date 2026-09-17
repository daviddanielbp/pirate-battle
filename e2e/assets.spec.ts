import { expect, test } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import { battleState, byTestId, openMenu, waitForBattle } from './support/app';

const SHIPS_ATLAS = '**/assets/game/ships.json';

test.use({ serviceWorkers: 'block' });

test.describe('Asset loading', () => {
  test('shows a loading screen with a progress bar before the battle starts', async ({ page }) => {
    await openMenu(page);
    let releaseAtlas: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      releaseAtlas = resolve;
    });
    await page.route(SHIPS_ATLAS, async (route) => {
      await hold;
      await route.continue();
    });
    await byTestId(page, TEST_IDS.menuPlay).click();

    const loading = byTestId(page, TEST_IDS.screenLoading);
    const progressbar = byTestId(page, TEST_IDS.loadingProgress).getByRole('progressbar');
    await expect(loading).toBeVisible();
    await expect(progressbar).toBeVisible();
    await expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    await expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    const initial = Number(await progressbar.getAttribute('aria-valuenow'));
    expect(initial).toBeGreaterThanOrEqual(0);
    expect(initial).toBeLessThan(100);
    await expect(byTestId(page, TEST_IDS.screenBattle)).toHaveCount(0);

    releaseAtlas();
    await waitForBattle(page);
    await expect(loading).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('02:00');
  });

  test('reports a failed atlas download and recovers after retry', async ({ page }) => {
    await openMenu(page);
    await page.route(SHIPS_ATLAS, (route) => route.abort());
    await byTestId(page, TEST_IDS.menuPlay).click();

    const error = byTestId(page, TEST_IDS.loadingError);
    await expect(byTestId(page, TEST_IDS.screenLoading)).toBeVisible();
    await expect(error).toBeVisible();
    await expect(error).toContainText('ships.json');
    await expect(byTestId(page, TEST_IDS.loadingRetry)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.loadingBack)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.loadingProgress)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.screenBattle)).toHaveCount(0);

    await page.unroute(SHIPS_ATLAS);
    await byTestId(page, TEST_IDS.loadingRetry).click();
    await waitForBattle(page);
    await expect(byTestId(page, TEST_IDS.loadingError)).toHaveCount(0);
    const state = await battleState(page);
    expect(state.status).toBe('running');
    expect(state.elapsedSeconds).toBe(0);
  });

  test('keeps failing while the asset stays unavailable and retry stays available', async ({ page }) => {
    await openMenu(page);
    let requests = 0;
    await page.route(SHIPS_ATLAS, (route) => {
      requests += 1;
      return route.abort();
    });
    await byTestId(page, TEST_IDS.menuPlay).click();
    await expect(byTestId(page, TEST_IDS.loadingError)).toBeVisible();
    expect(requests).toBe(1);

    await byTestId(page, TEST_IDS.loadingRetry).click();
    await expect(byTestId(page, TEST_IDS.loadingError)).toBeVisible();
    await expect.poll(() => requests).toBe(2);
    await expect(byTestId(page, TEST_IDS.loadingRetry)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.screenBattle)).toHaveCount(0);

    await page.unroute(SHIPS_ATLAS);
    await byTestId(page, TEST_IDS.loadingRetry).click();
    await waitForBattle(page);
  });

  test('returns to the main menu from the loading error', async ({ page }) => {
    await openMenu(page);
    await page.route(SHIPS_ATLAS, (route) => route.abort());
    await byTestId(page, TEST_IDS.menuPlay).click();
    await expect(byTestId(page, TEST_IDS.loadingError)).toBeVisible();

    await byTestId(page, TEST_IDS.loadingBack).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.screenLoading)).toHaveCount(0);
    const hasBattle = await page.evaluate(() => window.__pirateBattle?.hasBattle() ?? false);
    expect(hasBattle).toBe(false);

    await page.unroute(SHIPS_ATLAS);
    await byTestId(page, TEST_IDS.menuPlay).click();
    await waitForBattle(page);
  });
});

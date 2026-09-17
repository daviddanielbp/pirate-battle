import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import { advanceInSteps, byTestId, openMenu, startBattle } from './support/app';

const SERIOUS = new Set(['serious', 'critical']);

async function expectNoSeriousViolations(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = results.violations.filter((violation) => SERIOUS.has(violation.impact ?? ''));
  const summary = serious.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`);
  expect(summary, `${context} has serious accessibility violations`).toEqual([]);
}

test.describe('Accessibility audit', () => {
  test('main menu', async ({ page }) => {
    await openMenu(page);
    await expectNoSeriousViolations(page, 'Main menu');
  });

  test('options', async ({ page }) => {
    await openMenu(page);
    await byTestId(page, TEST_IDS.menuOptions).click();
    await expect(byTestId(page, TEST_IDS.screenOptions)).toBeVisible();
    await expectNoSeriousViolations(page, 'Options');
  });

  test('shipyard', async ({ page }) => {
    await openMenu(page);
    await byTestId(page, TEST_IDS.menuShipyard).click();
    await expect(byTestId(page, TEST_IDS.screenShipyard)).toBeVisible();
    await expectNoSeriousViolations(page, 'Shipyard');
  });

  test("captain's log", async ({ page }) => {
    await openMenu(page);
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logRow).first()).toBeVisible();
    await expectNoSeriousViolations(page, 'Ranking');
    await byTestId(page, TEST_IDS.logTabHistory).click();
    await expect(byTestId(page, TEST_IDS.logEmpty)).toBeVisible();
    await expectNoSeriousViolations(page, 'Match history');
  });

  test('battle, pause dialog and network simulator', async ({ page }) => {
    await startBattle(page, { touch: true });
    await expectNoSeriousViolations(page, 'Battle');
    await byTestId(page, TEST_IDS.hudPause).click();
    await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeVisible();
    await expectNoSeriousViolations(page, 'Pause dialog');
    await byTestId(page, TEST_IDS.pauseMainMenu).click();
    await byTestId(page, TEST_IDS.confirmAccept).click();
    await byTestId(page, TEST_IDS.menuNetworkLab).click();
    await expect(byTestId(page, TEST_IDS.networkLabDialog)).toBeVisible();
    await expectNoSeriousViolations(page, 'Network simulator');
  });

  test('result screen', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 10 } });
    await advanceInSteps(page, 60_000, 1000);
    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousViolations(page, 'Result');
  });
});

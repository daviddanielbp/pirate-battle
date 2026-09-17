import { expect, test, type Page } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import { byTestId, openMenu, readStorage, STORAGE } from './support/app';

const PAGE_SIZE = 5;
const DEFAULT_RANKING_PAGES = 3;
const SHORT_SESSION_RANKING_ROWS = 3;
const PAGINATED_HISTORY_PAGES = 3;
const KEEP_SCENARIO_LATENCY = 150;
const DATE_PATTERN = /\d{2} [A-Z]{3} · \d{2}:\d{2}/;

function rows(page: Page) {
  return byTestId(page, TEST_IDS.logRow);
}

function pageLabel(page: Page) {
  return byTestId(page, TEST_IDS.logPageLabel);
}

async function switchScenario(page: Page, scenario: string): Promise<void> {
  await byTestId(page, TEST_IDS.menuNetworkLab).click();
  await expect(byTestId(page, TEST_IDS.networkLabDialog)).toBeVisible();
  await byTestId(page, TEST_IDS.networkLabScenario).selectOption(scenario);
  await byTestId(page, TEST_IDS.networkLabApply).click();
  await expect(byTestId(page, TEST_IDS.networkLabDialog)).toContainText(
    `Scenario "${scenario}" is now active.`,
  );
  await byTestId(page, TEST_IDS.networkLabClose).click();
  await expect(byTestId(page, TEST_IDS.networkLabDialog)).toBeHidden();
}

test.describe("Captain's log", () => {
  test('shows the loading state before the ranking rows arrive', async ({ page }) => {
    await openMenu(page, { scenario: 'slow', latency: KEEP_SCENARIO_LATENCY });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.screenLog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logLoading)).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.logPrevPage)).toBeDisabled();
    await expect(byTestId(page, TEST_IDS.logNextPage)).toBeDisabled();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(byTestId(page, TEST_IDS.logLoading)).toHaveCount(0);
  });

  test('renders ranking rows and paginates through the default fixtures', async ({ page }) => {
    await openMenu(page);
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);

    const firstRow = rows(page).first();
    await expect(firstRow).toContainText('01');
    await expect(firstRow).toContainText('★');
    await expect(firstRow).toContainText(DATE_PATTERN);
    await expect(rows(page).nth(4)).toContainText('05');
    const firstRowText = (await firstRow.textContent()) ?? '';
    expect(firstRowText).toMatch(/\d+/);

    await expect(pageLabel(page)).toHaveText(`Page 1 of ${DEFAULT_RANKING_PAGES}`);
    await expect(byTestId(page, TEST_IDS.logPrevPage)).toBeDisabled();
    await expect(byTestId(page, TEST_IDS.logNextPage)).toBeEnabled();

    await byTestId(page, TEST_IDS.logNextPage).click();
    await expect(pageLabel(page)).toHaveText(`Page 2 of ${DEFAULT_RANKING_PAGES}`);
    await expect(rows(page).first()).toContainText('06');
    await expect(rows(page).first()).not.toHaveText(firstRowText);
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(byTestId(page, TEST_IDS.logPrevPage)).toBeEnabled();

    await byTestId(page, TEST_IDS.logNextPage).click();
    await expect(pageLabel(page)).toHaveText(`Page 3 of ${DEFAULT_RANKING_PAGES}`);
    await expect(rows(page).first()).toContainText('11');
    await expect(byTestId(page, TEST_IDS.logNextPage)).toBeDisabled();

    await byTestId(page, TEST_IDS.logPrevPage).click();
    await byTestId(page, TEST_IDS.logPrevPage).click();
    await expect(pageLabel(page)).toHaveText(`Page 1 of ${DEFAULT_RANKING_PAGES}`);
    await expect(rows(page).first()).toHaveText(firstRowText);
    await expect(byTestId(page, TEST_IDS.logPrevPage)).toBeDisabled();
  });

  test('shows the empty state on both tabs when there are no records', async ({ page }) => {
    await openMenu(page, { scenario: 'empty' });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logEmpty)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logEmpty)).toContainText(
      'No battles recorded for this configuration yet.',
    );
    await expect(rows(page)).toHaveCount(0);
    await expect(pageLabel(page)).toHaveText('Page 1 of 1');

    await byTestId(page, TEST_IDS.logTabHistory).click();
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logEmpty)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logEmpty)).toContainText('You have not completed a battle yet.');
    await expect(rows(page)).toHaveCount(0);
  });

  test('shows the error state on the ranking while the history keeps working', async ({ page }) => {
    await openMenu(page, { scenario: 'ranking-failure' });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logError)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logRetry)).toBeVisible();
    await expect(rows(page)).toHaveCount(0);

    await byTestId(page, TEST_IDS.logTabHistory).click();
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logEmpty)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logError)).toHaveCount(0);
  });

  test('shows the error state on the history while the ranking keeps working', async ({ page }) => {
    await openMenu(page, { scenario: 'history-failure' });
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logError)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logRetry)).toBeVisible();
    await expect(rows(page)).toHaveCount(0);

    await byTestId(page, TEST_IDS.logTabRanking).click();
    await expect(byTestId(page, TEST_IDS.logPanelRanking)).toBeVisible();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(byTestId(page, TEST_IDS.logError)).toHaveCount(0);
  });

  test('retries the failing ranking and recovers after the scenario changes in the network lab', async ({
    page,
  }) => {
    await openMenu(page, { scenario: 'ranking-failure' });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logError)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logError)).toContainText('The server hit an unexpected error.');

    const rankingRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/ranking')) rankingRequests.push(request.url());
    });
    await byTestId(page, TEST_IDS.logRetry).click();
    await expect(byTestId(page, TEST_IDS.logLoading)).toBeVisible();
    await expect.poll(() => rankingRequests.length).toBeGreaterThan(0);
    await expect(byTestId(page, TEST_IDS.logError)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logRetry)).toBeVisible();
    await expect(rows(page)).toHaveCount(0);

    await byTestId(page, TEST_IDS.logMainMenu).click();
    await switchScenario(page, 'default');
    expect(await readStorage<string>(page, STORAGE.scenario)).toBe('default');
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(byTestId(page, TEST_IDS.logError)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.logRetry)).toHaveCount(0);
    await expect(pageLabel(page)).toHaveText(`Page 1 of ${DEFAULT_RANKING_PAGES}`);
  });

  test('ranks the configuration saved in the options', async ({ page }) => {
    await openMenu(page);
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logPanelRanking)).toContainText(
      '120 second battles · 3 second spawn interval',
    );
    await expect(pageLabel(page)).toHaveText(`Page 1 of ${DEFAULT_RANKING_PAGES}`);

    await byTestId(page, TEST_IDS.logMainMenu).click();
    await byTestId(page, TEST_IDS.menuOptions).click();
    await byTestId(page, TEST_IDS.optionsSession).focus();
    await page.keyboard.press('Home');
    await expect(byTestId(page, TEST_IDS.optionsSession)).toHaveAttribute('aria-valuenow', '60');
    await byTestId(page, TEST_IDS.optionsSave).click();
    await expect(page.getByText('Options saved.')).toBeVisible();
    await byTestId(page, TEST_IDS.optionsBack).click();

    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logPanelRanking)).toContainText(
      '60 second battles · 3 second spawn interval',
    );
    await expect(rows(page)).toHaveCount(SHORT_SESSION_RANKING_ROWS);
    await expect(pageLabel(page)).toHaveText('Page 1 of 1');
    await expect(rows(page).first()).toContainText('Jean Lafitte');
    await expect(rows(page).nth(1)).toContainText('Anne Bonny');
    await expect(rows(page).nth(2)).toContainText('Francis Drake');
    await expect(byTestId(page, TEST_IDS.logNextPage)).toBeDisabled();
  });

  test('paginates the local player history in the paginated scenario', async ({ page }) => {
    await openMenu(page, { scenario: 'paginated' });
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(pageLabel(page)).toHaveText(`Page 1 of ${PAGINATED_HISTORY_PAGES}`);

    const firstRow = rows(page).first();
    await expect(firstRow).toContainText(DATE_PATTERN);
    await expect(firstRow).toContainText(/\d{2}:\d{2}/);
    await expect(firstRow).toContainText(/Time up|Defeated/);
    const firstRowText = (await firstRow.textContent()) ?? '';

    await byTestId(page, TEST_IDS.logNextPage).click();
    await expect(pageLabel(page)).toHaveText(`Page 2 of ${PAGINATED_HISTORY_PAGES}`);
    await expect(rows(page).first()).not.toHaveText(firstRowText);
    await expect(rows(page)).toHaveCount(PAGE_SIZE);

    await byTestId(page, TEST_IDS.logNextPage).click();
    await expect(pageLabel(page)).toHaveText(`Page 3 of ${PAGINATED_HISTORY_PAGES}`);
    await expect(rows(page)).toHaveCount(2);
    await expect(byTestId(page, TEST_IDS.logNextPage)).toBeDisabled();

    await byTestId(page, TEST_IDS.logTabRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(pageLabel(page)).toHaveText(/Page 1 of [4-9]/);
  });

  test('opens the tab selected in the main menu', async ({ page }) => {
    await openMenu(page);
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expect(byTestId(page, TEST_IDS.screenLog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logTabHistory)).toHaveAttribute('aria-selected', 'true');
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toContainText('Your recent battles');

    await byTestId(page, TEST_IDS.logMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logTabRanking)).toHaveAttribute('aria-selected', 'true');
    await expect(byTestId(page, TEST_IDS.logPanelRanking)).toBeVisible();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
  });

  test('network lab reset restores the fixtures and the default scenario', async ({ page }) => {
    await openMenu(page, { scenario: 'empty' });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logEmpty)).toBeVisible();
    expect(await readStorage<string>(page, STORAGE.scenario)).toBe('empty');

    await byTestId(page, TEST_IDS.logMainMenu).click();
    await byTestId(page, TEST_IDS.menuNetworkLab).click();
    await expect(byTestId(page, TEST_IDS.networkLabDialog)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.networkLabScenario)).toHaveValue('empty');
    await byTestId(page, TEST_IDS.networkLabReset).click();
    await expect(byTestId(page, TEST_IDS.networkLabScenario)).toHaveValue('default');
    await expect(byTestId(page, TEST_IDS.networkLabDialog)).toContainText('were reset');
    await byTestId(page, TEST_IDS.networkLabClose).click();
    expect(await readStorage<string>(page, STORAGE.scenario)).toBeNull();

    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(pageLabel(page)).toHaveText(`Page 1 of ${DEFAULT_RANKING_PAGES}`);
    await expect(byTestId(page, TEST_IDS.logEmpty)).toHaveCount(0);
  });
});

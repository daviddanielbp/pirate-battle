import { expect, test, type Page } from '@playwright/test';
import type { MatchRecord } from '../src/data/contracts';
import { TEST_IDS } from '../src/testing/testIds';
import {
  advanceInSteps,
  byTestId,
  openMenu,
  readStorage,
  startBattle,
  STORAGE,
  waitForBattle,
} from './support/app';

const SHORT_OPTIONS = { sessionSeconds: 60, spawnIntervalSeconds: 3 };
const SESSION_MS = SHORT_OPTIONS.sessionSeconds * 1000;
const PAGE_SIZE = 5;
const DEFAULT_RANKING_PAGES = 3;
const KEEP_SCENARIO_LATENCY = 150;
const CLIENT_TIMEOUT_MS = 6000;
const QUERY_RETRY_BUDGET_MS = 3 * CLIENT_TIMEOUT_MS + 5000;
const SETTLE_MS = 2000;
const SETTLE_INTERVAL_MS = 100;

function rows(page: Page) {
  return byTestId(page, TEST_IDS.logRow);
}

function pageLabel(page: Page) {
  return byTestId(page, TEST_IDS.logPageLabel);
}

async function firstRowText(page: Page): Promise<string> {
  return (await rows(page).first().textContent()) ?? '';
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

async function expectStablePage(page: Page, label: string, expectedFirstRow: string): Promise<void> {
  const samples: string[] = [];
  await expect
    .poll(
      async () => {
        samples.push(`${(await pageLabel(page).textContent()) ?? ''}|${await firstRowText(page)}`);
        return samples.length * SETTLE_INTERVAL_MS >= SETTLE_MS;
      },
      { intervals: [SETTLE_INTERVAL_MS], timeout: SETTLE_MS * 3 },
    )
    .toBe(true);
  expect(new Set(samples)).toEqual(new Set([`${label}|${expectedFirstRow}`]));
}

test.describe('Network resilience', () => {
  test('recovers a submission that timed out without duplicating the record', async ({ page }) => {
    await startBattle(page, { options: SHORT_OPTIONS, scenario: 'submit-timeout-recover' });
    await advanceInSteps(page, SESSION_MS);
    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    const last = await readStorage<MatchRecord>(page, STORAGE.lastResult);
    if (!last) throw new Error('The finished match was not persisted');

    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText('Recording your battle…');
    await expect(byTestId(page, TEST_IDS.resultRetry)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText('Battle not recorded yet', {
      timeout: CLIENT_TIMEOUT_MS + 5000,
    });
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText(
      'The server took too long to respond.',
    );
    await expect(byTestId(page, TEST_IDS.resultRetry)).toBeVisible();
    const stored = await readStorage<MatchRecord[]>(page, STORAGE.mockDatabase);
    expect(stored?.map((record) => record.id)).toEqual([last.id]);

    await byTestId(page, TEST_IDS.resultRetry).click();
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText(
      'Battle recorded in the ranking and match history.',
    );
    await expect(byTestId(page, TEST_IDS.resultRetry)).toHaveCount(0);
    const afterRetry = await readStorage<MatchRecord[]>(page, STORAGE.mockDatabase);
    expect(afterRetry?.map((record) => record.id)).toEqual([last.id]);

    await byTestId(page, TEST_IDS.resultMainMenu).click();
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(byTestId(page, TEST_IDS.logPendingRow)).toHaveCount(0);
    await expect(rows(page).first()).toContainText(String(last.score));

    await byTestId(page, TEST_IDS.logTabRanking).click();
    await expect(rows(page).filter({ has: page.getByText('You', { exact: true }) })).toHaveCount(1);
  });

  test('shows the error state after the client timeout and recovers once the scenario changes', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openMenu(page, { scenario: 'timeout' });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logLoading)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logError)).toBeVisible({ timeout: QUERY_RETRY_BUDGET_MS });
    await expect(byTestId(page, TEST_IDS.logError)).toContainText('The server took too long to respond.');
    await expect(byTestId(page, TEST_IDS.logRetry)).toBeVisible();
    await expect(rows(page)).toHaveCount(0);

    await byTestId(page, TEST_IDS.logMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await switchScenario(page, 'default');
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(byTestId(page, TEST_IDS.logError)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.logRetry)).toHaveCount(0);

    await byTestId(page, TEST_IDS.logTabHistory).click();
    await expect(byTestId(page, TEST_IDS.logEmpty)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logError)).toHaveCount(0);
  });

  test('keeps the last requested ranking page when an earlier request is still pending', async ({ page }) => {
    await openMenu(page, { scenario: 'slow', latency: KEEP_SCENARIO_LATENCY });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(pageLabel(page)).toHaveText(`Page 1 of ${DEFAULT_RANKING_PAGES}`);
    const pageOneFirstRow = await firstRowText(page);
    await byTestId(page, TEST_IDS.logMainMenu).click();

    const answeredPages: string[] = [];
    const abortedPages: string[] = [];
    const rankingPage = (url: string): string | null => {
      const parsed = new URL(url);
      return parsed.pathname.endsWith('/api/ranking') ? (parsed.searchParams.get('page') ?? '') : null;
    };
    page.on('requestfinished', (request) => {
      const requested = rankingPage(request.url());
      if (requested !== null) answeredPages.push(requested);
    });
    page.on('requestfailed', (request) => {
      const requested = rankingPage(request.url());
      if (requested !== null) abortedPages.push(requested);
    });

    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await byTestId(page, TEST_IDS.logNextPage).click();
    await expect(pageLabel(page)).toHaveText(`Page 2 of ${DEFAULT_RANKING_PAGES}`);
    await expect(rows(page).first()).not.toHaveText(pageOneFirstRow);
    const pageTwoFirstRow = await firstRowText(page);
    expect(pageTwoFirstRow).toContain('06');
    await expectStablePage(page, `Page 2 of ${DEFAULT_RANKING_PAGES}`, pageTwoFirstRow);
    expect(abortedPages).toContain('1');
    expect(answeredPages.filter((requested) => requested === '2')).toHaveLength(1);
    expect(answeredPages.at(-1)).toBe('2');

    await byTestId(page, TEST_IDS.logPrevPage).click();
    await expect(pageLabel(page)).toHaveText(`Page 1 of ${DEFAULT_RANKING_PAGES}`);
    await expect(rows(page).first()).toHaveText(pageOneFirstRow);
    await expectStablePage(page, `Page 1 of ${DEFAULT_RANKING_PAGES}`, pageOneFirstRow);
    expect(answeredPages.at(-1)).toBe('2');
  });

  test('renders the same ranking under seeded jitter on every run', async ({ page }) => {
    await openMenu(page, { scenario: 'jitter', latency: KEEP_SCENARIO_LATENCY });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    const firstRun = await rows(page).allTextContents();

    await openMenu(page, { scenario: 'jitter', latency: KEEP_SCENARIO_LATENCY });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    const secondRun = await rows(page).allTextContents();

    expect(secondRun).toEqual(firstRun);
    expect(firstRun[0]).toContain('01');
  });

  test('network failures on the log tabs do not block starting a battle', async ({ page }) => {
    await openMenu(page, { scenario: 'network-error', options: SHORT_OPTIONS });
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expect(byTestId(page, TEST_IDS.logError)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logError)).toContainText('Unable to reach the server.');
    await expect(byTestId(page, TEST_IDS.logRetry)).toBeVisible();

    await byTestId(page, TEST_IDS.logTabHistory).click();
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logError)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.logRetry)).toBeVisible();

    await byTestId(page, TEST_IDS.logMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await byTestId(page, TEST_IDS.menuPlay).click();
    await waitForBattle(page);
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('01:00');
  });
});

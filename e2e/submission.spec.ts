import { expect, test, type Page } from '@playwright/test';
import type { MatchRecord } from '../src/data/contracts';
import { TEST_IDS } from '../src/testing/testIds';
import {
  advanceInSteps,
  byTestId,
  readStorage,
  startBattle,
  STORAGE,
  switchScenario,
  waitForBattle,
} from './support/app';

const SHORT_OPTIONS = { sessionSeconds: 60, spawnIntervalSeconds: 3 };
const SESSION_MS = SHORT_OPTIONS.sessionSeconds * 1000;
const SHORT_SESSION_FIXTURES = 3;
const RECORDED_TEXT = 'Battle recorded in the ranking and match history.';
const NOT_RECORDED_TEXT = 'Battle not recorded yet';

interface PendingEntry {
  record: MatchRecord;
  attempts: number;
  status: string;
}

interface PendingState {
  pending: PendingEntry[];
  confirmedIds: string[];
}

interface ResultSummary {
  id: string;
  score: string;
  time: string;
  reason: string;
}

function rows(page: Page) {
  return byTestId(page, TEST_IDS.logRow);
}

async function finishBattle(page: Page): Promise<ResultSummary> {
  await advanceInSteps(page, SESSION_MS);
  await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
  const last = await readStorage<MatchRecord>(page, STORAGE.lastResult);
  if (!last) throw new Error('The finished match was not persisted');
  return {
    id: last.id,
    score: (await byTestId(page, TEST_IDS.resultScore).textContent()) ?? '',
    time: (await byTestId(page, TEST_IDS.resultTime).textContent()) ?? '',
    reason: (await byTestId(page, TEST_IDS.resultReason).textContent()) ?? '',
  };
}

async function pendingState(page: Page): Promise<PendingState> {
  return (await readStorage<PendingState>(page, STORAGE.pending)) ?? { pending: [], confirmedIds: [] };
}

async function expectHistoryRow(page: Page, result: ResultSummary): Promise<void> {
  await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await expect(byTestId(page, TEST_IDS.logPendingRow)).toHaveCount(0);
  const row = rows(page).first();
  await expect(row).toContainText(result.score);
  await expect(row).toContainText(result.time);
  await expect(row).toContainText(result.reason);
}

async function expectSingleRankingEntry(page: Page, result: ResultSummary): Promise<void> {
  await expect(byTestId(page, TEST_IDS.logPanelRanking)).toBeVisible();
  await expect(rows(page)).toHaveCount(SHORT_SESSION_FIXTURES + 1);
  const mine = rows(page).filter({ has: page.getByText('You', { exact: true }) });
  await expect(mine).toHaveCount(1);
  await expect(mine).toContainText('Captain Jack');
  await expect(mine).toContainText(result.score);
}

test.describe('Match submission', () => {
  test('records a finished match exactly once in both tabs', async ({ page }) => {
    await startBattle(page, { options: SHORT_OPTIONS });
    const result = await finishBattle(page);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText(RECORDED_TEXT);
    await expect(byTestId(page, TEST_IDS.resultRetry)).toHaveCount(0);

    const stored = await pendingState(page);
    expect(stored.pending).toEqual([]);
    expect(stored.confirmedIds).toEqual([result.id]);
    const database = await readStorage<MatchRecord[]>(page, STORAGE.mockDatabase);
    expect(database?.filter((record) => record.id === result.id)).toHaveLength(1);

    await byTestId(page, TEST_IDS.resultMainMenu).click();
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expectHistoryRow(page, result);

    await byTestId(page, TEST_IDS.logTabRanking).click();
    await expectSingleRankingEntry(page, result);

    await byTestId(page, TEST_IDS.logMainMenu).click();
    await byTestId(page, TEST_IDS.menuRanking).click();
    await expectSingleRankingEntry(page, result);
    await byTestId(page, TEST_IDS.logMainMenu).click();
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expectHistoryRow(page, result);
  });

  test('repeated retries recover the record without duplicating it', async ({ page }) => {
    await startBattle(page, { options: SHORT_OPTIONS, scenario: 'submit-unavailable-recover' });
    const result = await finishBattle(page);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText(NOT_RECORDED_TEXT);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText('temporarily unavailable');
    await expect(byTestId(page, TEST_IDS.resultRetry)).toBeVisible();
    await expect
      .poll(async () => (await pendingState(page)).pending.map((entry) => entry.attempts))
      .toEqual([1]);

    await byTestId(page, TEST_IDS.resultRetry).click();
    await expect
      .poll(async () => (await pendingState(page)).pending.map((entry) => entry.attempts))
      .toEqual([2]);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText(NOT_RECORDED_TEXT);
    await expect(byTestId(page, TEST_IDS.resultRetry)).toBeVisible();

    await byTestId(page, TEST_IDS.resultRetry).click();
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText(RECORDED_TEXT);
    await expect(byTestId(page, TEST_IDS.resultRetry)).toHaveCount(0);
    await expect.poll(async () => (await pendingState(page)).pending).toEqual([]);
    expect((await pendingState(page)).confirmedIds).toEqual([result.id]);

    await byTestId(page, TEST_IDS.resultMainMenu).click();
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expectHistoryRow(page, result);
    await byTestId(page, TEST_IDS.logTabRanking).click();
    await expectSingleRankingEntry(page, result);
  });

  test('keeps a failed submission pending across a refresh and flushes it once the network recovers', async ({
    page,
  }) => {
    await startBattle(page, { options: SHORT_OPTIONS, scenario: 'network-error' });
    const result = await finishBattle(page);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText(NOT_RECORDED_TEXT);
    await expect(byTestId(page, TEST_IDS.resultRetry)).toBeVisible();

    const before = await pendingState(page);
    expect(before.pending.map((entry) => entry.record.id)).toEqual([result.id]);
    expect(before.pending[0]?.status).toBe('failed');
    expect(await readStorage<MatchRecord[]>(page, STORAGE.mockDatabase)).toBeNull();

    await page.reload();
    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(result.score);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText(NOT_RECORDED_TEXT);
    await expect(byTestId(page, TEST_IDS.resultRetry)).toBeVisible();
    await expect
      .poll(async () => (await pendingState(page)).pending.map((entry) => entry.attempts))
      .toEqual([2]);

    await byTestId(page, TEST_IDS.resultMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toContainText('One battle is waiting to be recorded.');
    await switchScenario(page, 'default');
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expectHistoryRow(page, result);

    const after = await pendingState(page);
    expect(after.pending).toEqual([]);
    expect(after.confirmedIds).toEqual([result.id]);
    const database = await readStorage<MatchRecord[]>(page, STORAGE.mockDatabase);
    expect(database?.map((record) => record.id)).toEqual([result.id]);

    await byTestId(page, TEST_IDS.logTabRanking).click();
    await expectSingleRankingEntry(page, result);
  });

  test('lets the player start another battle while a record is pending', async ({ page }) => {
    await startBattle(page, { options: SHORT_OPTIONS, scenario: 'network-error' });
    const first = await finishBattle(page);
    await expect(byTestId(page, TEST_IDS.resultRetry)).toBeVisible();

    await byTestId(page, TEST_IDS.resultPlayAgain).click();
    await waitForBattle(page);
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('01:00');
    await advanceInSteps(page, 5000);
    await expect(byTestId(page, TEST_IDS.hudTime)).not.toContainText('01:00');
    expect((await pendingState(page)).pending.map((entry) => entry.record.id)).toEqual([first.id]);

    await byTestId(page, TEST_IDS.hudPause).click();
    await byTestId(page, TEST_IDS.pauseMainMenu).click();
    await byTestId(page, TEST_IDS.confirmAccept).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toContainText('One battle is waiting to be recorded.');
    expect((await pendingState(page)).pending.map((entry) => entry.record.id)).toEqual([first.id]);

    await switchScenario(page, 'default');
    await byTestId(page, TEST_IDS.menuHistory).click();
    await expectHistoryRow(page, first);
    await expect.poll(async () => (await pendingState(page)).pending).toEqual([]);
    expect((await pendingState(page)).confirmedIds).toEqual([first.id]);
    const database = await readStorage<MatchRecord[]>(page, STORAGE.mockDatabase);
    expect(database?.map((record) => record.id)).toEqual([first.id]);

    await byTestId(page, TEST_IDS.logTabRanking).click();
    await expectSingleRankingEntry(page, first);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import type { MatchRecord } from '../src/data/contracts';
import type { DebugState } from '../src/game/battleRuntime';
import { battleState, byTestId, player, readStorage, startBattle, STORAGE, waitForBattle } from './support/app';

const SHORT_SESSION = { sessionSeconds: 60, spawnIntervalSeconds: 3 };
const LONG_SESSION = { sessionSeconds: 180, spawnIntervalSeconds: 1 };
const RECORDED_TEXT = 'Battle recorded in the ranking and match history.';

interface DriveOptions {
  maxMs: number;
  stepMs: number;
  aimAtEnemies: boolean;
}

async function driveUntilEnded(page: Page, options: DriveOptions): Promise<DebugState> {
  const state = await page.evaluate(({ maxMs, stepMs, aimAtEnemies }) => {
    const api = window.__pirateBattle;
    if (!api) return null;
    let elapsed = 0;
    let current = api.getState();
    while (current?.status === 'running' && elapsed < maxMs) {
      api.releaseAll();
      const me = current.ships.find((ship) => ship.kind === 'player');
      const foes = current.ships.filter((ship) => ship.kind !== 'player');
      if (aimAtEnemies && me && foes.length > 0) {
        let target = foes[0];
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const foe of foes) {
          const d = Math.hypot(foe.x - me.x, foe.y - me.y);
          if (d < bestDistance) {
            bestDistance = d;
            target = foe;
          }
        }
        if (target) {
          const desired = Math.atan2(target.y - me.y, target.x - me.x);
          let delta = desired - me.heading;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          if (delta > 0.05) api.press('turnRight');
          else if (delta < -0.05) api.press('turnLeft');
          if (Math.abs(delta) < 0.2) api.press('fireFront');
        }
      }
      api.advance(stepMs);
      elapsed += stepMs;
      current = api.getState();
    }
    api.releaseAll();
    return current;
  }, options);
  if (!state) throw new Error('Battle runtime is not active');
  return state;
}

async function finishTimeUpMatch(page: Page): Promise<DebugState> {
  await startBattle(page, { options: SHORT_SESSION });
  const state = await driveUntilEnded(page, {
    maxMs: (SHORT_SESSION.sessionSeconds + 2) * 1000,
    stepMs: 100,
    aimAtEnemies: true,
  });
  expect(state.status).toBe('ended');
  expect(state.remainingSeconds).toBe(0);
  expect(player(state).health).toBeGreaterThan(0);
  await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
  return state;
}

test.describe('Result screen', () => {
  test('shows score, played time, reason and records the battle after time up', async ({ page }) => {
    const finalState = await finishTimeUpMatch(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Battle Complete' })).toBeVisible();
    expect(finalState.score).toBeGreaterThan(0);
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(String(finalState.score));
    await expect(byTestId(page, TEST_IDS.resultTime)).toHaveText('01:00');
    await expect(byTestId(page, TEST_IDS.resultReason)).toHaveText('Time up');
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toHaveText(RECORDED_TEXT);
    await expect(byTestId(page, TEST_IDS.resultRetry)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.resultPlayAgain)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultMainMenu)).toBeVisible();
    expect(finalState.elapsedSeconds).toBeCloseTo(SHORT_SESSION.sessionSeconds, 1);
  });

  test('persists the result across a refresh and clears it when leaving to the menu', async ({ page }) => {
    const finalState = await finishTimeUpMatch(page);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toHaveText(RECORDED_TEXT);

    const stored = await readStorage<MatchRecord>(page, STORAGE.lastResult);
    expect(stored).not.toBeNull();
    expect(stored?.score).toBe(finalState.score);
    expect(stored?.durationSeconds).toBe(SHORT_SESSION.sessionSeconds);
    expect(stored?.endReason).toBe('time_up');
    expect(stored?.config).toEqual(SHORT_SESSION);
    expect(await readStorage<string>(page, STORAGE.screen)).toBe('result');

    await page.reload();
    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.screenSplash)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Battle Complete' })).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(String(finalState.score));
    await expect(byTestId(page, TEST_IDS.resultTime)).toHaveText('01:00');
    await expect(byTestId(page, TEST_IDS.resultReason)).toHaveText('Time up');
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toContainText('recorded');

    const storedAfterReload = await readStorage<MatchRecord>(page, STORAGE.lastResult);
    expect(storedAfterReload).toEqual(stored);

    await byTestId(page, TEST_IDS.resultMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
    expect(await readStorage<string>(page, STORAGE.screen)).toBeNull();

    await page.reload();
    await expect(byTestId(page, TEST_IDS.screenSplash)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.screenResult)).toHaveCount(0);
  });

  test('play again starts a fresh battle', async ({ page }) => {
    await finishTimeUpMatch(page);
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toHaveText(RECORDED_TEXT);

    await byTestId(page, TEST_IDS.resultPlayAgain).click();
    await waitForBattle(page);
    await expect(byTestId(page, TEST_IDS.screenResult)).toHaveCount(0);
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('01:00');
    await expect(byTestId(page, TEST_IDS.hudScore)).toContainText('0');

    const fresh = await battleState(page);
    expect(fresh.status).toBe('running');
    expect(fresh.score).toBe(0);
    expect(fresh.elapsedSeconds).toBe(0);
    expect(fresh.remainingSeconds).toBe(SHORT_SESSION.sessionSeconds);
    expect(fresh.projectiles).toHaveLength(0);
    expect(fresh.ships).toHaveLength(1);
    const ship = player(fresh);
    expect(ship.health).toBe(ship.maxHealth);
    expect(await readStorage<string>(page, STORAGE.screen)).toBeNull();
  });

  test('a sunk ship shows the defeat title and reason', async ({ page }) => {
    await startBattle(page, { options: LONG_SESSION });

    const state = await driveUntilEnded(page, {
      maxMs: (LONG_SESSION.sessionSeconds - 10) * 1000,
      stepMs: 500,
      aimAtEnemies: false,
    });

    expect(state.status).toBe('ended');
    expect(player(state).health).toBe(0);
    expect(state.remainingSeconds).toBeGreaterThan(0);

    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Ship Sunk' })).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultReason)).toHaveText('Defeated');
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(String(state.score));
    await expect(byTestId(page, TEST_IDS.resultTime)).not.toHaveText('03:00');
    await expect(byTestId(page, TEST_IDS.resultSubmission)).toHaveText(RECORDED_TEXT);

    const stored = await readStorage<MatchRecord>(page, STORAGE.lastResult);
    expect(stored?.endReason).toBe('defeated');
    expect(stored?.durationSeconds).toBeCloseTo(state.elapsedSeconds, 0);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import type { DebugState } from '../src/game/battleRuntime';
import { advance, battleState, byTestId, openMenu, player, startBattle } from './support/app';

const SHORT_SESSION = { sessionSeconds: 60, spawnIntervalSeconds: 3 };

async function driveToTimeUp(page: Page, maxMs: number): Promise<DebugState> {
  const state = await page.evaluate((limit) => {
    const api = window.__pirateBattle;
    if (!api) return null;
    let elapsed = 0;
    let current = api.getState();
    while (current?.status === 'running' && elapsed < limit) {
      api.releaseAll();
      const me = current.ships.find((ship) => ship.kind === 'player');
      const foes = current.ships.filter((ship) => ship.kind !== 'player');
      if (me && foes.length > 0) {
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
      api.advance(100);
      elapsed += 100;
      current = api.getState();
    }
    api.releaseAll();
    return current;
  }, maxMs);
  if (!state) throw new Error('Battle runtime is not active');
  return state;
}

test.describe('Visual regression', () => {
  test('main menu', async ({ page }) => {
    await openMenu(page);
    await expect(byTestId(page, TEST_IDS.menuPlay)).toBeFocused();
    await expect(page).toHaveScreenshot('menu.png', { fullPage: true });
  });

  test('arena in a stable state', async ({ page }) => {
    await startBattle(page, { seed: 'visual' });
    await advance(page, 3500);
    const state = await battleState(page);
    expect(state.status).toBe('running');
    expect(state.ships).toHaveLength(2);
    expect(state.projectiles).toHaveLength(0);
    expect(player(state).speed).toBe(0);
    await expect(byTestId(page, TEST_IDS.hudTime)).toHaveText('01:57');
    await expect(byTestId(page, TEST_IDS.hudScore)).toHaveText('0');
    await expect(page).toHaveScreenshot('arena.png');
  });

  test('result screen after a time-up match', async ({ page }) => {
    await startBattle(page, { options: SHORT_SESSION });
    const state = await driveToTimeUp(page, (SHORT_SESSION.sessionSeconds + 2) * 1000);
    expect(state.status).toBe('ended');
    expect(state.remainingSeconds).toBe(0);
    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultTime)).toHaveText('01:00');
    await expect(byTestId(page, TEST_IDS.resultReason)).toHaveText('Time up');
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(String(state.score));
    await expect(byTestId(page, TEST_IDS.resultPlayAgain)).toBeFocused();
    await expect(page).toHaveScreenshot('result.png', {
      fullPage: true,
      mask: [byTestId(page, TEST_IDS.resultSubmission)],
    });
  });
});

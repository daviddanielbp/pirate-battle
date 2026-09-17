import { expect, test, type Page } from '@playwright/test';
import { TEST_IDS } from '../src/testing/testIds';
import { DEFAULT_GAMEPLAY_CONFIG } from '../src/game/config/gameplayConfig';
import type { DebugState } from '../src/game/battleRuntime';
import { advanceInSteps, battleState, byTestId, player, startBattle, waitForBattle } from './support/app';

const FRAME_MS = 1000 / 60;
const FIXED_STEP_SECONDS = DEFAULT_GAMEPLAY_CONFIG.fixedStepSeconds;

function formatClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  const pad = (value: number): string => (value < 10 ? `0${value}` : String(value));
  return `${pad(minutes)}:${pad(seconds)}`;
}

interface HudReading {
  time: string;
  status: string;
  health: string;
  pauseDisabled: boolean;
}

interface FrozenProbe {
  afterAdvance: DebugState;
  afterInput: DebugState;
  hud: HudReading;
}

interface DriveResult {
  final: DebugState;
  frozen: FrozenProbe | null;
}

type Tactic = 'aim-and-fire' | 'hold-still';

async function driveMatch(page: Page, tactic: Tactic, totalMs: number, chunkMs: number): Promise<DriveResult | null> {
  return page.evaluate(
    async ({ tactic, totalMs, chunkMs, ids }) => {
      const api = window.__pirateBattle;
      if (!api) return null;
      let advanced = 0;
      if (tactic === 'aim-and-fire') api.press('fireFront');
      while (advanced < totalMs) {
        const state = api.getState();
        if (state?.status !== 'running') break;
        if (tactic === 'aim-and-fire') {
          const pilot = state.ships.find((ship) => ship.kind === 'player');
          if (!pilot) break;
          let nearest: { x: number; y: number } | null = null;
          let best = Number.POSITIVE_INFINITY;
          for (const ship of state.ships) {
            if (ship.kind === 'player') continue;
            const gap = Math.hypot(ship.x - pilot.x, ship.y - pilot.y);
            if (gap < best) {
              best = gap;
              nearest = ship;
            }
          }
          api.release('turnLeft');
          api.release('turnRight');
          if (nearest) {
            let delta = Math.atan2(nearest.y - pilot.y, nearest.x - pilot.x) - pilot.heading;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            if (delta > 0.04) api.press('turnRight');
            else if (delta < -0.04) api.press('turnLeft');
          }
        }
        const step = Math.min(chunkMs, totalMs - advanced);
        api.advance(step);
        advanced += step;
      }
      api.releaseAll();
      const final = api.getState();
      if (!final) return null;
      if (final.status !== 'ended') return { final, frozen: null };
      api.advance(5000);
      const afterAdvance = api.getState();
      if (!afterAdvance) return null;
      api.press('forward');
      api.press('turnLeft');
      api.press('fireFront');
      api.press('fireLeft');
      api.advance(1000);
      api.releaseAll();
      const afterInput = api.getState();
      if (!afterInput) return null;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const read = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      const hud: HudReading = {
        time: read(ids.time)?.textContent ?? '',
        status: read(ids.status)?.textContent ?? '',
        health: read(ids.health)?.getAttribute('aria-valuenow') ?? '',
        pauseDisabled: read(ids.pause)?.matches(':disabled') ?? false,
      };
      return { final, frozen: { afterAdvance, afterInput, hud } };
    },
    {
      tactic,
      totalMs,
      chunkMs,
      ids: { time: TEST_IDS.hudTime, status: TEST_IDS.hudStatus, health: TEST_IDS.hudHealth, pause: TEST_IDS.hudPause },
    },
  );
}

function expectSameSimulation(before: DebugState, after: DebugState): void {
  expect(after.status).toBe('ended');
  expect(after.elapsedSeconds).toBe(before.elapsedSeconds);
  expect(after.remainingSeconds).toBe(before.remainingSeconds);
  expect(after.score).toBe(before.score);
  expect(after.ships).toEqual(before.ships);
  expect(after.projectiles).toEqual(before.projectiles);
  expect(after.cooldowns).toEqual(before.cooldowns);
}

test.describe('Match end', () => {
  test('ends by time after a 60 s session, freezes the simulation and shows the result', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 10 } });
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('01:00');

    const fought = await driveMatch(page, 'aim-and-fire', 60_000, FRAME_MS);
    if (!fought) throw new Error('Battle runtime is not active');
    expect(player(fought.final).health).toBeGreaterThan(0);
    expect(fought.final.remainingSeconds).toBeLessThanOrEqual(FIXED_STEP_SECONDS + 1e-6);

    const match = await driveMatch(page, 'aim-and-fire', FRAME_MS, FRAME_MS);
    if (!match?.frozen) throw new Error('The match did not end by time');
    const { final: ended, frozen } = match;
    expect(ended.status).toBe('ended');
    expect(ended.elapsedSeconds).toBe(60);
    expect(ended.remainingSeconds).toBe(0);
    expect(player(ended).health).toBeGreaterThan(0);
    expectSameSimulation(ended, frozen.afterAdvance);
    expectSameSimulation(ended, frozen.afterInput);
    expect(frozen.hud.time).toContain('00:00');
    expect(frozen.hud.status).toContain('Battle over');
    expect(frozen.hud.status).toContain('00:00 remaining');
    expect(frozen.hud.pauseDisabled).toBe(true);

    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultReason)).toHaveText('Time up');
    await expect(byTestId(page, TEST_IDS.resultTime)).toHaveText('01:00');
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(String(ended.score));
    await expect(page.getByRole('heading', { level: 1, name: 'Battle Complete' })).toBeVisible();
  });

  test('ends by defeat when health reaches zero and reports the played time', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 180, spawnIntervalSeconds: 1 } });

    const match = await driveMatch(page, 'hold-still', 90_000, 500);
    if (!match?.frozen) throw new Error('The player was not defeated within 90 s');
    const { final: ended, frozen } = match;
    expect(ended.status).toBe('ended');
    expect(player(ended).health).toBe(0);
    expect(ended.elapsedSeconds).toBeGreaterThan(0);
    expect(ended.elapsedSeconds).toBeLessThan(90);
    expect(ended.remainingSeconds).toBeGreaterThan(0);
    expect(ended.ships.length).toBeGreaterThan(1);
    expectSameSimulation(ended, frozen.afterAdvance);
    expectSameSimulation(ended, frozen.afterInput);
    expect(frozen.hud.health).toBe('0');
    expect(frozen.hud.status).toContain('Battle over');
    expect(frozen.hud.pauseDisabled).toBe(true);

    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultReason)).toHaveText('Defeated');
    const storedSeconds = Math.round(ended.elapsedSeconds * 10) / 10;
    await expect(byTestId(page, TEST_IDS.resultTime)).toHaveText(formatClock(storedSeconds));
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(String(ended.score));
    await expect(page.getByRole('heading', { level: 1, name: 'Ship Sunk' })).toBeVisible();
  });

  test('restarts cleanly from the result screen', async ({ page }) => {
    await startBattle(page, { options: { sessionSeconds: 60, spawnIntervalSeconds: 1 } });
    const start = player(await battleState(page));
    const match = await driveMatch(page, 'hold-still', 90_000, 500);
    if (!match?.frozen) throw new Error('The player was not defeated within 90 s');
    const ended = match.final;
    expect(ended.status).toBe('ended');
    expect(ended.ships.length).toBeGreaterThan(1);
    expect(ended.elapsedSeconds).toBeGreaterThan(0);

    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(String(ended.score));
    const gone = await page.evaluate(() => window.__pirateBattle?.hasBattle() === false);
    expect(gone).toBe(true);

    await byTestId(page, TEST_IDS.resultPlayAgain).click();
    await waitForBattle(page);

    const fresh = await battleState(page);
    expect(fresh.status).toBe('running');
    expect(fresh.elapsedSeconds).toBe(0);
    expect(fresh.remainingSeconds).toBe(60);
    expect(fresh.score).toBe(0);
    expect(fresh.projectiles).toEqual([]);
    expect(fresh.ships).toHaveLength(1);
    expect(fresh.cooldowns).toEqual({ front: 0, left: 0, right: 0 });
    const pilot = player(fresh);
    expect(pilot.health).toBe(DEFAULT_GAMEPLAY_CONFIG.player.maxHealth);
    expect(pilot.x).toBe(start.x);
    expect(pilot.y).toBe(start.y);
    expect(pilot.heading).toBe(start.heading);
    expect(pilot.speed).toBe(0);

    await expect(byTestId(page, TEST_IDS.hudScore)).toContainText('0');
    await expect(byTestId(page, TEST_IDS.hudTime)).toContainText('01:00');
    await expect(byTestId(page, TEST_IDS.hudHealth)).toHaveAttribute('aria-valuenow', '100');
    await expect(byTestId(page, TEST_IDS.hudStatus)).toContainText('In battle');
    await expect(byTestId(page, TEST_IDS.hudPause)).toBeEnabled();

    await advanceInSteps(page, 1000);
    const running = await battleState(page);
    expect(running.status).toBe('running');
    expect(running.elapsedSeconds).toBeGreaterThan(0.9);
    expect(running.elapsedSeconds).toBeLessThan(1.1);
  });
});

import { expect, test, type Page } from '@playwright/test';
import type { DebugState } from '../src/game/battleRuntime';
import type { PlayerProgress } from '../src/game/progression/progression';
import { TEST_IDS } from '../src/testing/testIds';
import {
  advance,
  advanceInSteps,
  battleState,
  byTestId,
  enemies,
  player,
  press,
  readStorage,
  release,
  startBattle,
  STORAGE,
} from './support/app';

const FRAME_MS = 1000 / 60;
const STEP_MS = 1000 / 60;
const START = { x: 160, y: 544 };
const HALF_LENGTH = 32;
const CHASER_BASE_HEALTH = 50;
const SHOOTER_BASE_HEALTH = 80;
const PLAYER_BASE_HEALTH = 100;
const DOUBLE_SHOT_DAMAGE = 30;
const DOUBLE_SHOT_SPACING = 14;
const LEVEL_TWO_XP = 30;
const LEVEL_THREE_XP = 70;
const XP_PER_CHASER = 1;
const XP_PER_SHOOTER = 2;
const SHORT_SESSION = { sessionSeconds: 60, spawnIntervalSeconds: 3 };

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

function playerProjectiles(state: DebugState) {
  return state.projectiles.filter((projectile) => projectile.faction === 'player');
}

interface HuntResult {
  healthTrail: number[];
  destroyed: boolean;
  state: DebugState;
}

async function huntTarget(page: Page, targetId: number, maxMs: number): Promise<HuntResult> {
  const result = await page.evaluate(
    ({ targetId, maxMs, frameMs }) => {
      const api = window.__pirateBattle;
      if (!api) return null;
      const healthTrail: number[] = [];
      let destroyed = false;
      let advanced = 0;
      while (advanced < maxMs) {
        const state = api.getState();
        if (state?.status !== 'running') break;
        const target = state.ships.find((ship) => ship.id === targetId);
        if (!target) {
          destroyed = true;
          break;
        }
        if (healthTrail[healthTrail.length - 1] !== target.health) healthTrail.push(target.health);
        const pilot = state.ships.find((ship) => ship.kind === 'player');
        if (!pilot) break;
        let delta = Math.atan2(target.y - pilot.y, target.x - pilot.x) - pilot.heading;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        api.releaseAll();
        if (delta > 0.04) api.press('turnRight');
        else if (delta < -0.04) api.press('turnLeft');
        else api.press('fireFront');
        api.advance(frameMs);
        advanced += frameMs;
      }
      api.releaseAll();
      const state = api.getState();
      if (!state) return null;
      return { healthTrail, destroyed, state };
    },
    { targetId, maxMs, frameMs: FRAME_MS },
  );
  if (!result) throw new Error('Battle runtime is not active');
  return result;
}

async function fightUntilEnd(page: Page, maxMs: number): Promise<DebugState> {
  const state = await page.evaluate(
    ({ maxMs, frameMs }) => {
      const api = window.__pirateBattle;
      if (!api) return null;
      let advanced = 0;
      let current = api.getState();
      while (current?.status === 'running' && advanced < maxMs) {
        const pilot = current.ships.find((ship) => ship.kind === 'player');
        let nearest: { x: number; y: number } | null = null;
        let best = Number.POSITIVE_INFINITY;
        for (const ship of current.ships) {
          if (ship.kind === 'player' || !pilot) continue;
          const gap = Math.hypot(ship.x - pilot.x, ship.y - pilot.y);
          if (gap < best) {
            best = gap;
            nearest = ship;
          }
        }
        api.releaseAll();
        if (pilot && nearest) {
          let delta = Math.atan2(nearest.y - pilot.y, nearest.x - pilot.x) - pilot.heading;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          if (delta > 0.04) api.press('turnRight');
          else if (delta < -0.04) api.press('turnLeft');
          if (Math.abs(delta) < 0.2) api.press('fireFront');
        }
        api.advance(frameMs);
        advanced += frameMs;
        current = api.getState();
      }
      api.releaseAll();
      return current;
    },
    { maxMs, frameMs: FRAME_MS * 3 },
  );
  if (!state) throw new Error('Battle runtime is not active');
  return state;
}

async function firstEnemy(page: Page, spawnMs: number) {
  await advanceInSteps(page, spawnMs + 100);
  const spawned = enemies(await battleState(page));
  expect(spawned).toHaveLength(1);
  const enemy = spawned[0];
  if (!enemy) throw new Error('Enemy did not spawn');
  return enemy;
}

async function abandonBattle(page: Page): Promise<void> {
  await byTestId(page, TEST_IDS.hudPause).click();
  await expect(byTestId(page, TEST_IDS.pauseDialog)).toBeVisible();
  await byTestId(page, TEST_IDS.pauseMainMenu).click();
  await expect(byTestId(page, TEST_IDS.confirmDialog)).toBeVisible();
  await byTestId(page, TEST_IDS.confirmAccept).click();
  await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
}

test.describe('Progression', () => {
  test('a fresh captain starts at level 1 with no coins', async ({ page }) => {
    await startBattle(page);
    expect(await readStorage<PlayerProgress>(page, STORAGE.progress)).toBeNull();
    await abandonBattle(page);
    await expect(byTestId(page, TEST_IDS.screenMenu)).toContainText('Level 1 · 0 coins · 0/30 XP');
  });

  test('enemies gain 10% health per level above 1', async ({ page }) => {
    await startBattle(page, { options: SHORT_SESSION, progress: progressWith({ xp: LEVEL_TWO_XP }) });
    expect(player(await battleState(page)).maxHealth).toBe(PLAYER_BASE_HEALTH);
    const chaser = await firstEnemy(page, 3000);
    expect(chaser.kind).toBe('chaser');
    expect(chaser.health).toBe(Math.round(CHASER_BASE_HEALTH * 1.1));
    expect(chaser.maxHealth).toBe(Math.round(CHASER_BASE_HEALTH * 1.1));

    await advanceInSteps(page, 3000);
    const shooter = enemies(await battleState(page)).find((ship) => ship.kind === 'shooter');
    if (!shooter) throw new Error('Shooter did not spawn');
    expect(shooter.maxHealth).toBe(Math.round(SHOOTER_BASE_HEALTH * 1.1));

    await abandonBattle(page);
    await expect(byTestId(page, TEST_IDS.screenMenu)).toContainText('Level 2 · 0 coins · 0/40 XP');
  });

  test('a level 3 captain faces enemies with 20% more health', async ({ page }) => {
    await startBattle(page, { options: SHORT_SESSION, progress: progressWith({ xp: LEVEL_THREE_XP }) });
    const chaser = await firstEnemy(page, 3000);
    expect(chaser.maxHealth).toBe(Math.round(CHASER_BASE_HEALTH * 1.2));
    await abandonBattle(page);
    await expect(byTestId(page, TEST_IDS.screenMenu)).toContainText('Level 3 · 0 coins · 0/50 XP');
  });

  test('the twin cannon fires two projectiles per shot dealing 30 each', async ({ page }) => {
    await startBattle(page, {
      options: SHORT_SESSION,
      progress: progressWith({ cannon: 'double', ownedCannons: ['single', 'double'] }),
    });
    await press(page, 'fireFront');
    await advance(page, STEP_MS);
    const volley = playerProjectiles(await battleState(page));
    expect(volley).toHaveLength(2);
    const ys = volley.map((projectile) => projectile.y).sort((a, b) => a - b);
    expect((ys[1] ?? 0) - (ys[0] ?? 0)).toBeCloseTo(DOUBLE_SHOT_SPACING, 3);
    for (const projectile of volley) expect(projectile.x).toBeGreaterThan(START.x + HALF_LENGTH);
    await release(page, 'fireFront');
    await advanceInSteps(page, 1500);
    expect(playerProjectiles(await battleState(page))).toHaveLength(0);

    const chaser = await firstEnemy(page, 3000 - 1500 - STEP_MS);
    expect(chaser.health).toBe(CHASER_BASE_HEALTH);
    const hunt = await huntTarget(page, chaser.id, 8000);
    expect(hunt.destroyed).toBe(true);
    expect(hunt.healthTrail).toEqual([CHASER_BASE_HEALTH, CHASER_BASE_HEALTH - DOUBLE_SHOT_DAMAGE]);
    expect(hunt.state.score).toBe(1);
    expect(hunt.state.kills).toEqual({ chaser: 1, shooter: 0 });
  });

  test('the reinforced hull upgrade raises the starting health to 140 at level 4', async ({ page }) => {
    await startBattle(page, { options: SHORT_SESSION, progress: progressWith({ upgrades: { health: 4, damage: 0, speed: 0 } }) });
    const pilot = player(await battleState(page));
    expect(pilot.health).toBe(140);
    expect(pilot.maxHealth).toBe(140);
    await expect(byTestId(page, TEST_IDS.hudHealth)).toHaveAttribute('aria-valuenow', '140');
    await expect(byTestId(page, TEST_IDS.hudHealth)).toHaveAttribute('aria-valuemax', '140');

    const chaser = await firstEnemy(page, 3000);
    expect(chaser.maxHealth).toBe(CHASER_BASE_HEALTH);
  });

  test('a finished match grants coins and XP, levels up and records the loadout', async ({ page }) => {
    const seeded = progressWith({ coins: 5, xp: LEVEL_TWO_XP - 1 });
    await startBattle(page, { options: SHORT_SESSION, progress: seeded });
    const ended = await fightUntilEnd(page, (SHORT_SESSION.sessionSeconds + 2) * 1000);
    expect(ended.status).toBe('ended');
    const kills = ended.kills;
    expect(kills.chaser + kills.shooter).toBe(ended.score);
    expect(ended.score).toBeGreaterThan(0);
    const xpGained = kills.chaser * XP_PER_CHASER + kills.shooter * XP_PER_SHOOTER;

    await expect(byTestId(page, TEST_IDS.screenResult)).toBeVisible();
    await expect(byTestId(page, TEST_IDS.resultScore)).toHaveText(String(ended.score));
    const rewards = byTestId(page, TEST_IDS.resultRewards);
    await expect(rewards).toContainText(`+${ended.score} coins · +${xpGained} XP`);
    await expect(rewards).toContainText('Level up! Now level 2');

    const stored = await readStorage<PlayerProgress>(page, STORAGE.progress);
    expect(stored).toEqual({ ...seeded, coins: seeded.coins + ended.score, xp: seeded.xp + xpGained });

    await byTestId(page, TEST_IDS.resultMainMenu).click();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toContainText(
      `Level 2 · ${seeded.coins + ended.score} coins · ${seeded.xp + xpGained - LEVEL_TWO_XP}/40 XP`,
    );

    await byTestId(page, TEST_IDS.menuHistory).click();
    await expect(byTestId(page, TEST_IDS.logPanelHistory)).toBeVisible();
    const row = byTestId(page, TEST_IDS.logPanelHistory).getByTestId(TEST_IDS.logRow).first();
    await expect(row).toContainText('Lv 1 · iron cannon');
    await expect(row).toContainText(String(ended.score));
  });

  test('an abandoned match grants nothing', async ({ page }) => {
    const seeded = progressWith({ coins: 5, xp: LEVEL_TWO_XP - 1 });
    await startBattle(page, { options: SHORT_SESSION, progress: seeded });
    const chaser = await firstEnemy(page, 3000);
    const hunt = await huntTarget(page, chaser.id, 8000);
    expect(hunt.destroyed).toBe(true);
    expect(hunt.state.score).toBe(1);

    await abandonBattle(page);
    expect(await readStorage<PlayerProgress>(page, STORAGE.progress)).toEqual(seeded);
    expect(await readStorage<unknown>(page, STORAGE.lastRewards)).toBeNull();
    await expect(byTestId(page, TEST_IDS.screenMenu)).toContainText('Level 1 · 5 coins · 29/30 XP');
    await expect(byTestId(page, TEST_IDS.resultRewards)).toHaveCount(0);
  });
});

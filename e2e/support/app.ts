import { expect, type Page } from '@playwright/test';
import { TEST_IDS } from '../../src/testing/testIds';
import type { DebugState } from '../../src/game/battleRuntime';
import type { SteeringMode } from '../../src/game/config/gameplayConfig';
import type { ControlAction } from '../../src/game/input/controls';
import type { PlayerProgress } from '../../src/game/progression/progression';

export interface StoredOptions {
  sessionSeconds: number;
  spawnIntervalSeconds: number;
  steering?: SteeringMode;
}

export interface AppOptions {
  seed?: string;
  clock?: 'manual' | 'auto';
  scenario?: string;
  latency?: number;
  touch?: boolean;
  options?: StoredOptions;
  progress?: PlayerProgress;
}

export const STORAGE = {
  options: 'pirate-battle.options.v1',
  lastResult: 'pirate-battle.last-result.v1',
  screen: 'pirate-battle.screen.v1',
  pending: 'pirate-battle.pending-submissions.v1',
  mockDatabase: 'pirate-battle.mock-database.v1',
  scenario: 'pirate-battle.network-scenario.v1',
  player: 'pirate-battle.player.v1',
  progress: 'pirate-battle.progress.v1',
  lastRewards: 'pirate-battle.last-rewards.v1',
} as const;

export function byTestId(page: Page, id: string) {
  return page.getByTestId(id);
}

export function appUrl(options: AppOptions = {}): string {
  const params = new URLSearchParams({ test: '1' });
  params.set('seed', options.seed ?? 'e2e');
  params.set('clock', options.clock ?? 'manual');
  params.set('latency', String(options.latency ?? 0));
  if (options.scenario) params.set('scenario', options.scenario);
  if (options.touch) params.set('touch', '1');
  return `/?${params.toString()}`;
}

export async function openApp(page: Page, options: AppOptions = {}): Promise<void> {
  await page.goto(appUrl(options));
  await page.evaluate(
    ({ keys, playerOptions, progress }) => {
      for (const key of Object.values(keys)) localStorage.removeItem(key);
      if (playerOptions) localStorage.setItem(keys.options, JSON.stringify(playerOptions));
      if (progress) localStorage.setItem(keys.progress, JSON.stringify(progress));
    },
    { keys: STORAGE, playerOptions: options.options ?? null, progress: options.progress ?? null },
  );
  await page.goto(appUrl(options));
  await expect(byTestId(page, TEST_IDS.screenSplash)).toBeVisible();
}

export async function openMenu(page: Page, options: AppOptions = {}): Promise<void> {
  await openApp(page, options);
  await byTestId(page, TEST_IDS.splashStart).click();
  await expect(byTestId(page, TEST_IDS.screenMenu)).toBeVisible();
}

export async function startBattle(page: Page, options: AppOptions = {}): Promise<void> {
  await openMenu(page, options);
  await byTestId(page, TEST_IDS.menuPlay).click();
  await waitForBattle(page);
}

export async function waitForBattle(page: Page): Promise<void> {
  await expect(byTestId(page, TEST_IDS.screenBattle)).toBeVisible();
  await page.waitForFunction(() => window.__pirateBattle?.getState()?.status === 'running', null, { timeout: 30_000 });
  await expect(byTestId(page, TEST_IDS.hudScore)).toBeAttached();
}

export async function battleState(page: Page): Promise<DebugState> {
  const state = await page.evaluate(() => window.__pirateBattle?.getState() ?? null);
  if (!state) throw new Error('Battle runtime is not active');
  return state;
}

export async function advance(page: Page, milliseconds: number): Promise<void> {
  await page.evaluate((value) => window.__pirateBattle?.advance(value), milliseconds);
}

export async function advanceInSteps(page: Page, totalMs: number, stepMs = 500): Promise<void> {
  let remaining = totalMs;
  while (remaining > 0) {
    const chunk = Math.min(stepMs, remaining);
    await advance(page, chunk);
    remaining -= chunk;
  }
}

export async function press(page: Page, action: ControlAction): Promise<void> {
  await page.evaluate((value) => window.__pirateBattle?.press(value), action);
}

export async function release(page: Page, action: ControlAction): Promise<void> {
  await page.evaluate((value) => window.__pirateBattle?.release(value), action);
}

export async function releaseAll(page: Page): Promise<void> {
  await page.evaluate(() => window.__pirateBattle?.releaseAll());
}

export function player(state: DebugState) {
  const ship = state.ships.find((candidate) => candidate.kind === 'player');
  if (!ship) throw new Error('Player ship missing');
  return ship;
}

export function enemies(state: DebugState) {
  return state.ships.filter((candidate) => candidate.kind !== 'player');
}

export async function readStorage<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as unknown) : null;
  }, key) as Promise<T | null>;
}

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

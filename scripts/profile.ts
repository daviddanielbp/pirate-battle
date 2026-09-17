import { mkdirSync, writeFileSync } from 'node:fs';
import { renderFrameTimesChart, renderMemoryChart } from './profileCharts';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import type { PerfReport } from '../src/testing/testApi';

interface MemorySample {
  cycle: number;
  usedJsHeapMb: number;
}

const baseUrl = process.env.PROFILE_URL ?? 'http://localhost:4173';
const width = Number(process.env.PROFILE_WIDTH ?? 1920);
const height = Number(process.env.PROFILE_HEIGHT ?? 1080);
const scale = Number(process.env.PROFILE_SCALE ?? 1);
const matchSeconds = Number(process.env.PROFILE_MATCH_SECONDS ?? 180);
const spawnSeconds = Number(process.env.PROFILE_SPAWN_SECONDS ?? 3);
const cycleSeconds = Number(process.env.PROFILE_CYCLE_SECONDS ?? 12);
const output = join(process.cwd(), 'docs', 'reports');

const cleanState = `localStorage.clear(); localStorage.setItem('pirate-battle.options.v1', JSON.stringify({ sessionSeconds: ${matchSeconds}, spawnIntervalSeconds: ${spawnSeconds} }));`;

async function waitForBattle(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__pirateBattle?.getState()?.status === 'running', null, { timeout: 60_000 });
}

async function autopilot(page: Page, seconds: number, keepAlive: boolean): Promise<void> {
  await page.evaluate(
    ({ limitMs, keepAlive: immortal }) =>
      new Promise<void>((resolve) => {
        const api = window.__pirateBattle;
        if (!api) {
          resolve();
          return;
        }
        const startedAt = performance.now();
        const timer = window.setInterval(() => {
          const state = api.getState();
          if (state?.status !== 'running' || performance.now() - startedAt > limitMs) {
            window.clearInterval(timer);
            api.releaseAll();
            resolve();
            return;
          }
          api.releaseAll();
          if (immortal) api.restorePlayerHealth();
          const me = state.ships.find((ship) => ship.kind === 'player');
          const foes = state.ships.filter((ship) => ship.kind !== 'player');
          if (!me) return;
          const chasers = foes.filter((foe) => foe.kind === 'chaser');
          const pool = chasers.length > 0 ? chasers : foes;
          let target = pool[0];
          let bestDistance = Number.POSITIVE_INFINITY;
          for (const foe of pool) {
            const d = Math.hypot(foe.x - me.x, foe.y - me.y);
            if (d < bestDistance) {
              bestDistance = d;
              target = foe;
            }
          }
          if (!target) {
            api.press('forward');
            if (me.x > 1300 || me.y > 700 || me.x < 300 || me.y < 200) api.press('turnRight');
            return;
          }
          let delta = Math.atan2(target.y - me.y, target.x - me.x) - me.heading;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          if (delta > 0.05) api.press('turnRight');
          else if (delta < -0.05) api.press('turnLeft');
          if (Math.abs(delta) < 0.25) api.press('fireFront');
          if (target.kind !== 'chaser' || bestDistance > 300) api.press('forward');
          const side = Math.abs(Math.abs(delta) - Math.PI / 2);
          if (side < 0.35 && bestDistance < 300) api.press(delta > 0 ? 'fireRight' : 'fireLeft');
        }, 100);
      }),
    { limitMs: seconds * 1000, keepAlive },
  );
}

async function measureHeap(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const gc = (window as unknown as { gc?: () => void }).gc;
    for (let round = 0; round < 3; round += 1) {
      gc?.();
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
  });
}

async function leaveBattle(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.click('[data-testid="pause-main-menu"]');
  await page.click('[data-testid="confirm-accept"]');
  await page.waitForSelector('[data-testid="screen-menu"]');
}

async function main(): Promise<void> {
  const channel = process.env.PROFILE_CHANNEL;
  const browser = await chromium.launch({
    headless: false,
    ...(channel ? { channel } : {}),
    args: ['--js-flags=--expose-gc', '--enable-gpu-rasterization'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.goto(`${baseUrl}/?test=1&seed=profile&latency=0`);
  await page.evaluate(cleanState);
  await page.reload();
  await page.click('[data-testid="menu-play"]');
  await waitForBattle(page);
  await page.evaluate(() => window.__pirateBattle?.startPerf());
  await autopilot(page, matchSeconds + 5, true);
  const perf: PerfReport | null = await page.evaluate(() => window.__pirateBattle?.stopPerf() ?? null);
  const finalState = await page.evaluate(() => window.__pirateBattle?.getState() ?? null);
  await page.waitForSelector('[data-testid="screen-result"]', { timeout: 30_000 });
  await page.click('[data-testid="result-main-menu"]');
  await page.waitForSelector('[data-testid="screen-menu"]');

  const memory: MemorySample[] = [{ cycle: 0, usedJsHeapMb: await measureHeap(page) }];
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    await page.click('[data-testid="menu-play"]');
    await waitForBattle(page);
    await autopilot(page, cycleSeconds, false);
    if (cycle === 1) {
      mkdirSync(output, { recursive: true });
      await page.screenshot({ path: join(output, 'profile-battle.png') });
    }
    await leaveBattle(page);
    memory.push({ cycle, usedJsHeapMb: await measureHeap(page) });
  }

  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();

  if (perf) {
    writeFileSync(join(output, 'frame-times.svg'), renderFrameTimesChart(perf.frameTimes));
  }
  writeFileSync(join(output, 'memory-cycles.svg'), renderMemoryChart(memory));
  const report = {
    generatedAt: new Date().toISOString(),
    environment: { userAgent, viewport: { width, height, deviceScaleFactor: scale }, platform: process.platform, arch: process.arch },
    match: {
      sessionSeconds: matchSeconds,
      spawnIntervalSeconds: spawnSeconds,
      finalScore: finalState?.score ?? null,
      finalStatus: finalState?.status ?? null,
      elapsedSeconds: finalState?.elapsedSeconds ?? null,
    },
    frames: perf,
    memoryCycles: memory,
  };
  writeFileSync(join(output, 'performance.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

void main();

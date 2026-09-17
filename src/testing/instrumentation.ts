import type { BattleRuntime } from '@/game/battleRuntime';
import type { PerfReport } from './testApi';

let activeRuntime: BattleRuntime | null = null;
let currentScreen = 'boot';
let perfHandle = 0;
let perfFrames: number[] = [];
let perfEntities: number[] = [];
let perfLastStamp = 0;

function samplePerf(stamp: number): void {
  if (perfLastStamp > 0) {
    perfFrames.push(stamp - perfLastStamp);
    perfEntities.push(activeRuntime?.entityCount() ?? 0);
  }
  perfLastStamp = stamp;
  perfHandle = window.requestAnimationFrame(samplePerf);
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(ratio * (sorted.length - 1)));
  return sorted[index] ?? 0;
}

function buildPerfReport(): PerfReport | null {
  if (perfFrames.length === 0) return null;
  const total = perfFrames.reduce((sum, value) => sum + value, 0);
  const entities = perfEntities.reduce((sum, value) => sum + value, 0);
  return {
    frames: perfFrames.length,
    seconds: total / 1000,
    averageFps: perfFrames.length / (total / 1000),
    p95FrameMs: percentile(perfFrames, 0.95),
    maxFrameMs: Math.max(...perfFrames),
    averageEntities: entities / perfEntities.length,
    maxEntities: Math.max(...perfEntities),
  };
}

export function registerBattleRuntime(runtime: BattleRuntime | null): void {
  activeRuntime = runtime;
}

export function reportScreen(name: string): void {
  currentScreen = name;
}

export function installTestApi(): void {
  if (typeof window === 'undefined' || window.__pirateBattle) return;
  window.__pirateBattle = {
    version: 1,
    startPerf: () => {
      window.cancelAnimationFrame(perfHandle);
      perfFrames = [];
      perfEntities = [];
      perfLastStamp = 0;
      perfHandle = window.requestAnimationFrame(samplePerf);
    },
    stopPerf: () => {
      window.cancelAnimationFrame(perfHandle);
      perfHandle = 0;
      return buildPerfReport();
    },
    hasBattle: () => activeRuntime !== null,
    getState: () => activeRuntime?.debugState() ?? null,
    advance: (milliseconds) => activeRuntime?.advance(milliseconds),
    setClock: (mode) => activeRuntime?.setClockMode(mode),
    press: (action) => activeRuntime?.controls.press(action),
    release: (action) => activeRuntime?.controls.release(action),
    releaseAll: () => activeRuntime?.controls.clear(),
    restorePlayerHealth: () => activeRuntime?.restorePlayerHealth(),
    getScreen: () => currentScreen,
  };
}

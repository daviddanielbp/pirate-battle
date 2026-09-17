import type { ClockMode, DebugState } from '@/game/battleRuntime';
import type { ControlAction } from '@/game/input/controls';

export interface PerfReport {
  frames: number;
  seconds: number;
  averageFps: number;
  p95FrameMs: number;
  maxFrameMs: number;
  averageEntities: number;
  maxEntities: number;
  frameTimes: number[];
}

export interface BattleTestApi {
  version: number;
  startPerf(): void;
  stopPerf(): PerfReport | null;
  hasBattle(): boolean;
  getState(): DebugState | null;
  advance(milliseconds: number): void;
  setClock(mode: ClockMode): void;
  press(action: ControlAction): void;
  release(action: ControlAction): void;
  releaseAll(): void;
  restorePlayerHealth(): void;
  getScreen(): string;
}

declare global {
  interface Window {
    __pirateBattle?: BattleTestApi;
  }
}

import type { ClockMode } from '@/game/battleRuntime';
import { seedFromString } from '@/game/core/rng';

export interface RuntimeFlags {
  instrumentation: boolean;
  clock: ClockMode;
  seed: number;
  touch: boolean;
}

function readParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function readRuntimeFlags(): RuntimeFlags {
  const params = readParams();
  const seedParam = params.get('seed');
  const seed = seedParam === null ? Math.floor(Math.random() * 0xffffffff) : seedFromString(seedParam);
  return {
    instrumentation: params.get('test') === '1',
    clock: params.get('clock') === 'manual' ? 'manual' : 'auto',
    seed,
    touch: params.get('touch') === '1',
  };
}

export function nextMatchSeed(base: number, matchIndex: number): number {
  return (base + matchIndex * 0x9e3779b1) >>> 0;
}

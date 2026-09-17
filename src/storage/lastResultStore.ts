import { useSyncExternalStore } from 'react';
import type { MatchRecord } from '@/data/contracts';
import { isMatchRecord } from '@/data/validation';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from './localStore';

let current: MatchRecord | null = readJson(STORAGE_KEYS.lastResult, isMatchRecord);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function getLastResult(): MatchRecord | null {
  return current;
}

export function saveLastResult(record: MatchRecord): void {
  current = record;
  writeJson(STORAGE_KEYS.lastResult, record);
  notify();
}

export function clearLastResult(): void {
  current = null;
  removeKey(STORAGE_KEYS.lastResult);
  notify();
}

export function useLastResult(): MatchRecord | null {
  return useSyncExternalStore(subscribe, getLastResult, getLastResult);
}

export function rememberResultScreen(open: boolean): void {
  if (open) writeJson(STORAGE_KEYS.screen, 'result');
  else removeKey(STORAGE_KEYS.screen);
}

export function wasResultScreenOpen(): boolean {
  return readJson(STORAGE_KEYS.screen, (value): value is string => value === 'result') === 'result';
}

import { useSyncExternalStore } from 'react';
import type { MatchRewards } from '@/game/progression/progression';
import { isRecord, readJson, STORAGE_KEYS, writeJson } from './localStore';

export interface StoredRewards extends MatchRewards {
  matchId: string;
}

function isStoredRewards(value: unknown): value is StoredRewards {
  return (
    isRecord(value) &&
    typeof value.matchId === 'string' &&
    typeof value.coins === 'number' &&
    typeof value.xp === 'number' &&
    typeof value.levelBefore === 'number' &&
    typeof value.levelAfter === 'number'
  );
}

let current: StoredRewards | null = readJson(STORAGE_KEYS.lastRewards, isStoredRewards);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastRewards(): StoredRewards | null {
  return current;
}

export function saveLastRewards(rewards: StoredRewards): void {
  current = rewards;
  writeJson(STORAGE_KEYS.lastRewards, rewards);
  for (const listener of listeners) listener();
}

export function useLastRewards(): StoredRewards | null {
  return useSyncExternalStore(subscribe, getLastRewards, getLastRewards);
}

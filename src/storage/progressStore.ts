import { useSyncExternalStore } from 'react';
import {
  DEFAULT_PROGRESS,
  HULL_CATALOG,
  CANNON_CATALOG,
  MAX_UPGRADE_LEVEL,
  type HullId,
  type CannonId,
  type PlayerProgress,
} from '@/game/progression/progression';
import { isRecord, readJson, STORAGE_KEYS, writeJson } from './localStore';

function isHullId(value: unknown): value is HullId {
  return typeof value === 'string' && HULL_CATALOG.some((hull) => hull.id === value);
}

function isCannonId(value: unknown): value is CannonId {
  return typeof value === 'string' && CANNON_CATALOG.some((cannon) => cannon.id === value);
}

function isUpgradeLevel(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= MAX_UPGRADE_LEVEL;
}

function isProgress(value: unknown): value is PlayerProgress {
  if (!isRecord(value)) return false;
  const upgrades = value.upgrades;
  return (
    Number.isInteger(value.coins) &&
    typeof value.coins === 'number' &&
    value.coins >= 0 &&
    Number.isInteger(value.xp) &&
    typeof value.xp === 'number' &&
    value.xp >= 0 &&
    isHullId(value.hull) &&
    isCannonId(value.cannon) &&
    isRecord(upgrades) &&
    isUpgradeLevel(upgrades.health) &&
    isUpgradeLevel(upgrades.damage) &&
    isUpgradeLevel(upgrades.speed) &&
    Array.isArray(value.ownedHulls) &&
    value.ownedHulls.every(isHullId) &&
    value.ownedHulls.includes(value.hull) &&
    Array.isArray(value.ownedCannons) &&
    value.ownedCannons.every(isCannonId) &&
    value.ownedCannons.includes(value.cannon)
  );
}

let current: PlayerProgress = readJson(STORAGE_KEYS.progress, isProgress) ?? DEFAULT_PROGRESS;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlayerProgress(): PlayerProgress {
  return current;
}

export function savePlayerProgress(progress: PlayerProgress): void {
  current = progress;
  writeJson(STORAGE_KEYS.progress, progress);
  for (const listener of listeners) listener();
}

export function usePlayerProgress(): PlayerProgress {
  return useSyncExternalStore(subscribe, getPlayerProgress, getPlayerProgress);
}

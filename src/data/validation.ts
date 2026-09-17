import type { EndReason } from '@/game/core/entities';
import { isRecord } from '@/storage/localStore';
import type { MatchConfigSnapshot, MatchRecord, Page, RankingEntry, SubmitMatchResult } from './contracts';
import { CANNON_CATALOG, HULL_CATALOG, MAX_UPGRADE_LEVEL, type MatchLoadout } from '@/game/progression/progression';

const END_REASONS: readonly EndReason[] = ['time_up', 'defeated'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

export function isEndReason(value: unknown): value is EndReason {
  return typeof value === 'string' && END_REASONS.some((reason) => reason === value);
}

export function isMatchConfigSnapshot(value: unknown): value is MatchConfigSnapshot {
  return (
    isRecord(value) && isPositiveNumber(value.sessionSeconds) && isPositiveNumber(value.spawnIntervalSeconds)
  );
}

function isUpgradeLevel(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= MAX_UPGRADE_LEVEL;
}

export function isMatchLoadout(value: unknown): value is MatchLoadout {
  return (
    isRecord(value) &&
    Number.isInteger(value.level) &&
    isPositiveNumber(value.level) &&
    HULL_CATALOG.some((hull) => hull.id === value.hull) &&
    CANNON_CATALOG.some((cannon) => cannon.id === value.cannon) &&
    isRecord(value.upgrades) &&
    isUpgradeLevel(value.upgrades.health) &&
    isUpgradeLevel(value.upgrades.damage) &&
    isUpgradeLevel(value.upgrades.speed)
  );
}

export function isMatchRecord(value: unknown): value is MatchRecord {
  return (
    isRecord(value) &&
    (value.loadout === undefined || isMatchLoadout(value.loadout)) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.playerId) &&
    isNonEmptyString(value.playerName) &&
    isIsoDate(value.playedAt) &&
    Number.isInteger(value.score) &&
    isNonNegativeNumber(value.score) &&
    isNonNegativeNumber(value.durationSeconds) &&
    isEndReason(value.endReason) &&
    isMatchConfigSnapshot(value.config)
  );
}

export function isRankingEntry(value: unknown): value is RankingEntry {
  return (
    isRecord(value) &&
    Number.isInteger(value.rank) &&
    isPositiveNumber(value.rank) &&
    isNonEmptyString(value.matchId) &&
    isNonEmptyString(value.playerId) &&
    isNonEmptyString(value.playerName) &&
    Number.isInteger(value.score) &&
    isNonNegativeNumber(value.score) &&
    isNonNegativeNumber(value.durationSeconds) &&
    isIsoDate(value.playedAt) &&
    isMatchConfigSnapshot(value.config)
  );
}

export function isPageOf<T>(isItem: (value: unknown) => value is T): (value: unknown) => value is Page<T> {
  return (value: unknown): value is Page<T> =>
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
    Number.isInteger(value.page) &&
    Number.isInteger(value.pageSize) &&
    Number.isInteger(value.totalItems) &&
    Number.isInteger(value.totalPages);
}

export function isSubmitMatchResult(value: unknown): value is SubmitMatchResult {
  return isRecord(value) && isMatchRecord(value.record) && typeof value.created === 'boolean';
}

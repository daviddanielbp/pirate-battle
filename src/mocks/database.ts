import { compareRankingRecords, configKey } from '@/data/contracts';
import type {
  MatchConfigSnapshot,
  MatchRecord,
  Page,
  RankingEntry,
  SubmitMatchResult,
} from '@/data/contracts';
import { isMatchRecord } from '@/data/validation';
import { loadPlayerIdentity } from '@/storage/playerIdentity';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/storage/localStore';
import { EMPTY_FIXTURES, FIXTURE_RECORDS, paginationFixtures } from './fixtures';

export type Dataset = 'standard' | 'empty' | 'paginated';

let submittedRecords: MatchRecord[] | null = null;

function isRecordList(value: unknown): value is MatchRecord[] {
  return Array.isArray(value) && value.every(isMatchRecord);
}

function submitted(): MatchRecord[] {
  submittedRecords ??= readJson(STORAGE_KEYS.mockDatabase, isRecordList) ?? [];
  return submittedRecords;
}

function fixturesFor(dataset: Dataset): readonly MatchRecord[] {
  switch (dataset) {
    case 'empty':
      return EMPTY_FIXTURES;
    case 'paginated': {
      const player = loadPlayerIdentity();
      return [...FIXTURE_RECORDS, ...paginationFixtures(player.id, player.name)];
    }
    case 'standard':
      return FIXTURE_RECORDS;
  }
}

export function listRecords(dataset: Dataset): MatchRecord[] {
  return [...fixturesFor(dataset), ...submitted()];
}

export function getRecord(id: string): MatchRecord | undefined {
  return submitted().find((record) => record.id === id) ?? FIXTURE_RECORDS.find((record) => record.id === id);
}

export function insertRecord(record: MatchRecord): SubmitMatchResult {
  const existing = getRecord(record.id);
  if (existing) return { record: existing, created: false };
  const next = [...submitted(), record];
  submittedRecords = next;
  writeJson(STORAGE_KEYS.mockDatabase, next);
  return { record, created: true };
}

export function resetDatabase(): void {
  submittedRecords = [];
  removeKey(STORAGE_KEYS.mockDatabase);
}

function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

function bestRecordPerPlayer(records: readonly MatchRecord[]): MatchRecord[] {
  const best = new Map<string, MatchRecord>();
  for (const candidate of records) {
    const current = best.get(candidate.playerId);
    if (!current || compareRankingRecords(candidate, current) < 0) best.set(candidate.playerId, candidate);
  }
  return [...best.values()].sort(compareRankingRecords);
}

function toRankingEntry(record: MatchRecord, index: number): RankingEntry {
  return {
    rank: index + 1,
    matchId: record.id,
    playerId: record.playerId,
    playerName: record.playerName,
    score: record.score,
    durationSeconds: record.durationSeconds,
    playedAt: record.playedAt,
    config: record.config,
  };
}

export function rankingPage(
  dataset: Dataset,
  config: MatchConfigSnapshot,
  page: number,
  pageSize: number,
): Page<RankingEntry> {
  const key = configKey(config);
  const matching = listRecords(dataset).filter((record) => configKey(record.config) === key);
  return paginate(bestRecordPerPlayer(matching).map(toRankingEntry), page, pageSize);
}

function compareByPlayedAtDesc(a: MatchRecord, b: MatchRecord): number {
  if (a.playedAt !== b.playedAt) return a.playedAt < b.playedAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function historyPage(
  dataset: Dataset,
  playerId: string,
  page: number,
  pageSize: number,
): Page<MatchRecord> {
  const own = listRecords(dataset)
    .filter((record) => record.playerId === playerId)
    .sort(compareByPlayedAtDesc);
  return paginate(own, page, pageSize);
}

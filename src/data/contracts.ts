import type { EndReason } from '@/game/core/entities';
import type { MatchLoadout } from '@/game/progression/progression';

export interface MatchConfigSnapshot {
  sessionSeconds: number;
  spawnIntervalSeconds: number;
}

export interface MatchRecord {
  id: string;
  playerId: string;
  playerName: string;
  playedAt: string;
  score: number;
  durationSeconds: number;
  endReason: EndReason;
  config: MatchConfigSnapshot;
  loadout?: MatchLoadout;
}

export type MatchSubmission = MatchRecord;

export interface RankingEntry {
  rank: number;
  matchId: string;
  playerId: string;
  playerName: string;
  score: number;
  durationSeconds: number;
  playedAt: string;
  config: MatchConfigSnapshot;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface RankingQuery {
  page: number;
  pageSize: number;
  config: MatchConfigSnapshot;
}

export interface HistoryQuery {
  page: number;
  pageSize: number;
  playerId: string;
}

export interface SubmitMatchResult {
  record: MatchRecord;
  created: boolean;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export const API_ROUTES = {
  ranking: '/api/ranking',
  matches: '/api/matches',
  match: (id: string) => `/api/matches/${id}`,
} as const;

export const DEFAULT_PAGE_SIZE = 5;

export function configKey(config: MatchConfigSnapshot): string {
  return `${config.sessionSeconds}:${config.spawnIntervalSeconds}`;
}

export function compareRankingRecords(a: MatchRecord, b: MatchRecord): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.durationSeconds !== b.durationSeconds) return a.durationSeconds - b.durationSeconds;
  if (a.playedAt !== b.playedAt) return a.playedAt < b.playedAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

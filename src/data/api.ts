import { API_ROUTES } from './contracts';
import type {
  HistoryQuery,
  MatchRecord,
  Page,
  RankingEntry,
  RankingQuery,
  SubmitMatchResult,
} from './contracts';
import { request } from './httpClient';
import { isMatchRecord, isPageOf, isRankingEntry, isSubmitMatchResult } from './validation';

export function fetchRanking(query: RankingQuery, signal?: AbortSignal): Promise<Page<RankingEntry>> {
  return request<Page<RankingEntry>>({
    method: 'GET',
    url: API_ROUTES.ranking,
    validate: isPageOf(isRankingEntry),
    params: {
      page: query.page,
      pageSize: query.pageSize,
      sessionSeconds: query.config.sessionSeconds,
      spawnIntervalSeconds: query.config.spawnIntervalSeconds,
    },
    signal,
  });
}

export function fetchHistory(query: HistoryQuery, signal?: AbortSignal): Promise<Page<MatchRecord>> {
  return request<Page<MatchRecord>>({
    method: 'GET',
    url: API_ROUTES.matches,
    validate: isPageOf(isMatchRecord),
    params: { playerId: query.playerId, page: query.page, pageSize: query.pageSize },
    signal,
  });
}

export function submitMatch(record: MatchRecord, signal?: AbortSignal): Promise<SubmitMatchResult> {
  return request<SubmitMatchResult>({
    method: 'POST',
    url: API_ROUTES.matches,
    data: record,
    signal,
    validate: isSubmitMatchResult,
  });
}

export function fetchMatch(id: string, signal?: AbortSignal): Promise<MatchRecord> {
  return request<MatchRecord>({ method: 'GET', url: API_ROUTES.match(id), signal, validate: isMatchRecord });
}

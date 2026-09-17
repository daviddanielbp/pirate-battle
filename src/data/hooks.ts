import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fetchHistory, fetchRanking } from './api';
import { DEFAULT_PAGE_SIZE } from './contracts';
import type { MatchConfigSnapshot, MatchRecord, Page, RankingEntry } from './contracts';
import { toApiError } from './httpClient';
import type { ApiError } from './httpClient';
import { historyKey, invalidateLogQueries, rankingKey } from './queryKeys';

export interface LogQueryResult<T> {
  data: Page<T> | undefined;
  isPending: boolean;
  isError: boolean;
  error: ApiError | null;
  isFetching: boolean;
  isPlaceholderData: boolean;
  refetch: () => void;
}

function toLogQueryResult<T>(query: UseQueryResult<Page<T>>): LogQueryResult<T> {
  return {
    data: query.data,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error === null ? null : toApiError(query.error),
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    refetch: () => void query.refetch(),
  };
}

export function useRankingQuery(config: MatchConfigSnapshot, page: number): LogQueryResult<RankingEntry> {
  return toLogQueryResult(
    useQuery({
      queryKey: rankingKey(config, page),
      queryFn: ({ signal }) => fetchRanking({ page, pageSize: DEFAULT_PAGE_SIZE, config }, signal),
      placeholderData: keepPreviousData,
      refetchOnMount: 'always',
    }),
  );
}

export function useHistoryQuery(playerId: string, page: number): LogQueryResult<MatchRecord> {
  return toLogQueryResult(
    useQuery({
      queryKey: historyKey(playerId, page),
      queryFn: ({ signal }) => fetchHistory({ page, pageSize: DEFAULT_PAGE_SIZE, playerId }, signal),
      placeholderData: keepPreviousData,
      refetchOnMount: 'always',
    }),
  );
}

export function useInvalidateLog(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(() => invalidateLogQueries(client), [client]);
}

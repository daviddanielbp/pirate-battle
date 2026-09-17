import type { QueryClient } from '@tanstack/react-query';
import { configKey } from './contracts';
import type { MatchConfigSnapshot } from './contracts';

export const rankingRoot = ['ranking'] as const;
export const historyRoot = ['history'] as const;

export function rankingKey(config: MatchConfigSnapshot, page: number) {
  return [...rankingRoot, configKey(config), page] as const;
}

export function historyKey(playerId: string, page: number) {
  return [...historyRoot, playerId, page] as const;
}

const LOG_ROOTS: readonly (readonly string[])[] = [rankingRoot, historyRoot];

export async function invalidateLogQueries(client: QueryClient): Promise<void> {
  await Promise.all(LOG_ROOTS.map((queryKey) => client.cancelQueries({ queryKey })));
  await Promise.all(LOG_ROOTS.map((queryKey) => client.invalidateQueries({ queryKey })));
}

import { MutationObserver } from '@tanstack/react-query';
import { submitMatch } from './api';
import type { MatchRecord, SubmitMatchResult } from './contracts';
import { ApiError, toApiError } from './httpClient';
import {
  getPending,
  markConfirmed,
  markFailed,
  markSubmitting,
  useConfirmedIds,
  usePendingSubmissions,
} from './pendingSubmissions';
import type { PendingStatus, PendingSubmission } from './pendingSubmissions';
import { queryClient } from './queryClient';
import { invalidateLogQueries } from './queryKeys';

export type SubmissionOutcome =
  { status: 'confirmed'; record: MatchRecord; created: boolean } | { status: 'failed'; error: ApiError };

export type SubmissionStatus = 'idle' | PendingStatus | 'confirmed';

export interface SubmissionStatusView {
  status: SubmissionStatus;
  errorMessage: string | null;
}

const inFlight = new Map<string, Promise<SubmissionOutcome>>();

export const SUBMIT_MUTATION_KEY = ['submitMatch'] as const;

function performSubmission(entry: PendingSubmission): Promise<SubmissionOutcome> {
  const id = entry.record.id;
  const observer = new MutationObserver<SubmitMatchResult, unknown, MatchRecord>(queryClient, {
    mutationKey: [...SUBMIT_MUTATION_KEY, id],
    scope: { id: `submitMatch:${id}` },
    mutationFn: (record) => submitMatch(record),
    onMutate: () => {
      markSubmitting(id);
    },
    onSuccess: () => {
      markConfirmed(id);
      return invalidateLogQueries(queryClient);
    },
    onError: (error) => {
      markFailed(id, toApiError(error).message);
    },
  });
  return observer.mutate(entry.record).then(
    (result): SubmissionOutcome => ({ status: 'confirmed', record: result.record, created: result.created }),
    (error: unknown): SubmissionOutcome => ({ status: 'failed', error: toApiError(error) }),
  );
}

export function submitPending(id: string): Promise<SubmissionOutcome> {
  const running = inFlight.get(id);
  if (running) return running;
  const entry = getPending().find((candidate) => candidate.record.id === id);
  if (!entry) {
    return Promise.resolve({
      status: 'failed',
      error: new ApiError('unknown', 'There is no pending match with this id.'),
    });
  }
  const task = performSubmission(entry).finally(() => {
    inFlight.delete(id);
  });
  inFlight.set(id, task);
  return task;
}

export async function flushPending(): Promise<SubmissionOutcome[]> {
  const outcomes: SubmissionOutcome[] = [];
  for (const id of getPending().map((entry) => entry.record.id)) {
    outcomes.push(await submitPending(id));
  }
  return outcomes;
}

export function useSubmissionStatus(matchId: string): SubmissionStatusView {
  const pending = usePendingSubmissions();
  const confirmedIds = useConfirmedIds();
  const entry = pending.find((candidate) => candidate.record.id === matchId);
  if (entry) return { status: entry.status, errorMessage: entry.lastError };
  if (confirmedIds.includes(matchId)) return { status: 'confirmed', errorMessage: null };
  return { status: 'idle', errorMessage: null };
}

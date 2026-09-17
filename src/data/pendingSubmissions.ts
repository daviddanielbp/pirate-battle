import { useSyncExternalStore } from 'react';
import { isRecord, readJson, removeKey, STORAGE_KEYS, writeJson } from '@/storage/localStore';
import type { MatchRecord } from './contracts';
import { isMatchRecord } from './validation';

export type PendingStatus = 'pending' | 'submitting' | 'failed';

export interface PendingSubmission {
  record: MatchRecord;
  attempts: number;
  status: PendingStatus;
  lastError: string | null;
  updatedAt: string;
}

interface SubmissionState {
  pending: readonly PendingSubmission[];
  confirmedIds: readonly string[];
}

const EMPTY_STATE: SubmissionState = { pending: [], confirmedIds: [] };
const MAX_CONFIRMED_IDS = 100;

let state: SubmissionState | null = null;
const listeners = new Set<() => void>();

function isPendingStatus(value: unknown): value is PendingStatus {
  return value === 'pending' || value === 'submitting' || value === 'failed';
}

function isPendingSubmission(value: unknown): value is PendingSubmission {
  return (
    isRecord(value) &&
    isMatchRecord(value.record) &&
    typeof value.attempts === 'number' &&
    Number.isInteger(value.attempts) &&
    value.attempts >= 0 &&
    isPendingStatus(value.status) &&
    (value.lastError === null || typeof value.lastError === 'string') &&
    typeof value.updatedAt === 'string'
  );
}

function isSubmissionState(value: unknown): value is SubmissionState {
  return (
    isRecord(value) &&
    Array.isArray(value.pending) &&
    value.pending.every(isPendingSubmission) &&
    Array.isArray(value.confirmedIds) &&
    value.confirmedIds.every((id) => typeof id === 'string')
  );
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function interruptedSubmissionAsPending(entry: PendingSubmission): PendingSubmission {
  return entry.status === 'submitting' ? { ...entry, status: 'pending' } : entry;
}

function readPersistedState(): SubmissionState {
  const stored = readJson(STORAGE_KEYS.pendingSubmissions, isSubmissionState);
  return stored ? { ...stored, pending: stored.pending.map(interruptedSubmissionAsPending) } : EMPTY_STATE;
}

function current(): SubmissionState {
  state ??= readPersistedState();
  return state;
}

function commit(next: SubmissionState): void {
  state = next;
  if (next.pending.length === 0 && next.confirmedIds.length === 0) {
    removeKey(STORAGE_KEYS.pendingSubmissions);
  } else {
    writeJson(STORAGE_KEYS.pendingSubmissions, next);
  }
  notify();
}

function hasPending(id: string): boolean {
  return current().pending.some((entry) => entry.record.id === id);
}

function updateEntry(id: string, update: (entry: PendingSubmission) => PendingSubmission): void {
  if (!hasPending(id)) return;
  const { pending, confirmedIds } = current();
  commit({ confirmedIds, pending: pending.map((entry) => (entry.record.id === id ? update(entry) : entry)) });
}

export function hydrate(): void {
  state = readPersistedState();
  notify();
}

export function getPending(): readonly PendingSubmission[] {
  return current().pending;
}

export function getConfirmedIds(): readonly string[] {
  return current().confirmedIds;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function enqueue(record: MatchRecord): void {
  if (hasPending(record.id)) return;
  const entry: PendingSubmission = {
    record,
    attempts: 0,
    status: 'pending',
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
  const { pending, confirmedIds } = current();
  commit({ confirmedIds, pending: [...pending, entry] });
}

export function markSubmitting(id: string): void {
  updateEntry(id, (entry) => ({
    ...entry,
    status: 'submitting',
    attempts: entry.attempts + 1,
    updatedAt: new Date().toISOString(),
  }));
}

export function markFailed(id: string, message: string): void {
  updateEntry(id, (entry) => ({
    ...entry,
    status: 'failed',
    lastError: message,
    updatedAt: new Date().toISOString(),
  }));
}

export function markConfirmed(id: string): void {
  const { pending, confirmedIds } = current();
  commit({
    pending: pending.filter((entry) => entry.record.id !== id),
    confirmedIds: [id, ...confirmedIds.filter((confirmedId) => confirmedId !== id)].slice(
      0,
      MAX_CONFIRMED_IDS,
    ),
  });
}

export function remove(id: string): void {
  if (!hasPending(id)) return;
  const { pending, confirmedIds } = current();
  commit({ confirmedIds, pending: pending.filter((entry) => entry.record.id !== id) });
}

export function clear(): void {
  commit(EMPTY_STATE);
}

export function usePendingSubmissions(): readonly PendingSubmission[] {
  return useSyncExternalStore(subscribe, getPending, getPending);
}

export function useConfirmedIds(): readonly string[] {
  return useSyncExternalStore(subscribe, getConfirmedIds, getConfirmedIds);
}

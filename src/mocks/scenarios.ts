import type { ApiErrorBody } from '@/data/contracts';
import { createRandom } from '@/game/core/rng';
import type { RandomSource } from '@/game/core/rng';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/storage/localStore';
import type { Dataset } from './database';

export const SCENARIO_IDS = [
  'default',
  'empty',
  'paginated',
  'slow',
  'jitter',
  'out-of-order',
  'timeout',
  'network-error',
  'server-error',
  'client-error',
  'ranking-failure',
  'history-failure',
  'submit-timeout-recover',
  'submit-unavailable-recover',
] as const;

export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface NetworkScenario {
  id: ScenarioId;
  label: string;
  description: string;
}

export const NETWORK_SCENARIOS: readonly NetworkScenario[] = [
  { id: 'default', label: 'Default', description: 'Every request succeeds after a fixed 150 ms latency.' },
  {
    id: 'empty',
    label: 'Empty lists',
    description: 'Ranking and history contain no fixtures; submissions still work.',
  },
  {
    id: 'paginated',
    label: 'Many pages',
    description: 'Extra captains and matches so the ranking and your history span several pages.',
  },
  { id: 'slow', label: 'Slow network', description: 'Every response takes 2.5 s.' },
  {
    id: 'jitter',
    label: 'Variable latency',
    description: 'Latency varies between 100 ms and 2 s using a seeded generator.',
  },
  {
    id: 'out-of-order',
    label: 'Out-of-order responses',
    description: 'Latency alternates between 1.8 s and 100 ms so later requests finish first.',
  },
  { id: 'timeout', label: 'Timeout', description: 'Responses arrive after 20 s, beyond the client timeout.' },
  {
    id: 'network-error',
    label: 'Connection failure',
    description: 'Every request fails at the network level.',
  },
  { id: 'server-error', label: 'Server error', description: 'Every request answers HTTP 500.' },
  {
    id: 'client-error',
    label: 'Client error',
    description: 'Reads answer HTTP 404 and submissions answer HTTP 400.',
  },
  {
    id: 'ranking-failure',
    label: 'Ranking failure',
    description: 'Only the ranking request answers HTTP 500.',
  },
  {
    id: 'history-failure',
    label: 'History failure',
    description: 'Only the history request answers HTTP 500.',
  },
  {
    id: 'submit-timeout-recover',
    label: 'Submission timeout, then recovery',
    description:
      'The first submission of a match is stored but its response times out; retries return the stored match.',
  },
  {
    id: 'submit-unavailable-recover',
    label: 'Submission unavailable, then recovery',
    description: 'The first two submissions of a match answer HTTP 503; the third one succeeds.',
  },
];

export type Endpoint = 'ranking' | 'history' | 'submit' | 'match';

export interface RequestDescriptor {
  endpoint: Endpoint;
  matchId?: string;
}

export type RequestFailure = { kind: 'network' } | { kind: 'http'; status: number; body: ApiErrorBody };

export interface RequestPlan {
  dataset: Dataset;
  delayMs: number;
  failure: RequestFailure | null;
}

const DEFAULT_LATENCY_MS = 150;
const SLOW_LATENCY_MS = 2500;
const JITTER_MIN_MS = 100;
const JITTER_MAX_MS = 2000;
const OUT_OF_ORDER_SLOW_MS = 1800;
const OUT_OF_ORDER_FAST_MS = 100;
const OUT_OF_ORDER_SLOW_WITHOUT_LATENCY_MS = 300;
const TIMEOUT_LATENCY_MS = 20000;
const UNAVAILABLE_ATTEMPTS = 2;
const DEFAULT_SEED = 1;

function urlParams(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
}

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && SCENARIO_IDS.some((id) => id === value);
}

let activeScenarioId: ScenarioId | null = null;

export function getActiveScenarioId(): ScenarioId {
  if (activeScenarioId) return activeScenarioId;
  const fromUrl = urlParams().get('scenario');
  if (isScenarioId(fromUrl)) {
    writeJson(STORAGE_KEYS.networkScenario, fromUrl);
    activeScenarioId = fromUrl;
    return fromUrl;
  }
  activeScenarioId = readJson(STORAGE_KEYS.networkScenario, isScenarioId) ?? 'default';
  return activeScenarioId;
}

export function setActiveScenarioId(id: ScenarioId): void {
  activeScenarioId = id;
  writeJson(STORAGE_KEYS.networkScenario, id);
}

export function resetScenario(): void {
  activeScenarioId = 'default';
  removeKey(STORAGE_KEYS.networkScenario);
}

function readSeed(): number {
  const parsed = Number.parseInt(urlParams().get('seed') ?? '', 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SEED;
}

function latencyDisabled(): boolean {
  return urlParams().get('latency') === '0';
}

let jitterRandom: RandomSource = createRandom(readSeed());
let outOfOrderRequestCount = 0;
const submitAttemptsByMatchId = new Map<string, number>();

export function resetScenarioCounters(): void {
  jitterRandom = createRandom(readSeed());
  outOfOrderRequestCount = 0;
  submitAttemptsByMatchId.clear();
}

function countSubmitAttempt(matchId: string): number {
  const attempts = (submitAttemptsByMatchId.get(matchId) ?? 0) + 1;
  submitAttemptsByMatchId.set(matchId, attempts);
  return attempts;
}

function httpFailure(status: number, code: string, message: string): RequestFailure {
  return { kind: 'http', status, body: { code, message } };
}

const SERVER_ERROR = httpFailure(500, 'internal_error', 'The server hit an unexpected error.');
const NOT_FOUND = httpFailure(404, 'not_found', 'The requested resource does not exist.');
const BAD_REQUEST = httpFailure(400, 'bad_request', 'The submission was rejected.');
const UNAVAILABLE = httpFailure(503, 'unavailable', 'The service is temporarily unavailable.');

function baseLatency(): number {
  return latencyDisabled() ? 0 : DEFAULT_LATENCY_MS;
}

function outOfOrderLatency(): number {
  outOfOrderRequestCount += 1;
  const slow = outOfOrderRequestCount % 2 === 1;
  if (latencyDisabled()) return slow ? OUT_OF_ORDER_SLOW_WITHOUT_LATENCY_MS : 0;
  return slow ? OUT_OF_ORDER_SLOW_MS : OUT_OF_ORDER_FAST_MS;
}

function plan(
  delayMs: number,
  failure: RequestFailure | null = null,
  dataset: Dataset = 'standard',
): RequestPlan {
  return { dataset, delayMs, failure };
}

function planSubmitTimeoutRecover(request: RequestDescriptor): RequestPlan {
  if (request.endpoint !== 'submit' || request.matchId === undefined) return plan(baseLatency());
  return plan(countSubmitAttempt(request.matchId) === 1 ? TIMEOUT_LATENCY_MS : baseLatency());
}

function planSubmitUnavailableRecover(request: RequestDescriptor): RequestPlan {
  if (request.endpoint !== 'submit' || request.matchId === undefined) return plan(baseLatency());
  const attempts = countSubmitAttempt(request.matchId);
  return plan(baseLatency(), attempts <= UNAVAILABLE_ATTEMPTS ? UNAVAILABLE : null);
}

export function planRequest(request: RequestDescriptor): RequestPlan {
  switch (getActiveScenarioId()) {
    case 'default':
      return plan(baseLatency());
    case 'empty':
      return plan(baseLatency(), null, 'empty');
    case 'paginated':
      return plan(baseLatency(), null, 'paginated');
    case 'slow':
      return plan(latencyDisabled() ? 0 : SLOW_LATENCY_MS);
    case 'jitter':
      return plan(latencyDisabled() ? 0 : Math.round(jitterRandom.range(JITTER_MIN_MS, JITTER_MAX_MS)));
    case 'out-of-order':
      return plan(outOfOrderLatency());
    case 'timeout':
      return plan(TIMEOUT_LATENCY_MS);
    case 'network-error':
      return plan(baseLatency(), { kind: 'network' });
    case 'server-error':
      return plan(baseLatency(), SERVER_ERROR);
    case 'client-error':
      return plan(baseLatency(), request.endpoint === 'submit' ? BAD_REQUEST : NOT_FOUND);
    case 'ranking-failure':
      return plan(baseLatency(), request.endpoint === 'ranking' ? SERVER_ERROR : null);
    case 'history-failure':
      return plan(baseLatency(), request.endpoint === 'history' ? SERVER_ERROR : null);
    case 'submit-timeout-recover':
      return planSubmitTimeoutRecover(request);
    case 'submit-unavailable-recover':
      return planSubmitUnavailableRecover(request);
  }
}

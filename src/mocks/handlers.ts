import { delay, http, HttpResponse } from 'msw';
import { API_ROUTES } from '@/data/contracts';
import type { ApiErrorBody, MatchConfigSnapshot } from '@/data/contracts';
import { isMatchRecord } from '@/data/validation';
import { getRecord, historyPage, insertRecord, rankingPage, resetDatabase } from './database';
import type { Dataset } from './database';
import { planRequest, resetScenarioCounters } from './scenarios';
import type { RequestDescriptor, RequestFailure } from './scenarios';

const MAX_PAGE_SIZE = 50;

interface Pagination {
  page: number;
  pageSize: number;
}

class BadRequest extends Error {}

function errorResponse(status: number, body: ApiErrorBody): HttpResponse<ApiErrorBody> {
  return HttpResponse.json<ApiErrorBody>(body, { status });
}

function failureResponse(failure: RequestFailure): Response {
  return failure.kind === 'network' ? HttpResponse.error() : errorResponse(failure.status, failure.body);
}

async function serve(
  descriptor: RequestDescriptor,
  produce: (dataset: Dataset) => Response,
): Promise<Response> {
  const plan = planRequest(descriptor);
  const response = plan.failure ? failureResponse(plan.failure) : produce(plan.dataset);
  if (plan.delayMs > 0) await delay(plan.delayMs);
  return response;
}

async function guarded(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof BadRequest) {
      return errorResponse(400, { code: 'bad_request', message: error.message });
    }
    throw error;
  }
}

function numericParam(params: URLSearchParams, name: string): number {
  const raw = params.get(name);
  return raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
}

function readInteger(params: URLSearchParams, name: string, min: number, max: number): number {
  const value = numericParam(params, name);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequest(`Query parameter "${name}" must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function readNumber(params: URLSearchParams, name: string): number {
  const value = numericParam(params, name);
  if (!Number.isFinite(value)) throw new BadRequest(`Query parameter "${name}" must be a number.`);
  return value;
}

function readPagination(params: URLSearchParams): Pagination {
  return {
    page: readInteger(params, 'page', 1, Number.MAX_SAFE_INTEGER),
    pageSize: readInteger(params, 'pageSize', 1, MAX_PAGE_SIZE),
  };
}

function readConfig(params: URLSearchParams): MatchConfigSnapshot {
  return {
    sessionSeconds: readNumber(params, 'sessionSeconds'),
    spawnIntervalSeconds: readNumber(params, 'spawnIntervalSeconds'),
  };
}

function readPlayerId(params: URLSearchParams): string {
  const playerId = params.get('playerId');
  if (playerId === null || playerId.length === 0) {
    throw new BadRequest('Query parameter "playerId" is required.');
  }
  return playerId;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequest('The request body must be valid JSON.');
  }
}

export const handlers = [
  http.get(API_ROUTES.ranking, ({ request }) =>
    guarded(() => {
      const params = new URL(request.url).searchParams;
      const { page, pageSize } = readPagination(params);
      const config = readConfig(params);
      return serve({ endpoint: 'ranking' }, (dataset) =>
        HttpResponse.json(rankingPage(dataset, config, page, pageSize)),
      );
    }),
  ),
  http.get(API_ROUTES.matches, ({ request }) =>
    guarded(() => {
      const params = new URL(request.url).searchParams;
      const { page, pageSize } = readPagination(params);
      const playerId = readPlayerId(params);
      return serve({ endpoint: 'history' }, (dataset) =>
        HttpResponse.json(historyPage(dataset, playerId, page, pageSize)),
      );
    }),
  ),
  http.post(API_ROUTES.matches, ({ request }) =>
    guarded(async () => {
      const submission = await readJsonBody(request);
      if (!isMatchRecord(submission)) throw new BadRequest('The request body is not a valid match record.');
      return serve({ endpoint: 'submit', matchId: submission.id }, () => {
        const result = insertRecord(submission);
        return HttpResponse.json(result, { status: result.created ? 201 : 200 });
      });
    }),
  ),
  http.get(API_ROUTES.match(':id'), ({ params }) =>
    guarded(() => {
      const id = params.id;
      if (typeof id !== 'string') throw new BadRequest('A single match id is required.');
      return serve({ endpoint: 'match' }, () => {
        const record = getRecord(id);
        return record
          ? HttpResponse.json(record)
          : errorResponse(404, { code: 'not_found', message: 'No match was found with this id.' });
      });
    }),
  ),
];

export function resetMockState(): void {
  resetDatabase();
  resetScenarioCounters();
}

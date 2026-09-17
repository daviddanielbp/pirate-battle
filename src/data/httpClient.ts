import axios, { isAxiosError, isCancel } from 'axios';
import type { AxiosRequestConfig, Method } from 'axios';
import { isRecord } from '@/storage/localStore';

export type ApiErrorKind = 'timeout' | 'network' | 'http' | 'unknown';

const REQUEST_TIMEOUT_MS = 6000;

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    if (status !== undefined) this.status = status;
    this.retryable =
      kind === 'timeout' || kind === 'network' || (kind === 'http' && status !== undefined && status >= 500);
  }
}

function resolveBaseUrl(): string {
  const configured: unknown = import.meta.env.VITE_API_BASE_URL;
  return typeof configured === 'string' ? configured : '';
}

export const httpClient = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

function messageFromBody(body: unknown): string | null {
  return isRecord(body) && typeof body.message === 'string' && body.message.length > 0 ? body.message : null;
}

function describeHttpStatus(status: number): string {
  return status >= 500
    ? `The server failed to process the request (${status}).`
    : `The request was rejected (${status}).`;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isCancel(error)) return new ApiError('unknown', 'The request was cancelled.');
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('timeout', 'The server took too long to respond.');
    }
    if (error.response) {
      const status = error.response.status;
      const body: unknown = error.response.data;
      return new ApiError('http', messageFromBody(body) ?? describeHttpStatus(status), status);
    }
    return new ApiError('network', 'Unable to reach the server.');
  }
  if (error instanceof Error) return new ApiError('unknown', error.message);
  return new ApiError('unknown', 'Something went wrong.');
}

export interface RequestOptions<T> {
  method: Method;
  url: string;
  params?: Record<string, string | number>;
  data?: unknown;
  signal: AbortSignal | undefined;
  validate: (value: unknown) => value is T;
}

export async function request<T>(options: RequestOptions<T>): Promise<T> {
  const config: AxiosRequestConfig = { method: options.method, url: options.url };
  if (options.params) config.params = options.params;
  if (options.data !== undefined) config.data = options.data;
  if (options.signal) config.signal = options.signal;
  let payload: unknown;
  try {
    const response = await httpClient.request<unknown>(config);
    payload = response.data;
  } catch (error) {
    throw toApiError(error);
  }
  if (!options.validate(payload)) throw new ApiError('unknown', 'The service returned an unexpected response.');
  return payload;
}

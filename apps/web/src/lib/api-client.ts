import { authStore } from '../state/auth.store';

// Every call goes through Vite's `/api` proxy in development and through nginx in production, so
// the browser stays on one origin and the HttpOnly, SameSite=Strict refresh cookie is sent.
const BASE = '/api';
const CORRELATION_HEADER = 'x-correlation-id';

// design §7.4's shape. `code` is the field to branch on: `title` and `detail` are for people.
export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
    readonly correlationId: string | null,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

// A body that is not problem+json means something between the browser and the handler answered —
// a proxy, a crash, an HTML error page. Reporting it as the transport failure it is beats
// reporting `undefined` as a code.
async function problemOf(response: Response): Promise<ApiError> {
  const correlationId = response.headers.get(CORRELATION_HEADER);
  try {
    const problem = (await response.json()) as Problem;
    if (typeof problem.code !== 'string') throw new Error('not a problem document');
    return new ApiError(response.status, problem.code, problem.detail, correlationId);
  } catch {
    return new ApiError(
      response.status,
      'TRANSPORT_ERROR',
      `The server answered ${response.status} without a problem document`,
      correlationId,
    );
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

function headersFor(options: RequestOptions, token: string | null): HeadersInit {
  return {
    ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
  };
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: headersFor(options, authStore.getState().accessToken),
    credentials: 'include',
    signal: options.signal,
    ...(options.formData === undefined
      ? options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }
      : { body: options.formData }),
  });
}

// One refresh in flight for the whole application. Four queries meeting the same expired token
// would otherwise rotate the family four times, and rotation is single-use: the second exchange
// looks like a replay and revokes the family. React's StrictMode runs every effect twice in
// development, so the cold-start path goes through here too — two refreshes would sign the
// developer out on every reload, and only in development, which is the worst place to find it.
let refreshing: Promise<boolean> | null = null;

export function refreshOnce(): Promise<boolean> {
  refreshing ??= exchangeRefreshToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function exchangeRefreshToken(): Promise<boolean> {
  const response = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!response.ok) {
    authStore.getState().clear();
    return false;
  }
  const body = (await response.json()) as { accessToken: string };
  authStore.getState().setToken(body.accessToken);
  return true;
}

// The refresh is attempted once per call, never in a loop: if the second attempt also answers 401
// the credential is gone, and retrying is how a client turns an expired session into a spin.
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);
  if (response.status === 401 && path !== '/auth/refresh' && (await refreshOnce())) {
    response = await send(path, options);
  }
  if (!response.ok) throw await problemOf(response);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', formData }),
};

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema';
import { backoffDelay, EMBEDDING_DIMENSIONS, InfinityClient } from './infinity.client';

function env(overrides: Partial<Env> = {}): Env {
  return {
    EMBEDDING_BASE_URL: 'http://infinity:7997',
    EMBEDDING_MODEL: 'BAAI/bge-m3',
    EMBEDDING_BATCH_SIZE: 8,
    EMBEDDING_TIMEOUT_MS: 60000,
    EMBEDDING_MAX_ATTEMPTS: 3,
    // Real waits, kept short: the client does back off, and the growth is proved by backoffDelay.
    EMBEDDING_BACKOFF_MS: 1,
    ...overrides,
  } as Env;
}

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => seed);
}

function ok(data: { index: number; embedding: number[] }[]): Response {
  return { ok: true, status: 200, json: () => Promise.resolve({ data }) } as unknown as Response;
}

function failing(status: number): Response {
  return { ok: false, status, json: () => Promise.resolve({}) } as unknown as Response;
}

function stubFetch(...responses: (Response | Error)[]) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchStub = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  vi.stubGlobal('fetch', fetchStub);
  return { calls, fetchStub };
}

afterEach(() => vi.unstubAllGlobals());

describe('backoffDelay', () => {
  it('doubles with each attempt', () => {
    expect([1, 2, 3, 4].map((n) => backoffDelay(n, 2000))).toEqual([2000, 4000, 8000, 16000]);
  });

  it('spans longer than a model reload across the default five attempts', () => {
    const total = [1, 2, 3, 4].reduce((sum, n) => sum + backoffDelay(n, 2000), 0);
    expect(total).toBe(30000);
  });
});

describe('InfinityClient', () => {
  it('asks for nothing when there is nothing to embed', async () => {
    const { fetchStub } = stubFetch(ok([]));
    expect(await new InfinityClient(env()).embed([])).toEqual([]);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('splits the input into batches of the configured size', async () => {
    const { calls } = stubFetch(
      ok([0, 1].map((i) => ({ index: i, embedding: vector(i) }))),
      ok([{ index: 0, embedding: vector(2) }]),
    );
    const vectors = await new InfinityClient(env({ EMBEDDING_BATCH_SIZE: 2 })).embed([
      'a',
      'b',
      'c',
    ]);
    expect(calls.map((c) => (c.body as { input: string[] }).input)).toEqual([['a', 'b'], ['c']]);
    expect(vectors).toHaveLength(3);
  });

  it('orders vectors by the index the server returned, not by arrival', async () => {
    stubFetch(
      ok([
        { index: 1, embedding: vector(9) },
        { index: 0, embedding: vector(4) },
      ]),
    );
    const [first, second] = await new InfinityClient(env()).embed(['a', 'b']);
    expect(first![0]).toBe(4);
    expect(second![0]).toBe(9);
  });

  it('posts the configured model to the embeddings endpoint', async () => {
    const { calls } = stubFetch(ok([{ index: 0, embedding: vector(1) }]));
    await new InfinityClient(env()).embed(['a']);
    expect(calls[0]!.url).toBe('http://infinity:7997/embeddings');
    expect(calls[0]!.body).toMatchObject({ model: 'BAAI/bge-m3', input: ['a'] });
  });

  it('retries a 503 and succeeds when the service comes back', async () => {
    const { fetchStub } = stubFetch(failing(503), ok([{ index: 0, embedding: vector(1) }]));
    const vectors = await new InfinityClient(env()).embed(['a']);
    expect(vectors).toHaveLength(1);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('retries a refused connection, which is what a restarting container looks like', async () => {
    const { fetchStub } = stubFetch(
      new TypeError('fetch failed'),
      ok([{ index: 0, embedding: vector(1) }]),
    );
    await new InfinityClient(env()).embed(['a']);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured attempts and names the last cause', async () => {
    const { fetchStub } = stubFetch(failing(503));
    await expect(new InfinityClient(env()).embed(['a'])).rejects.toThrow(
      /after 3 attempts.*returned 503/,
    );
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 400, because waiting will not fix our own request', async () => {
    const { fetchStub } = stubFetch(failing(400));
    await expect(new InfinityClient(env()).embed(['a'])).rejects.toThrow(/returned 400/);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 rather than treating it as our mistake', async () => {
    const { fetchStub } = stubFetch(failing(429), ok([{ index: 0, embedding: vector(1) }]));
    await new InfinityClient(env()).embed(['a']);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it('names a rejection that is not an Error rather than reporting undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject('socket hang up')),
    );
    await expect(new InfinityClient(env()).embed(['a'])).rejects.toThrow(
      /after 3 attempts: socket hang up/,
    );
  });

  it('refuses a short vector rather than storing one the column cannot hold', async () => {
    stubFetch(ok([{ index: 0, embedding: [1, 2, 3] }]));
    await expect(new InfinityClient(env()).embed(['a'])).rejects.toThrow(
      /has 3 dimensions, expected 1024/,
    );
  });

  it('refuses a response that answers a different number of texts', async () => {
    stubFetch(ok([{ index: 0, embedding: vector(1) }]));
    await expect(new InfinityClient(env()).embed(['a', 'b'])).rejects.toThrow(
      /Asked for 2 embeddings and received 1/,
    );
  });

  it('carries a timeout signal on every request', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        seen.push(init.signal ?? undefined);
        return Promise.resolve(ok([{ index: 0, embedding: vector(1) }]));
      }),
    );
    await new InfinityClient(env()).embed(['a']);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
  });
});

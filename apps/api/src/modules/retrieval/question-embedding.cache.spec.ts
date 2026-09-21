import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingClient } from '../../adapters/embedding/infinity.client';
import { keyFor, QuestionEmbeddingCache, TTL_SECONDS } from './question-embedding.cache';

const VECTOR = [0.1, 0.2, 0.3];

function cacheWith(store = new Map<string, string>(), broken = false) {
  const get = vi.fn((key: string) =>
    broken ? Promise.reject(new Error('down')) : Promise.resolve(store.get(key) ?? null),
  );
  const set = vi.fn((key: string, value: string) => {
    if (broken) return Promise.reject(new Error('down'));
    store.set(key, value);
    return Promise.resolve('OK');
  });
  const embed = vi.fn().mockResolvedValue([VECTOR]);
  return {
    cache: new QuestionEmbeddingCache(
      { get, set } as unknown as Redis,
      {
        embed,
      } as unknown as EmbeddingClient,
    ),
    embed,
    get,
    set,
    store,
  };
}

describe('keyFor', () => {
  it('hashes the question rather than storing it in the key', () => {
    const key = keyFor('BAAI/bge-m3', 'phương thức thanh toán');
    expect(key).not.toContain('thanh toán');
    expect(key).toMatch(/^q-embed:BAAI\/bge-m3:[0-9a-f]{64}$/);
  });

  it('gives the same question the same key', () => {
    expect(keyFor('m', 'câu hỏi')).toBe(keyFor('m', 'câu hỏi'));
  });

  it('separates two questions that differ only by a diacritic', () => {
    expect(keyFor('m', 'hợp đồng')).not.toBe(keyFor('m', 'hop dong'));
  });

  it('separates the same question asked of a different model', () => {
    expect(keyFor('a', 'q')).not.toBe(keyFor('b', 'q'));
  });
});

describe('QuestionEmbeddingCache', () => {
  it('embeds a question it has not seen', async () => {
    const { cache, embed } = cacheWith();
    expect(await cache.embed('m', 'câu hỏi')).toEqual(VECTOR);
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it('does not reach the embedding client the second time', async () => {
    const { cache, embed } = cacheWith();
    await cache.embed('m', 'câu hỏi');
    expect(await cache.embed('m', 'câu hỏi')).toEqual(VECTOR);
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it('embeds again for a different question', async () => {
    const { cache, embed } = cacheWith();
    await cache.embed('m', 'câu hỏi một');
    await cache.embed('m', 'câu hỏi hai');
    expect(embed).toHaveBeenCalledTimes(2);
  });

  it('stores the vector for an hour', async () => {
    const { cache, set } = cacheWith();
    await cache.embed('m', 'câu hỏi');
    expect(set).toHaveBeenCalledWith(expect.any(String), JSON.stringify(VECTOR), 'EX', TTL_SECONDS);
    expect(TTL_SECONDS).toBe(3600);
  });

  it('answers anyway when the cache cannot be read', async () => {
    const { cache, embed } = cacheWith(new Map(), true);
    expect(await cache.embed('m', 'câu hỏi')).toEqual(VECTOR);
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it('answers anyway when the cache cannot be written', async () => {
    const { cache } = cacheWith(new Map(), true);
    await expect(cache.embed('m', 'câu hỏi')).resolves.toEqual(VECTOR);
  });

  it('stores nothing when the client returns no vector', async () => {
    const empty = new QuestionEmbeddingCache(
      { get: vi.fn().mockResolvedValue(null), set: vi.fn() } as unknown as Redis,
      { embed: vi.fn().mockResolvedValue([]) } as unknown as EmbeddingClient,
    );
    expect(await empty.embed('m', 'q')).toBeUndefined();
  });
});

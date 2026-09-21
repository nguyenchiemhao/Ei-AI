import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../adapters/cache/cache.module';
import { EMBEDDING_CLIENT, type EmbeddingClient } from '../../adapters/embedding/infinity.client';

const TTL_SECONDS = 3600;

// The question is hashed rather than stored: a Redis key is readable by anyone with the server,
// and what people ask their documents is not something to leave lying around in plain text.
function keyFor(model: string, question: string): string {
  return `q-embed:${model}:${createHash('sha256').update(question, 'utf8').digest('hex')}`;
}

@Injectable()
export class QuestionEmbeddingCache {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(EMBEDDING_CLIENT) private readonly embeddings: EmbeddingClient,
  ) {}

  // A cache miss and a cache that is down are the same thing here: embed the question and carry
  // on. Losing a search because Redis blinked would trade an optimisation for an outage.
  async embed(model: string, question: string): Promise<number[] | undefined> {
    const key = keyFor(model, question);
    const cached = await this.read(key);
    if (cached !== undefined) return cached;
    const [embedding] = await this.embeddings.embed([question]);
    if (embedding !== undefined) await this.write(key, embedding);
    return embedding;
  }

  private async read(key: string): Promise<number[] | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as number[]);
    } catch {
      return undefined;
    }
  }

  private async write(key: string, embedding: readonly number[]): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(embedding), 'EX', TTL_SECONDS);
    } catch {
      // A cache that cannot be written is still a search that can be answered.
    }
  }
}

export { TTL_SECONDS, keyFor };

import { Inject, Injectable } from '@nestjs/common';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';

export const EMBEDDING_CLIENT = Symbol('EMBEDDING_CLIENT');

// `chunks.embedding` is halfvec(1024): the width is enforced by the schema, so it is a constant
// here rather than a setting that could disagree with the column.
export const EMBEDDING_DIMENSIONS = 1024;

export interface EmbeddingClient {
  embed(texts: readonly string[]): Promise<number[][]>;
}

interface EmbeddingResponse {
  data: { index: number; embedding: number[] }[];
}

export function backoffDelay(attempt: number, baseMs: number): number {
  return baseMs * 2 ** (attempt - 1);
}

// A restart of infinity is a connection refused or a 503 for as long as it takes to load the
// models, so those are worth waiting out. A 400 is our own malformed request and waiting will
// not improve it.
function isWorthRetrying(status: number | undefined): boolean {
  return status === undefined || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class EmbeddingRequestFailed extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EmbeddingRequestFailed';
  }
}

function batched<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

// The response carries an index per vector because the server does not promise to answer in the
// order it was asked. Ordering by that index is what keeps a chunk matched to its own embedding.
function vectorsInRequestOrder(body: EmbeddingResponse, expected: number): number[][] {
  if (body.data.length !== expected) {
    throw new EmbeddingRequestFailed(
      `Asked for ${expected} embeddings and received ${body.data.length}`,
    );
  }
  const ordered = [...body.data].sort((a, b) => a.index - b.index);
  return ordered.map(({ embedding, index }) => {
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new EmbeddingRequestFailed(
        `Embedding ${index} has ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
      );
    }
    return embedding;
  });
}

@Injectable()
export class InfinityClient implements EmbeddingClient {
  constructor(@Inject(CONFIG) private readonly config: Env) {}

  async embed(texts: readonly string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const batch of batched(texts, this.config.EMBEDDING_BATCH_SIZE)) {
      vectors.push(...(await this.embedBatchWithRetries(batch)));
    }
    return vectors;
  }

  private async embedBatchWithRetries(batch: readonly string[]): Promise<number[][]> {
    let lastFailure: unknown;
    for (let attempt = 1; attempt <= this.config.EMBEDDING_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.embedBatch(batch);
      } catch (failure) {
        lastFailure = failure;
        const status = failure instanceof EmbeddingRequestFailed ? failure.status : undefined;
        if (!isWorthRetrying(status) || attempt === this.config.EMBEDDING_MAX_ATTEMPTS) break;
        await sleep(backoffDelay(attempt, this.config.EMBEDDING_BACKOFF_MS));
      }
    }
    const reason = lastFailure instanceof Error ? lastFailure.message : String(lastFailure);
    throw new EmbeddingRequestFailed(
      `Embedding failed after ${this.config.EMBEDDING_MAX_ATTEMPTS} attempts: ${reason}`,
    );
  }

  private async embedBatch(batch: readonly string[]): Promise<number[][]> {
    const response = await fetch(`${this.config.EMBEDDING_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.config.EMBEDDING_MODEL, input: batch }),
      signal: AbortSignal.timeout(this.config.EMBEDDING_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new EmbeddingRequestFailed(
        `${this.config.EMBEDDING_MODEL} returned ${response.status}`,
        response.status,
      );
    }
    return vectorsInRequestOrder((await response.json()) as EmbeddingResponse, batch.length);
  }
}

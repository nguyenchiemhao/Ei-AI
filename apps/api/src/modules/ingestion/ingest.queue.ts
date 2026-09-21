import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { Env } from '../../config/env.schema';

export const INGEST_QUEUE_NAME = 'ingest';
export const INGEST_JOB_NAME = 'ingest-document-version';
export const INGEST_QUEUE = Symbol('INGEST_QUEUE');

export interface IngestJob {
  documentVersionId: string;
}

// BullMQ refuses a connection whose `maxRetriesPerRequest` is not null — a worker blocks on
// commands for as long as it takes, and a retry limit would abort them. CacheModule's shared
// client keeps ioredis' default, so the queue gets one of its own rather than changing that.
export const QUEUE_CONNECTION_OPTIONS = { maxRetriesPerRequest: null } as const;

export function createQueueConnection(config: Env): Redis {
  return new Redis(config.REDIS_URL, QUEUE_CONNECTION_OPTIONS);
}

// Retries and back-off live with the queue rather than at the call site, so every producer of an
// ingest job gets the same policy (T-3.4-02).
export function jobOptions(config: Env) {
  return {
    attempts: config.INGEST_MAX_ATTEMPTS,
    backoff: { type: 'exponential' as const, delay: config.INGEST_BACKOFF_MS },
    removeOnComplete: { age: 86_400, count: 1_000 },
    removeOnFail: false as const,
  };
}

@Injectable()
export class IngestQueue implements OnModuleDestroy {
  constructor(@Inject(INGEST_QUEUE) private readonly queue: Queue<IngestJob>) {}

  // The job id is the version's own id: a version enqueued twice produces one job, so a retried
  // upload or a redelivered request cannot put the same bytes through the pipeline twice.
  async enqueue(documentVersionId: string): Promise<string> {
    const job = await this.queue.add(
      INGEST_JOB_NAME,
      { documentVersionId },
      { jobId: documentVersionId },
    );
    return job.id ?? documentVersionId;
  }

  onModuleDestroy(): Promise<void> {
    return this.queue.close();
  }
}

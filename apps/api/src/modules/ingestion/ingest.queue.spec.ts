import { describe, expect, it, vi } from 'vitest';
import Redis from 'ioredis';
import type { Queue } from 'bullmq';
import type { Env } from '../../config/env.schema';
import {
  createQueueConnection,
  IngestQueue,
  INGEST_JOB_NAME,
  jobOptions,
  QUEUE_CONNECTION_OPTIONS,
} from './ingest.queue';

// The constructor is mocked rather than a Redis being reached: stage 3 has no Redis, and what is
// under test is which options the queue asks for, not whether ioredis can connect.
vi.mock('ioredis', () => ({ default: vi.fn() }));

function env(overrides: Partial<Env> = {}): Env {
  return { INGEST_MAX_ATTEMPTS: 3, INGEST_BACKOFF_MS: 2000, ...overrides } as Env;
}

function queueWith(add = vi.fn().mockResolvedValue({ id: 'v-1' })) {
  const close = vi.fn().mockResolvedValue(undefined);
  return { queue: new IngestQueue({ add, close } as unknown as Queue), add, close };
}

describe('the queue connection', () => {
  it('turns the retry limit off, which BullMQ refuses a worker without', () => {
    expect(QUEUE_CONNECTION_OPTIONS.maxRetriesPerRequest).toBeNull();
  });

  it('is built from the configured url, with that option', () => {
    createQueueConnection({ REDIS_URL: 'redis://redis:6379' } as Env);
    expect(Redis).toHaveBeenCalledWith('redis://redis:6379', QUEUE_CONNECTION_OPTIONS);
  });
});

describe('jobOptions', () => {
  it('takes the attempt count and the back-off from configuration', () => {
    expect(jobOptions(env())).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  });

  it('keeps failed jobs, so a failure can still be read after the fact', () => {
    expect(jobOptions(env()).removeOnFail).toBe(false);
  });

  it('does not keep completed jobs for ever', () => {
    expect(jobOptions(env()).removeOnComplete).toMatchObject({ age: 86_400, count: 1_000 });
  });
});

describe('IngestQueue', () => {
  it('names the job and carries the version in its payload', async () => {
    const { queue, add } = queueWith();
    await queue.enqueue('v-1', 'c-1');
    expect(add).toHaveBeenCalledWith(
      INGEST_JOB_NAME,
      { documentVersionId: 'v-1', correlationId: 'c-1' },
      { jobId: 'v-1' },
    );
  });

  it('uses the version id as the job id, so the same version cannot queue twice', async () => {
    const { queue, add } = queueWith();
    await queue.enqueue('v-7', 'c-1');
    expect(add.mock.calls[0]![2]).toEqual({ jobId: 'v-7' });
  });

  it('returns the id the queue assigned', async () => {
    const { queue } = queueWith(vi.fn().mockResolvedValue({ id: 'assigned' }));
    await expect(queue.enqueue('v-1', 'c-1')).resolves.toBe('assigned');
  });

  it('falls back to the version id when the queue reports none', async () => {
    const { queue } = queueWith(vi.fn().mockResolvedValue({ id: undefined }));
    await expect(queue.enqueue('v-1', 'c-1')).resolves.toBe('v-1');
  });

  it('closes the queue when the module goes down', async () => {
    const { queue, close } = queueWith();
    await queue.onModuleDestroy();
    expect(close).toHaveBeenCalled();
  });
});

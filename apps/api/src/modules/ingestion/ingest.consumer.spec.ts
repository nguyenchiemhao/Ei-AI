import { type Job, Worker } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema';
import { IngestConsumer } from './ingest.consumer';
import type { IngestJob } from './ingest.queue';
import type { IngestionService } from './ingestion.service';

// Both constructors are mocked: stage 3 has no Redis, and what is under test is how the worker is
// configured, not whether BullMQ can reach one.
vi.mock('ioredis', () => ({ default: vi.fn() }));
vi.mock('bullmq', () => ({ Worker: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })) }));

function consumerWith() {
  const markFailed = vi.fn().mockResolvedValue(undefined);
  const consumer = new IngestConsumer({} as Env, { markFailed } as unknown as IngestionService);
  return { consumer, markFailed };
}

// `opts` is passed whole rather than as an optional number: a default parameter would swallow the
// explicit `undefined` this suite needs to send, and the job would arrive with three attempts.
function jobOf(
  attemptsMade: number,
  opts: { attempts?: number } = { attempts: 3 },
): Job<IngestJob> {
  return {
    id: 'v-1',
    attemptsMade,
    opts,
    data: { documentVersionId: 'v-1', correlationId: 'c-1' },
  } as unknown as Job<IngestJob>;
}

describe('IngestConsumer.onFailed', () => {
  it('leaves the row alone while a retry is still to come', async () => {
    const { consumer, markFailed } = consumerWith();
    await consumer.onFailed(jobOf(1), new Error('ENOENT'));
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('marks the version failed once the queue has given up', async () => {
    const { consumer, markFailed } = consumerWith();
    await consumer.onFailed(jobOf(3), new Error('ENOENT: no such file\n  at read'));
    expect(markFailed).toHaveBeenCalledWith('v-1', 'ENOENT: no such file', 'c-1');
  });

  it('logs a retry for a job the queue gave no id, rather than printing undefined', async () => {
    const { consumer, markFailed } = consumerWith();
    const job = { ...jobOf(1), id: undefined } as unknown as Job<IngestJob>;
    await consumer.onFailed(job, new Error('ENOENT'));
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('treats a job with no attempts configured as its own last attempt', async () => {
    const { consumer, markFailed } = consumerWith();
    await consumer.onFailed(jobOf(1, {}), new Error('boom'));
    expect(markFailed).toHaveBeenCalledWith('v-1', 'boom', 'c-1');
  });

  it('writes nothing when the job itself could not be read', async () => {
    const { consumer, markFailed } = consumerWith();
    await consumer.onFailed(undefined, new Error('lost'));
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('runs one document at a time, because a batch already fills the VRAM budget', () => {
    const { consumer } = consumerWith();
    consumer.start();
    const [name, , options] = vi.mocked(Worker).mock.calls[0]!;
    expect(name).toBe('ingest');
    expect(options).toMatchObject({ concurrency: 1 });
  });

  it('hands the job to the pipeline with the correlation id it carries', async () => {
    const ingest = vi.fn().mockResolvedValue(undefined);
    const consumer = new IngestConsumer({} as Env, { ingest } as unknown as IngestionService);
    // The Worker double is module-scoped, so its calls accumulate across this file: the constructor
    // arguments wanted here are this consumer's, not whichever test ran first.
    vi.mocked(Worker).mockClear();
    consumer.start();
    const processor = vi.mocked(Worker).mock.calls[0]![1] as (job: unknown) => unknown;
    await processor({ data: { documentVersionId: 'v-1', correlationId: 'c-1' } });
    expect(ingest).toHaveBeenCalledWith('v-1', 'c-1');
  });

  it('survives a failure handler that itself fails', async () => {
    // `void` on a rejected promise is an unhandled rejection and Node ends the process; one job
    // whose audit row could not be written took the worker down with it.
    const consumer = new IngestConsumer(
      {} as Env,
      {
        markFailed: vi.fn().mockRejectedValue(new Error('audit down')),
      } as unknown as IngestionService,
    );
    const worker = consumer.start();
    const handler = vi.mocked(worker.on).mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: unknown,
      error: Error,
    ) => void;
    const withoutId = { ...jobOf(3), id: undefined } as unknown as Job<IngestJob>;
    expect(() => handler(withoutId, new Error('boom'))).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('closes the worker it started when the module goes down', async () => {
    const { consumer } = consumerWith();
    const worker = consumer.start();
    await consumer.onModuleDestroy();
    expect(worker.close).toHaveBeenCalled();
  });

  it('closes nothing when no worker was ever started', async () => {
    const { consumer } = consumerWith();
    await expect(consumer.onModuleDestroy()).resolves.toBeUndefined();
  });
});

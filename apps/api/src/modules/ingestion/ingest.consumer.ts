import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type Job, Worker } from 'bullmq';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { failureReason, isFinalAttempt } from './job-attempts';
import {
  correlationOf,
  createQueueConnection,
  INGEST_QUEUE_NAME,
  type IngestJob,
} from './ingest.queue';
import { IngestionService } from './ingestion.service';

// Started by worker.main.ts and by nothing else: the API process produces jobs and the worker
// process consumes them, and both boot the same module graph from the same image.
@Injectable()
export class IngestConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(IngestConsumer.name);
  private worker?: Worker<IngestJob>;

  constructor(
    @Inject(CONFIG) private readonly config: Env,
    private readonly ingestion: IngestionService,
  ) {}

  start(): Worker<IngestJob> {
    const worker = new Worker<IngestJob>(
      INGEST_QUEUE_NAME,
      (job: Job<IngestJob>) =>
        this.ingestion.ingest(job.data.documentVersionId, correlationOf(job.data)),
      // One job at a time: a batch of embeddings already saturates the 4 GB VRAM budget, and a
      // second concurrent document would contend for it rather than finish sooner.
      { connection: createQueueConnection(this.config), concurrency: 1 },
    );
    // The failure handler must not be able to take the worker down with it. `void` on a rejected
    // promise is an unhandled rejection, and Node kills the process: a job whose audit row could
    // not be written once stopped every later job from running at all.
    worker.on('failed', (job, error) => {
      this.onFailed(job, error).catch((failure: unknown) => {
        const reason = failure instanceof Error ? failure.message : String(failure);
        this.logger.error(`could not record the failure of ${job?.id ?? 'unknown'}: ${reason}`);
      });
    });
    this.worker = worker;
    return worker;
  }

  // A version is marked failed only once the queue has given up. Until then the row stays where it
  // is and the attempt is a warning, so a reader is not told a document failed while it is retrying.
  async onFailed(job: Job<IngestJob> | undefined, error: Error): Promise<void> {
    if (job === undefined) {
      this.logger.error(`a job failed before it could be read: ${error.message}`);
      return;
    }
    const attempts = { attemptsMade: job.attemptsMade, attempts: job.opts.attempts ?? 1 };
    if (!isFinalAttempt(attempts)) {
      this.logger.warn(
        `${job.id ?? 'unknown'} attempt ${job.attemptsMade}/${attempts.attempts}: ${error.message}`,
      );
      return;
    }
    await this.ingestion.markFailed(
      job.data.documentVersionId,
      failureReason(error),
      correlationOf(job.data),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

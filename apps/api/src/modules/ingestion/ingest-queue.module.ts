import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import {
  createQueueConnection,
  INGEST_QUEUE,
  INGEST_QUEUE_NAME,
  IngestQueue,
  jobOptions,
} from './ingest.queue';

// The producer half, kept in a module of its own because the upload path needs it and the
// consumer half needs the workspaces repositories. Without the split, workspaces and ingestion
// would import each other and the no-circular rule would refuse it — correctly.
@Module({
  providers: [
    {
      provide: INGEST_QUEUE,
      inject: [CONFIG],
      useFactory: (config: Env) =>
        new Queue(INGEST_QUEUE_NAME, {
          connection: createQueueConnection(config),
          defaultJobOptions: jobOptions(config),
        }),
    },
    IngestQueue,
  ],
  exports: [IngestQueue],
})
export class IngestQueueModule {}

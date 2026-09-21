import { Module } from '@nestjs/common';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { IngestConsumer } from './ingest.consumer';
import { IngestQueueModule } from './ingest-queue.module';
import { IngestionService } from './ingestion.service';
import { PagesRepository } from './pages.repository';
import { createTokenCounter, TOKEN_COUNTER } from './token-counter';
import { Chunker } from './chunker';
import { ChunksRepository } from './chunks.repository';

// WorkspacesModule is imported for the document and version repositories it exports. The consumer
// is provided here but started only by worker.main.ts: the API produces jobs, the worker runs them.
@Module({
  imports: [WorkspacesModule, IngestQueueModule],
  providers: [
    {
      provide: TOKEN_COUNTER,
      inject: [CONFIG],
      useFactory: (config: Env) => createTokenCounter(config),
    },
    Chunker,
    IngestionService,
    PagesRepository,
    ChunksRepository,
    IngestConsumer,
  ],
  exports: [IngestConsumer],
})
export class IngestionModule {}

import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { HybridSearchRepository } from './hybrid-search.repository';
import { QuestionEmbeddingCache } from './question-embedding.cache';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';

// IdentityModule is imported for JwtAuthGuard, as the workspaces module does. The embedding client
// is global, and nothing here reaches into another module's service.
@Module({
  imports: [IdentityModule],
  controllers: [RetrievalController],
  providers: [RetrievalService, HybridSearchRepository, QuestionEmbeddingCache],
  exports: [RetrievalService],
})
export class RetrievalModule {}

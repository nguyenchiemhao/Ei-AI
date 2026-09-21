import { Global, Module } from '@nestjs/common';
import { EMBEDDING_CLIENT, InfinityClient } from './infinity.client';

// Global because both ingestion and retrieval embed, and neither may import the other. The client
// is an adapter rather than one of design §5.4's three seams: the vector store is the seam, and
// swapping infinity for another embedding server is not the change that port was drawn for.
@Global()
@Module({
  providers: [{ provide: EMBEDDING_CLIENT, useClass: InfinityClient }],
  exports: [EMBEDDING_CLIENT],
})
export class EmbeddingModule {}

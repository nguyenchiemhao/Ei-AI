import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import type { VersionStatus } from '../../database/schema';
import { EMBEDDING_CLIENT, type EmbeddingClient } from '../../adapters/embedding/infinity.client';
import { STORAGE_PORT, type StoragePort } from '../../ports/storage.port';
import { DocumentVersionsRepository } from '../workspaces/document-versions.repository';
import { DocumentsRepository } from '../workspaces/documents.repository';
import { Chunker } from './chunker';
import { chunkerVersion } from './chunker';
import { ChunksRepository } from './chunks.repository';
import { PagesRepository } from './pages.repository';
import { needsNoParser } from './text-formats';
import { assertTransition } from './version-state';

async function readUtf8(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly versions: DocumentVersionsRepository,
    private readonly documents: DocumentsRepository,
    private readonly pages: PagesRepository,
    private readonly chunks: ChunksRepository,
    private readonly chunker: Chunker,
    @Inject(CONFIG) private readonly config: Env,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(EMBEDDING_CLIENT) private readonly embeddings: EmbeddingClient,
  ) {}

  async ingest(documentVersionId: string): Promise<void> {
    const version = await this.versions.findById(documentVersionId);
    if (version === undefined) {
      throw new AppException('NOT_FOUND', `No document version ${documentVersionId}`);
    }
    const document = await this.documents.findById(version.documentId);
    if (document === undefined) {
      throw new AppException('NOT_FOUND', `No document ${version.documentId}`);
    }
    if (!needsNoParser(document.sourceFilename)) {
      this.logger.log(`${version.id} is ${document.sourceFilename}: left at uploaded for 2A`);
      return;
    }
    const text = await this.parse(version.id, version.status as VersionStatus, version.storageKey);
    await this.chunkAndEmbed(version.id, text);
  }

  // Chunking and embedding are one step from the caller's point of view but two states, because a
  // document stuck at `embedding` and one stuck at `chunking` are different problems.
  private async chunkAndEmbed(id: string, text: string): Promise<void> {
    await this.transition(id, 'parsed', 'chunking');
    const chunks = this.chunker.chunk(text);
    await this.transition(id, 'chunking', 'embedding');
    const vectors = await this.embeddings.embed(chunks.map((chunk) => chunk.text));
    await this.chunks.replaceAll(
      id,
      chunks.map((chunk, index) => ({ ...chunk, chunkNo: index + 1, embedding: vectors[index]! })),
    );
    await this.versions.setIndexed(id, chunkerVersion(this.config));
    this.logger.log(`${id} indexed: ${chunks.length} chunks`);
  }

  // Markdown and plain text need no parser, so "parsing" reads the stored bytes and writes the one
  // page they amount to. The state machine still runs, which is what keeps milestone 2A an extra
  // worker on this path rather than a new shape for it.
  private async parse(id: string, from: VersionStatus, storageKey: string): Promise<string> {
    await this.transition(id, from, 'parsing');
    const text = await readUtf8(this.storage.read(storageKey));
    await this.pages.replaceAll(id, [{ pageNo: 1, text, extractionMethod: 'markdown' }]);
    await this.transition(id, 'parsing', 'parsed');
    return text;
  }

  private async transition(id: string, from: VersionStatus, to: VersionStatus): Promise<void> {
    assertTransition(from, to);
    await this.versions.setStatus(id, to);
  }

  // Called once the queue has exhausted its attempts, so the row records why a document is not
  // indexed rather than leaving the reason in a log line nobody will go looking for.
  async markFailed(documentVersionId: string, reason: string): Promise<void> {
    this.logger.error(`${documentVersionId} failed: ${reason}`);
    await this.versions.setStatus(documentVersionId, 'failed', reason);
  }
}

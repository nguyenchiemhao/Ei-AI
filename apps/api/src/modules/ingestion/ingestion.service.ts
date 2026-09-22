import { Inject, Injectable, Logger } from '@nestjs/common';
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from '@ei-ai/shared-types';
import { AppException } from '../../common/app-exception';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import type { VersionStatus } from '../../database/schema';
import type { Tx } from '../../database/transaction';
import { EMBEDDING_CLIENT, type EmbeddingClient } from '../../adapters/embedding/infinity.client';
import { STORAGE_PORT, type StoragePort } from '../../ports/storage.port';
import { DocumentVersionsRepository } from '../workspaces/document-versions.repository';
import { DocumentsRepository } from '../workspaces/documents.repository';
import { AuditService } from '../audit/audit.service';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import { withTransaction } from '../../database/transaction';
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
    private readonly audit: AuditService,
    @Inject(DATABASE) private readonly db: Database,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(EMBEDDING_CLIENT) private readonly embeddings: EmbeddingClient,
  ) {}

  async ingest(documentVersionId: string, correlationId: string): Promise<void> {
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
    const text = await this.parse(
      version.id,
      version.status as VersionStatus,
      version.storageKey,
      correlationId,
      document.workspaceId,
    );
    await this.chunkAndEmbed(version.id, text, correlationId, document.workspaceId);
  }

  // Chunking and embedding are one step from the caller's point of view but two states, because a
  // document stuck at `embedding` and one stuck at `chunking` are different problems.
  private async chunkAndEmbed(
    id: string,
    text: string,
    correlationId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.transition(id, 'parsed', 'chunking', correlationId, workspaceId);
    const chunks = this.chunker.chunk(text);
    await this.transition(id, 'chunking', 'embedding', correlationId, workspaceId);
    const vectors = await this.embeddings.embed(chunks.map((chunk) => chunk.text));
    await this.chunks.replaceAll(
      id,
      chunks.map((chunk, index) => ({ ...chunk, chunkNo: index + 1, embedding: vectors[index]! })),
    );
    await withTransaction(this.db, async (tx) => {
      await this.versions.setIndexed(id, chunkerVersion(this.config), tx);
      await this.recordTransition(id, 'embedding', 'indexed', correlationId, workspaceId, tx);
    });
    this.logger.log(`${id} indexed: ${chunks.length} chunks`);
  }

  // Markdown and plain text need no parser, so "parsing" reads the stored bytes and writes the one
  // page they amount to. The state machine still runs, which is what keeps milestone 2A an extra
  // worker on this path rather than a new shape for it.
  private async parse(
    id: string,
    from: VersionStatus,
    storageKey: string,
    correlationId: string,
    workspaceId: string,
  ): Promise<string> {
    await this.transition(id, from, 'parsing', correlationId, workspaceId);
    const text = await readUtf8(this.storage.read(storageKey));
    await this.pages.replaceAll(id, [{ pageNo: 1, text, extractionMethod: 'markdown' }]);
    await this.transition(id, 'parsing', 'parsed', correlationId, workspaceId);
    return text;
  }

  // Every transition and its audit row commit together: a state nobody can account for is worse
  // than a document that did not move.
  private async transition(
    id: string,
    from: VersionStatus,
    to: VersionStatus,
    correlationId: string,
    workspaceId: string,
  ): Promise<void> {
    assertTransition(from, to);
    await withTransaction(this.db, async (tx) => {
      await this.versions.setStatus(id, to, null, tx);
      await this.recordTransition(id, from, to, correlationId, workspaceId, tx);
    });
  }

  private recordTransition(
    id: string,
    from: VersionStatus,
    to: VersionStatus,
    correlationId: string,
    workspaceId: string,
    tx: Tx,
  ): Promise<unknown> {
    return this.audit.record(
      {
        action: AUDIT_ACTIONS.DOCUMENT_VERSION_STATE_CHANGED,
        objectKind: AUDIT_OBJECTS.DOCUMENT_VERSION,
        objectId: id,
        workspaceId,
        // The worker acts on nobody's behalf; the correlation id is what ties this to the upload.
        actorUserId: null,
        actorIp: null,
        correlationId,
        detail: { from, to },
      },
      tx,
    );
  }

  // Called once the queue has exhausted its attempts, so the row records why a document is not
  // indexed rather than leaving the reason in a log line nobody will go looking for.
  async markFailed(
    documentVersionId: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    this.logger.error(`${documentVersionId} failed: ${reason}`);
    const version = await this.versions.findById(documentVersionId);
    const document =
      version === undefined ? undefined : await this.documents.findById(version.documentId);
    await withTransaction(this.db, async (tx) => {
      await this.versions.setStatus(documentVersionId, 'failed', reason, tx);
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.DOCUMENT_VERSION_STATE_CHANGED,
          objectKind: AUDIT_OBJECTS.DOCUMENT_VERSION,
          objectId: documentVersionId,
          workspaceId: document?.workspaceId ?? null,
          actorUserId: null,
          actorIp: null,
          correlationId,
          detail: { from: version?.status ?? null, to: 'failed', reason },
        },
        tx,
      );
    });
  }
}

import { AUDIT_ACTIONS, AUDIT_OBJECTS } from '@ei-ai/shared-types';
import type { ActorContext } from '../audit/audit-context';
import { AuditService } from '../audit/audit.service';
import { IngestQueue } from '../ingestion/ingest.queue';
import { createReadStream } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { withTransaction, type Tx } from '../../database/transaction';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';
import { AppException } from '../../common/app-exception';
import { STORAGE_PORT, type StoragePort, type StoredObject } from '../../ports/storage.port';
import { contentMatchesFormat, SIGNATURE_SAMPLE_BYTES } from './content-signature';
import { DocumentVersionsRepository } from './document-versions.repository';
import { DocumentsRepository, type DocumentRecord } from './documents.repository';
import {
  describeSupportedFormats,
  formatForFilename,
  type SupportedFormat,
} from './supported-formats';
import { describeLimit, MAX_UPLOAD_BYTES } from './upload-limits';
import { WorkspaceMembersRepository } from './workspace-members.repository';

const MAY_UPLOAD = new Set(['Owner', 'Editor']);

// Busboy decodes a multipart filename as latin-1, so `hợp đồng.csv` reaches the handler as
// `há»£p Äá»ng.csv` and would be stored that way. Reinterpreting those bytes as UTF-8 puts it
// back; a pure-ASCII name passes through unchanged, because the two encodings agree there.
export function decodeMultipartFilename(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8');
}

const DUPLICATE_CONTENT = 'dv_content_unique';
const UNIQUE_VIOLATION = '23505';

function isDuplicateContent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION &&
    String((error as { constraint?: string }).constraint ?? '').includes(DUPLICATE_CONTENT)
  );
}

export interface StoredDocument {
  documentId: string;
  versionId: string;
  versionNo: number;
  storageKey: string;
  sha256: string;
  byteSize: number;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

// T-3.2-06 replaces this with WorkspaceRoleGuard, like the Owner rule in MembershipsService.
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly ingestQueue: IngestQueue,
    private readonly audit: AuditService,
    private readonly members: WorkspaceMembersRepository,
    private readonly documents: DocumentsRepository,
    private readonly versions: DocumentVersionsRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async store(
    workspaceId: string,
    actor: ActorContext,
    file: UploadedFile,
  ): Promise<StoredDocument> {
    const callerId = actor.actorUserId;
    try {
      await this.assertMayUpload(workspaceId, callerId);
      const filename = decodeMultipartFilename(file.originalname);
      const format = this.formatOf(filename);
      this.assertWithinLimit(file);
      await this.assertContentMatchesExtension(format, file);
      const stored = await this.storage.put(createReadStream(file.path));
      const document = await this.record(
        workspaceId,
        actor,
        { ...file, originalname: filename },
        format.contentType,
        stored,
      );
      await this.queueIngestion(document.versionId, actor.correlationId);
      return document;
    } finally {
      await rm(file.path, { force: true });
    }
  }

  // Queued after the transaction commits, and a failure here does not fail the upload: the bytes
  // are stored and the row exists, so the document simply stays at `uploaded` — which is what the
  // status column is for. Losing the response to a queue that is briefly down would be worse.
  private async queueIngestion(versionId: string, correlationId: string): Promise<void> {
    try {
      await this.ingestQueue.enqueue(versionId, correlationId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`${versionId} stored but not queued: ${reason}`);
    }
  }

  // The same filename uploaded again is a new version of the same document. Identical bytes are
  // refused by `dv_content_unique` rather than by a lookup here: a check in application code is
  // a race between two uploads, and the constraint is not.
  private async record(
    workspaceId: string,
    actor: ActorContext,
    file: UploadedFile,
    contentType: string,
    stored: StoredObject,
  ): Promise<StoredDocument> {
    const callerId = actor.actorUserId;
    return withTransaction(this.db, async (tx) => {
      const document = await this.documentFor(workspaceId, callerId, file, contentType, tx);
      const versionNo = await this.versions.nextVersionNo(document.id, tx);
      try {
        const version = await this.versions.insert(
          {
            documentId: document.id,
            versionNo,
            storageKey: stored.storageKey,
            byteSize: stored.byteSize,
            sha256: stored.sha256,
            uploadedBy: callerId,
          },
          tx,
        );
        await this.documents.setCurrentVersion(document.id, version.id, tx);
        await this.audit.record(
          {
            ...actor,
            action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
            objectKind: AUDIT_OBJECTS.DOCUMENT,
            objectId: document.id,
            workspaceId,
            detail: {
              sourceFilename: file.originalname,
              contentType,
              byteSize: version.byteSize,
              sha256: version.sha256,
              versionNo: version.versionNo,
            },
          },
          tx,
        );
        return {
          documentId: document.id,
          versionId: version.id,
          versionNo: version.versionNo,
          storageKey: version.storageKey,
          sha256: version.sha256,
          byteSize: version.byteSize,
        };
      } catch (error) {
        if (isDuplicateContent(error)) {
          throw new AppException(
            'DOC_DUPLICATE_CONTENT',
            'This content is already a version of the document; no duplicate version is created',
            { documentId: document.id, sha256: stored.sha256 },
          );
        }
        throw error;
      }
    });
  }

  private async documentFor(
    workspaceId: string,
    callerId: string,
    file: UploadedFile,
    contentType: string,
    tx: Tx,
  ): Promise<DocumentRecord> {
    const existing = await this.documents.findByFilename(workspaceId, file.originalname, tx);
    return (
      existing ??
      (await this.documents.insert(
        {
          workspaceId,
          title: file.originalname,
          sourceFilename: file.originalname,
          contentType,
          createdBy: callerId,
        },
        tx,
      ))
    );
  }

  private async assertMayUpload(workspaceId: string, callerId: string): Promise<void> {
    const role = await this.members.findRole(workspaceId, callerId);
    if (role === undefined || !MAY_UPLOAD.has(role)) {
      throw new AppException('AUTHZ_WORKSPACE_FORBIDDEN', 'Only an Editor or Owner may upload');
    }
  }

  // The extension decides which of the ten formats this claims to be; T-3.3-05 then checks the
  // bytes against that claim. An unknown extension is refused with the list, because "wrong
  // format" without saying which are right leaves the reader guessing.
  private formatOf(filename: string): SupportedFormat {
    const format = formatForFilename(filename);
    if (!format) {
      throw new AppException(
        'DOC_UNSUPPORTED_FORMAT',
        `Unsupported format. Accepted formats: ${describeSupportedFormats()}`,
        { supportedFormats: describeSupportedFormats() },
      );
    }
    return format;
  }

  // FR-09. The extension is the uploader's claim about what the bytes are; this reads the bytes.
  // A .pdf whose first bytes are an ELF header is the case the check exists for, and renaming a
  // file is the cheapest attack there is.
  private async assertContentMatchesExtension(
    format: SupportedFormat,
    file: UploadedFile,
  ): Promise<void> {
    if (contentMatchesFormat(format.id, await readSample(file.path))) {
      return;
    }
    throw new AppException(
      'DOC_CONTENT_MISMATCH',
      `File contents do not match the ${format.id.toUpperCase()} format its extension declares`,
      { declaredFormat: format.id },
    );
  }

  // The second of the two limits. The first reads Content-Length and refuses before the body
  // arrives; this one counts what actually arrived, because the header is the client's claim.
  private assertWithinLimit(file: UploadedFile): void {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AppException('DOC_TOO_LARGE', describeLimit(), {
        limitBytes: MAX_UPLOAD_BYTES,
        receivedBytes: file.size,
      });
    }
  }
}

async function readSample(path: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const sample = Buffer.alloc(SIGNATURE_SAMPLE_BYTES);
    const { bytesRead } = await handle.read(sample, 0, SIGNATURE_SAMPLE_BYTES, 0);
    return sample.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

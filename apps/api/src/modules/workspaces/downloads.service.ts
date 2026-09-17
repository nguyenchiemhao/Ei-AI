import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { AppException } from '../../common/app-exception';
import { STORAGE_PORT, type StoragePort } from '../../ports/storage.port';
import { DocumentVersionsRepository } from './document-versions.repository';
import { DocumentsRepository } from './documents.repository';
import { WorkspaceMembersRepository } from './workspace-members.repository';

export interface DownloadableDocument {
  filename: string;
  contentType: string;
  byteSize: number;
  body: Readable;
}

@Injectable()
export class DownloadsService {
  constructor(
    private readonly documents: DocumentsRepository,
    private readonly versions: DocumentVersionsRepository,
    private readonly members: WorkspaceMembersRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  // Any member may read; Reader is the lowest workspace role there is. T-3.2-06 moves the check
  // to WorkspaceRoleGuard, like the Owner rule beside it.
  async current(documentId: string, callerId: string): Promise<DownloadableDocument> {
    const document = await this.documents.findById(documentId);
    if (!document) {
      throw new AppException('NOT_FOUND', 'Document does not exist');
    }
    if ((await this.members.findRole(document.workspaceId, callerId)) === undefined) {
      throw new AppException('AUTHZ_WORKSPACE_FORBIDDEN', 'Not a member of this workspace');
    }
    if (!document.currentVersionId) {
      throw new AppException('NOT_FOUND', 'Document has no versions yet');
    }
    const version = await this.versions.findById(document.currentVersionId);
    if (!version) {
      throw new AppException('NOT_FOUND', 'The current version does not exist');
    }
    return {
      filename: document.sourceFilename,
      contentType: document.contentType,
      byteSize: version.byteSize,
      body: this.storage.read(version.storageKey),
    };
  }
}

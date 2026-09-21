import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { type DocumentListing, DocumentsRepository } from './documents.repository';
import { WorkspaceMembersRepository } from './workspace-members.repository';

@Injectable()
export class DocumentsListingService {
  constructor(
    private readonly documents: DocumentsRepository,
    private readonly members: WorkspaceMembersRepository,
  ) {}

  // Reader and above, as design §7.2 has it. The list carries the ingestion state so a reader can
  // tell an indexed document from one the pipeline has not reached, rather than being shown both
  // as though they were searchable.
  async list(workspaceId: string, callerId: string): Promise<DocumentListing[]> {
    if ((await this.members.findRole(workspaceId, callerId)) === undefined) {
      throw new AppException('AUTHZ_WORKSPACE_FORBIDDEN', 'Not a member of this workspace');
    }
    return this.documents.listWithStatus(workspaceId);
  }
}

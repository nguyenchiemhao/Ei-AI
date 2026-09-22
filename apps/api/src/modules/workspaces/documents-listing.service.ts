import { Injectable } from '@nestjs/common';
import { type DocumentListing, DocumentsRepository } from './documents.repository';

@Injectable()
export class DocumentsListingService {
  constructor(private readonly documents: DocumentsRepository) {}

  // Reader and above, decided by WorkspaceRoleGuard on the route (`workspace.read`). The list
  // carries the ingestion state so a reader can tell an indexed document from one the pipeline has
  // not reached, rather than being shown both as though they were searchable.
  list(workspaceId: string): Promise<DocumentListing[]> {
    return this.documents.listWithStatus(workspaceId);
  }
}

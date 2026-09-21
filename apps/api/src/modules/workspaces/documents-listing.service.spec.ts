import { describe, expect, it, vi } from 'vitest';
import type { AppException } from '../../common/app-exception';
import { DocumentsListingService } from './documents-listing.service';
import type { DocumentListing, DocumentsRepository } from './documents.repository';
import type { WorkspaceMembersRepository, WorkspaceRole } from './workspace-members.repository';

const INDEXED: DocumentListing = {
  id: 'd-1',
  title: 'Hợp đồng gia công cơ khí số 101/HĐKT',
  sourceFilename: 'hợp đồng.md',
  contentType: 'text/markdown',
  createdAt: new Date('2026-09-21T00:00:00Z'),
  versionId: 'v-1',
  versionNo: 1,
  status: 'indexed',
  statusReason: null,
  byteSize: 4228,
  pageCount: null,
  chunkerVersion: 'v1-tokenizer',
  indexedAt: new Date('2026-09-21T00:01:00Z'),
};

function serviceWith(role: WorkspaceRole | undefined, listing: DocumentListing[] = [INDEXED]) {
  const listWithStatus = vi.fn().mockResolvedValue(listing);
  return {
    service: new DocumentsListingService(
      { listWithStatus } as unknown as DocumentsRepository,
      { findRole: vi.fn().mockResolvedValue(role) } as unknown as WorkspaceMembersRepository,
    ),
    listWithStatus,
  };
}

describe('DocumentsListingService', () => {
  it.each(['Reader', 'Editor', 'Owner'] as WorkspaceRole[])(
    'lets a %s read the list',
    async (role) => {
      const { service } = serviceWith(role);
      await expect(service.list('w-1', 'u-1')).resolves.toHaveLength(1);
    },
  );

  it('refuses a caller who is not a member at all', async () => {
    const { service, listWithStatus } = serviceWith(undefined);
    await expect(service.list('w-1', 'u-1')).rejects.toMatchObject({
      code: 'AUTHZ_WORKSPACE_FORBIDDEN',
    } satisfies Partial<AppException>);
    expect(listWithStatus).not.toHaveBeenCalled();
  });

  it('asks only for the workspace it was given', async () => {
    const { service, listWithStatus } = serviceWith('Reader');
    await service.list('w-9', 'u-1');
    expect(listWithStatus).toHaveBeenCalledWith('w-9');
  });

  it('carries the ingestion state, so an indexed document is distinguishable', async () => {
    const { service } = serviceWith('Reader');
    const [document] = await service.list('w-1', 'u-1');
    expect(document).toMatchObject({ status: 'indexed', chunkerVersion: 'v1-tokenizer' });
  });

  it('carries the reason a document failed, not merely that it did', async () => {
    const failed = { ...INDEXED, status: 'failed', statusReason: 'ENOENT: no such file' };
    const { service } = serviceWith('Reader', [failed]);
    const [document] = await service.list('w-1', 'u-1');
    expect(document).toMatchObject({ status: 'failed', statusReason: 'ENOENT: no such file' });
  });

  it('returns an empty list for a workspace with no documents', async () => {
    const { service } = serviceWith('Reader', []);
    await expect(service.list('w-1', 'u-1')).resolves.toEqual([]);
  });
});

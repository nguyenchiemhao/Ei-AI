import { describe, expect, it, vi } from 'vitest';
import { DocumentsListingService } from './documents-listing.service';
import type { DocumentListing, DocumentsRepository } from './documents.repository';

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

function serviceWith(listing: DocumentListing[] = [INDEXED]) {
  const listWithStatus = vi.fn().mockResolvedValue(listing);
  return {
    service: new DocumentsListingService({ listWithStatus } as unknown as DocumentsRepository),
    listWithStatus,
  };
}

describe('DocumentsListingService', () => {
  it('asks only for the workspace it was given', async () => {
    const { service, listWithStatus } = serviceWith();
    await service.list('w-9');
    expect(listWithStatus).toHaveBeenCalledWith('w-9');
  });

  it('carries the ingestion state, so an indexed document is distinguishable', async () => {
    const { service } = serviceWith();
    const [document] = await service.list('w-1');
    expect(document).toMatchObject({ status: 'indexed', chunkerVersion: 'v1-tokenizer' });
  });

  it('carries the reason a document failed, not merely that it did', async () => {
    const failed = { ...INDEXED, status: 'failed', statusReason: 'ENOENT: no such file' };
    const { service } = serviceWith([failed]);
    const [document] = await service.list('w-1');
    expect(document).toMatchObject({ status: 'failed', statusReason: 'ENOENT: no such file' });
  });

  it('returns an empty list for a workspace with no documents', async () => {
    const { service } = serviceWith([]);
    await expect(service.list('w-1')).resolves.toEqual([]);
  });
});

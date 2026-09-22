import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { AppException } from '../../common/app-exception';
import type { StoragePort } from '../../ports/storage.port';
import type { DocumentVersionsRepository } from './document-versions.repository';
import type { DocumentRecord, DocumentsRepository } from './documents.repository';
import { DownloadsService } from './downloads.service';
import type { WorkspaceMembersRepository, WorkspaceRole } from './workspace-members.repository';

const DOCUMENT: DocumentRecord = {
  id: 'd-1',
  workspaceId: 'w-1',
  title: 'hợp đồng.csv',
  sourceFilename: 'hợp đồng.csv',
  contentType: 'text/csv',
  currentVersionId: 'v-1',
};

interface Fixture {
  document?: DocumentRecord | null;
  role?: WorkspaceRole | null;
  version?: { id: string; storageKey: string; byteSize: number } | null;
}

function serviceWith({
  document = DOCUMENT,
  role = 'Reader',
  version = { id: 'v-1', storageKey: 'ab/abc', byteSize: 12 },
}: Fixture = {}) {
  const read = vi.fn().mockReturnValue(Readable.from(['x']));
  const documents = {
    findById: vi.fn().mockResolvedValue(document ?? undefined),
  } as unknown as DocumentsRepository;
  const versions = {
    findById: vi.fn().mockResolvedValue(version ?? undefined),
  } as unknown as DocumentVersionsRepository;
  const members = {
    findRole: vi.fn().mockResolvedValue(role ?? undefined),
  } as unknown as WorkspaceMembersRepository;
  return {
    service: new DownloadsService(documents, versions, members, { read } as unknown as StoragePort),
    read,
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
    return expect.unreachable('the service served a download it should have refused');
  } catch (error) {
    return error as AppException;
  }
}

describe('DownloadsService', () => {
  it.each([['Reader'], ['Editor'], ['Owner']] as const)(
    'serves a %s the current version',
    async (role) => {
      const { service, read } = serviceWith({ role });

      const download = await service.current('d-1');

      expect(download).toMatchObject({
        filename: 'hợp đồng.csv',
        contentType: 'text/csv',
        byteSize: 12,
      });
      expect(read).toHaveBeenCalledWith('ab/abc');
    },
  );

  // Membership moved to WorkspaceRoleGuard at T-3.2-06 (`workspace.read`, resolved through the
  // document); the roles are asserted in common/guards/workspace-role.guard.spec.ts.

  it('answers a document that is not there with NOT_FOUND', async () => {
    const { service } = serviceWith({ document: null });

    expect((await rejectionOf(service.current('nope'))).code).toBe('NOT_FOUND');
  });

  it('answers a document with no version yet with NOT_FOUND', async () => {
    const { service } = serviceWith({ document: { ...DOCUMENT, currentVersionId: null } });

    expect((await rejectionOf(service.current('d-1'))).code).toBe('NOT_FOUND');
  });

  it('answers a current version that has vanished with NOT_FOUND, not a broken stream', async () => {
    const { service, read } = serviceWith({ version: null });

    expect((await rejectionOf(service.current('d-1'))).code).toBe('NOT_FOUND');
    expect(read).not.toHaveBeenCalled();
  });

  // The membership check comes before anything is read from storage.
  // The guard refuses before the handler runs, so storage is never reached by someone who may not
  // read — asserted end to end in the authorisation integration suite rather than here, where the
  // service no longer knows who is asking.
  it('does not touch storage for a document that has no version', async () => {
    const { service, read } = serviceWith({ document: { ...DOCUMENT, currentVersionId: null } });

    await rejectionOf(service.current('d-1'));

    expect(read).not.toHaveBeenCalled();
  });
});

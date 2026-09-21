import type { IngestQueue } from '../ingestion/ingest.queue';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { AppException } from '../../common/app-exception';
import type { Database } from '../../database/db';
import type { DocumentVersionsRepository } from './document-versions.repository';
import type { DocumentsRepository } from './documents.repository';
import type { StoragePort } from '../../ports/storage.port';
import { describeSupportedFormats } from './supported-formats';
import { MAX_UPLOAD_BYTES } from './upload-limits';
import { decodeMultipartFilename, UploadService, type UploadedFile } from './upload.service';
import type { WorkspaceMembersRepository, WorkspaceRole } from './workspace-members.repository';

async function incoming(contents = 'nội dung'): Promise<{ file: UploadedFile; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'ei-ai-incoming-'));
  const path = join(dir, 'upload-1');
  await writeFile(path, contents);
  return {
    dir,
    file: {
      originalname: 'hợp đồng.md',
      mimetype: 'text/markdown',
      size: Buffer.byteLength(contents),
      path,
    },
  };
}

const TX = Symbol('tx');

function serviceWith(role: WorkspaceRole | null, versionInsert?: ReturnType<typeof vi.fn>) {
  // The real adapter consumes the stream before `put` resolves; a double that resolves without
  // reading leaves it opening a file `store`'s finally block has already removed, which surfaces
  // as an uncaught ENOENT rather than as a failing test.
  const put = vi.fn(async (source: Readable) => {
    for await (const _chunk of source) {
      void _chunk;
    }
    return { storageKey: 'ab/abc', sha256: 'abc', byteSize: 8 };
  });
  const members = {
    findRole: vi.fn().mockResolvedValue(role ?? undefined),
  } as unknown as WorkspaceMembersRepository;
  const setCurrentVersion = vi.fn().mockResolvedValue(undefined);
  const documents = {
    findByFilename: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue({ id: 'd-1' }),
    setCurrentVersion,
  } as unknown as DocumentsRepository;
  const insert =
    versionInsert ??
    vi.fn().mockResolvedValue({
      id: 'v-1',
      documentId: 'd-1',
      versionNo: 1,
      storageKey: 'ab/abc',
      byteSize: 8,
      sha256: 'abc',
      status: 'uploaded',
    });
  const versions = {
    nextVersionNo: vi.fn().mockResolvedValue(1),
    insert,
  } as unknown as DocumentVersionsRepository;
  const db = {
    transaction: () => ({ execute: (work: (tx: unknown) => unknown) => work(TX) }),
  } as unknown as Database;
  const enqueue = vi.fn().mockResolvedValue('v-1');
  const ingestQueue = { enqueue } as unknown as IngestQueue;
  return {
    service: new UploadService(
      ingestQueue,
      members,
      documents,
      versions,
      { put } as unknown as StoragePort,
      db,
    ),
    put,
    enqueue,
    setCurrentVersion,
    versionInsert: insert,
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
    return expect.unreachable('the service accepted an upload it should have refused');
  } catch (error) {
    return error as AppException;
  }
}

describe('UploadService', () => {
  it.each([['Owner'], ['Editor']] as const)('lets an %s upload', async (role) => {
    const { service, put } = serviceWith(role);
    const { file } = await incoming();

    await expect(service.store('w-1', 'u-1', file)).resolves.toMatchObject({
      documentId: 'd-1',
      versionId: 'v-1',
      versionNo: 1,
      sha256: 'abc',
    });
    expect(put).toHaveBeenCalledOnce();
  });

  it.each([['Reader'], [null]] as const)('refuses %s', async (role) => {
    const { service, put } = serviceWith(role);
    const { file } = await incoming();

    const rejection = await rejectionOf(service.store('w-1', 'u-1', file));

    expect(rejection.code).toBe('AUTHZ_WORKSPACE_FORBIDDEN');
    expect(put).not.toHaveBeenCalled();
  });

  // The byte counter behind the Content-Length check: the header is the client's claim.
  it('refuses a file over the limit and states the limit in the response', async () => {
    const { service, put } = serviceWith('Editor');
    const { file } = await incoming();

    const rejection = await rejectionOf(
      service.store('w-1', 'u-1', { ...file, size: MAX_UPLOAD_BYTES + 1 }),
    );

    expect(rejection.code).toBe('DOC_TOO_LARGE');
    expect(rejection.getStatus()).toBe(413);
    expect(rejection.extensions).toMatchObject({
      limitBytes: MAX_UPLOAD_BYTES,
      receivedBytes: MAX_UPLOAD_BYTES + 1,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('accepts a file of exactly the limit', async () => {
    const { service, put } = serviceWith('Editor');
    const { file } = await incoming();

    await service.store('w-1', 'u-1', { ...file, size: MAX_UPLOAD_BYTES });

    expect(put).toHaveBeenCalledOnce();
  });

  // Whatever happens, multer's temporary file does not survive the request.
  it.each([
    ['Editor', true],
    ['Reader', false],
  ] as const)('removes the incoming file for a %s', async (role, accepted) => {
    const { service } = serviceWith(role);
    const { file, dir } = await incoming();

    await service.store('w-1', 'u-1', file).catch(() => undefined);

    expect(await readdir(dir)).toEqual([]);
    expect(accepted).toBe(role === 'Editor');
  });

  // The "Done when": an .exe and a .zip refused, with the list of what is accepted.
  it.each([['payload.exe'], ['bundle.zip'], ['page.html']])(
    'refuses %s and names the formats it does take',
    async (originalname) => {
      const { service, put } = serviceWith('Editor');
      const { file } = await incoming();

      const rejection = await rejectionOf(service.store('w-1', 'u-1', { ...file, originalname }));

      expect(rejection.code).toBe('DOC_UNSUPPORTED_FORMAT');
      expect(rejection.getStatus()).toBe(415);
      expect(rejection.detail).toContain(describeSupportedFormats());
      expect(rejection.detail).toContain('PDF');
      expect(put).not.toHaveBeenCalled();
    },
  );

  it('checks the format before the size, so an .exe of 300 MB is refused for being an .exe', async () => {
    const { service } = serviceWith('Editor');
    const { file } = await incoming();

    const rejection = await rejectionOf(
      service.store('w-1', 'u-1', {
        ...file,
        originalname: 'payload.exe',
        size: MAX_UPLOAD_BYTES + 1,
      }),
    );

    expect(rejection.code).toBe('DOC_UNSUPPORTED_FORMAT');
  });

  // Proven over HTTP with a real ELF renamed to .pdf; this is the same case in the unit suite,
  // which the coverage report showed had never reached the mismatch branch at all.
  it('refuses bytes that do not match the extension they were given', async () => {
    const { service, put } = serviceWith('Editor');
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]).toString('binary');
    const { file } = await incoming(elf);

    const rejection = await rejectionOf(
      service.store('w-1', 'u-1', { ...file, originalname: 'payload.pdf' }),
    );

    expect(rejection.code).toBe('DOC_CONTENT_MISMATCH');
    expect(rejection.getStatus()).toBe(415);
    expect(rejection.extensions).toMatchObject({ declaredFormat: 'pdf' });
    expect(rejection.detail).toContain('PDF');
    expect(put).not.toHaveBeenCalled();
  });

  it('accepts bytes that do match, so the check is not refusing everything', async () => {
    const { service, put } = serviceWith('Editor');
    const { file } = await incoming('%PDF-1.7\n');

    await service.store('w-1', 'u-1', { ...file, originalname: 'real.pdf' });

    expect(put).toHaveBeenCalledOnce();
  });

  // The "Done when": identical content in the same document is refused *by the constraint*.
  it('turns dv_content_unique into 409 rather than letting a driver error escape', async () => {
    const clash = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'dv_content_unique',
    });
    const { service } = serviceWith('Editor', vi.fn().mockRejectedValue(clash));
    const { file } = await incoming();

    const rejection = await rejectionOf(service.store('w-1', 'u-1', file));

    expect(rejection.code).toBe('DOC_DUPLICATE_CONTENT');
    expect(rejection.getStatus()).toBe(409);
    expect(rejection.extensions).toMatchObject({ documentId: 'd-1', sha256: 'abc' });
  });

  it('does not dress a different unique violation as duplicate content', async () => {
    const other = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'dv_version_unique',
    });
    const { service } = serviceWith('Editor', vi.fn().mockRejectedValue(other));
    const { file } = await incoming();

    await expect(service.store('w-1', 'u-1', file)).rejects.toBe(other);
  });

  it('points the document at the version it just wrote', async () => {
    const { service, setCurrentVersion } = serviceWith('Editor');
    const { file } = await incoming();

    await service.store('w-1', 'u-1', file);

    expect(setCurrentVersion).toHaveBeenCalledWith('d-1', 'v-1', TX);
  });

  it('queues the version it just stored, so the document is ingested', async () => {
    const { service, enqueue } = serviceWith('Editor');
    const { file } = await incoming();

    await service.store('w-1', 'u-1', file);

    expect(enqueue).toHaveBeenCalledWith('v-1');
  });

  it('still stores the upload when the queue is unreachable', async () => {
    // The bytes are written and the row exists, so the document stays at `uploaded` rather than
    // the caller losing a 201 to a Redis that is briefly down.
    const { service, enqueue } = serviceWith('Editor');
    enqueue.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const { file } = await incoming();

    await expect(service.store('w-1', 'u-1', file)).resolves.toMatchObject({ versionId: 'v-1' });
  });

  it('queues only after the version exists, never before', async () => {
    const order: string[] = [];
    const { service, enqueue, setCurrentVersion } = serviceWith('Editor');
    setCurrentVersion.mockImplementation(() => {
      order.push('stored');
      return Promise.resolve();
    });
    enqueue.mockImplementation(() => {
      order.push('queued');
      return Promise.resolve('v-1');
    });
    const { file } = await incoming();

    await service.store('w-1', 'u-1', file);

    expect(order).toEqual(['stored', 'queued']);
  });

  it('does not treat a unique violation with no constraint name as duplicate content', async () => {
    const bare = Object.assign(new Error('duplicate key'), { code: '23505' });
    const { service } = serviceWith('Editor', vi.fn().mockRejectedValue(bare));
    const { file } = await incoming();

    await expect(service.store('w-1', 'u-1', file)).rejects.toBe(bare);
  });

  // Busboy hands over a latin-1 reading of the filename, so a Vietnamese name arrives mangled
  // and was being stored that way — for a product whose documents are Vietnamese, that is every
  // filename.
  it.each([
    ['hợp đồng.csv', 'hợp đồng.csv'],
    ['báo cáo quý 1.pdf', 'báo cáo quý 1.pdf'],
    ['plain-ascii.md', 'plain-ascii.md'],
  ])('reads %s back from the bytes busboy handed over', (original, expected) => {
    const asBusboySeesIt = Buffer.from(original, 'utf8').toString('latin1');

    expect(decodeMultipartFilename(asBusboySeesIt)).toBe(expected);
  });

  it('leaves a pure ASCII name untouched', () => {
    expect(decodeMultipartFilename('notes.md')).toBe('notes.md');
  });
});

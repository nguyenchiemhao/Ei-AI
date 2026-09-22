import type { AuditService } from '../audit/audit.service';
import type { Database } from '../../database/db';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingClient } from '../../adapters/embedding/infinity.client';
import type { Env } from '../../config/env.schema';
import type { StoragePort } from '../../ports/storage.port';
import type { DocumentVersionsRepository } from '../workspaces/document-versions.repository';
import type { DocumentsRepository } from '../workspaces/documents.repository';
import { Chunker } from './chunker';
import type { ChunksRepository } from './chunks.repository';
import { IngestionService } from './ingestion.service';
import type { PagesRepository } from './pages.repository';
import type { TokenCounter } from './token-counter';

const words: TokenCounter = { count: (text) => (text.match(/\S+/g) ?? []).length };

const MARKDOWN = [
  '# Điều 1',
  '',
  'Bên A cam kết giao hàng đúng hạn.',
  '',
  'Bên B thanh toán.',
].join('\n');

function env(): Env {
  return {
    CHUNK_MIN_TOKENS: 2,
    CHUNK_MAX_TOKENS: 6,
    CHUNK_OVERLAP_RATIO: 0.15,
    CHUNK_TOKEN_COUNTER: 'tokenizer',
    CHUNK_CHARS_PER_TOKEN: 3.916,
  } as Env;
}

// `null` means "absent", as in downloads.service.spec.ts: passing `undefined` explicitly would
// select the default below rather than override it.
const TX = Symbol('tx');
// The audit row shares the transaction of the state change, so the double has to be there for the
// service to work at all — and what it collects is what an auditor would read.
const recorded: { action: string; detail?: Record<string, unknown> }[] = [];
const auditDouble = {
  record: vi.fn((record: { action: string; detail?: Record<string, unknown> }) => {
    recorded.push(record);
    return Promise.resolve({});
  }),
} as unknown as AuditService;

interface Fixture {
  filename?: string;
  status?: string;
  version?: object | null;
  document?: object | null;
  contents?: string;
}

function serviceWith({
  filename = 'hợp đồng.md',
  status = 'uploaded',
  version = { id: 'v-1', documentId: 'd-1', storageKey: 'ab/abc', status },
  document = { id: 'd-1', sourceFilename: filename, workspaceId: 'w-1' },
  contents = MARKDOWN,
}: Fixture = {}) {
  const setStatus = vi.fn().mockResolvedValue(undefined);
  const setIndexed = vi.fn().mockResolvedValue(undefined);
  const replacePages = vi.fn().mockResolvedValue(undefined);
  const replaceChunks = vi.fn().mockResolvedValue(undefined);
  const embed = vi.fn((texts: readonly string[]) =>
    Promise.resolve(texts.map((_, i) => Array.from({ length: 4 }, () => i))),
  );
  const read = vi.fn().mockReturnValue(Readable.from([Buffer.from(contents, 'utf8')]));
  recorded.length = 0;
  return {
    service: new IngestionService(
      {
        findById: vi.fn().mockResolvedValue(version ?? undefined),
        setStatus,
        setIndexed,
      } as unknown as DocumentVersionsRepository,
      {
        findById: vi.fn().mockResolvedValue(document ?? undefined),
      } as unknown as DocumentsRepository,
      { replaceAll: replacePages } as unknown as PagesRepository,
      { replaceAll: replaceChunks } as unknown as ChunksRepository,
      new Chunker(words, env()),
      env(),
      auditDouble,
      {
        transaction: () => ({ execute: (work: (tx: unknown) => unknown) => work(TX) }),
      } as unknown as Database,
      { read } as unknown as StoragePort,
      { embed } as unknown as EmbeddingClient,
    ),
    setStatus,
    setIndexed,
    replacePages,
    replaceChunks,
    embed,
    read,
  };
}

describe('IngestionService.ingest', () => {
  it('refuses a version that is not there', async () => {
    const { service } = serviceWith({ version: null });
    await expect(service.ingest('v-1', 'c-1')).rejects.toThrow(/No document version v-1/);
  });

  it('refuses a version whose document is gone', async () => {
    const { service } = serviceWith({ document: null });
    await expect(service.ingest('v-1', 'c-1')).rejects.toThrow(/No document d-1/);
  });

  it('leaves a format the parser owns at uploaded, touching nothing', async () => {
    const { service, setStatus, replacePages } = serviceWith({ filename: 'hợp đồng.pdf' });
    await service.ingest('v-1', 'c-1');
    expect(setStatus).not.toHaveBeenCalled();
    expect(replacePages).not.toHaveBeenCalled();
  });

  it('walks the states in the order the machine allows', async () => {
    const { service, setStatus, setIndexed } = serviceWith();
    await service.ingest('v-1', 'c-1');
    expect(setStatus.mock.calls.map((call) => call[1])).toEqual([
      'parsing',
      'parsed',
      'chunking',
      'embedding',
    ]);
    expect(setIndexed).toHaveBeenCalledWith('v-1', 'v1-tokenizer', TX);
  });

  it('writes one page whose text is the file, byte for byte', async () => {
    const { service, replacePages } = serviceWith();
    await service.ingest('v-1', 'c-1');
    expect(replacePages).toHaveBeenCalledWith('v-1', [
      { pageNo: 1, text: MARKDOWN, extractionMethod: 'markdown' },
    ]);
  });

  it('embeds the text of every chunk, in order', async () => {
    const { service, embed, replaceChunks } = serviceWith();
    await service.ingest('v-1', 'c-1');
    const chunks = replaceChunks.mock.calls[0]![1] as { text: string }[];
    expect(embed).toHaveBeenCalledWith(chunks.map((chunk) => chunk.text));
  });

  it('numbers chunks from one and gives each the vector that matches it', async () => {
    const { service, replaceChunks } = serviceWith();
    await service.ingest('v-1', 'c-1');
    const chunks = replaceChunks.mock.calls[0]![1] as {
      chunkNo: number;
      embedding: number[];
    }[];
    expect(chunks.map((chunk) => chunk.chunkNo)).toEqual(chunks.map((_, i) => i + 1));
    chunks.forEach((chunk, index) => expect(chunk.embedding[0]).toBe(index));
  });

  it('re-ingests a version the machine left at parsing, rather than refusing the retry', async () => {
    const { service, setStatus } = serviceWith({ status: 'parsing' });
    await expect(service.ingest('v-1', 'c-1')).resolves.toBeUndefined();
    expect(setStatus.mock.calls[0]![1]).toBe('parsing');
  });

  it('refuses to re-ingest a version that is already indexed past the restart', async () => {
    const { service } = serviceWith({ status: 'indexed' });
    await expect(service.ingest('v-1', 'c-1')).resolves.toBeUndefined();
  });
});

describe('IngestionService.markFailed', () => {
  // The path a version takes when it fails before anyone could read it: the row is gone, or its
  // document is, and the audit record still has to be written with whatever is known.
  it('records a failure for a version that no longer exists', async () => {
    const { service, setStatus } = serviceWith({ version: null });
    await service.markFailed('v-1', 'ENOENT', 'c-1');
    expect(setStatus).toHaveBeenCalledWith('v-1', 'failed', 'ENOENT', TX);
    expect(recorded[0]).toMatchObject({
      workspaceId: null,
      detail: { from: null, to: 'failed', reason: 'ENOENT' },
    });
  });

  it('records a failure for a version whose document is gone', async () => {
    const { service } = serviceWith({ document: null });
    await service.markFailed('v-1', 'ENOENT', 'c-1');
    expect(recorded[0]).toMatchObject({ workspaceId: null });
  });

  it('records the reason against the version', async () => {
    const { service, setStatus } = serviceWith();
    await service.markFailed('v-1', 'ENOENT: no such file', 'c-1');
    expect(setStatus).toHaveBeenCalledWith('v-1', 'failed', 'ENOENT: no such file', TX);
  });
});

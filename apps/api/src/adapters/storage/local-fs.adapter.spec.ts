import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema';
import { STORAGE_PORT, type StoragePort } from '../../ports/storage.port';
import { LocalFsAdapter } from './local-fs.adapter';

let base: string;
let storage: LocalFsAdapter;

const bytes = (value: string) => Readable.from([Buffer.from(value)]);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function objectFiles(): Promise<string[]> {
  const found: string[] = [];
  for (const shard of await readdir(base, { withFileTypes: true })) {
    if (!shard.isDirectory() || shard.name === 'tmp') {
      continue;
    }
    for (const file of await readdir(join(base, shard.name))) {
      found.push(join(shard.name, file));
    }
  }
  return found;
}

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'ei-ai-storage-'));
  storage = new LocalFsAdapter({ UPLOADS_DIR: base } as Env);
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('LocalFsAdapter', () => {
  it('derives the key from the content, not from a name or a clock', async () => {
    const stored = await storage.put(bytes('hợp đồng số 118'));

    expect(stored.sha256).toBe(sha256('hợp đồng số 118'));
    expect(stored.storageKey).toBe(join(stored.sha256.slice(0, 2), stored.sha256));
    expect(stored.byteSize).toBe(Buffer.byteLength('hợp đồng số 118'));
  });

  // The "Done when": the same bytes twice occupy one file.
  it('writes one file for the same bytes uploaded twice', async () => {
    const first = await storage.put(bytes('the same content'));
    const second = await storage.put(bytes('the same content'));

    expect(second.storageKey).toBe(first.storageKey);
    expect(await objectFiles()).toHaveLength(1);
  });

  it('writes two files for two different contents', async () => {
    await storage.put(bytes('one'));
    await storage.put(bytes('two'));

    expect(await objectFiles()).toHaveLength(2);
  });

  it('leaves no temporary file behind, on a fresh write or on a duplicate', async () => {
    await storage.put(bytes('kept'));
    await storage.put(bytes('kept'));

    await expect(readdir(join(base, 'tmp'))).resolves.toEqual([]);
  });

  it('reads back exactly what was written', async () => {
    const stored = await storage.put(bytes('đọc lại nguyên vẹn'));

    const chunks: Buffer[] = [];
    for await (const chunk of storage.read(stored.storageKey)) {
      chunks.push(chunk as Buffer);
    }

    expect(Buffer.concat(chunks).toString()).toBe('đọc lại nguyên vẹn');
  });

  it('reports what it holds and what it does not', async () => {
    const stored = await storage.put(bytes('present'));

    await expect(storage.exists(stored.storageKey)).resolves.toBe(true);
    await expect(storage.exists('ff/' + 'f'.repeat(64))).resolves.toBe(false);
  });

  it('counts the bytes of a stream that arrives in pieces', async () => {
    const stored = await storage.put(Readable.from([Buffer.from('abc'), Buffer.from('defg')]));

    expect(stored.byteSize).toBe(7);
    expect(stored.sha256).toBe(sha256('abcdefg'));
    expect((await stat(join(base, stored.storageKey))).size).toBe(7);
  });

  // The adapter is only useful if it satisfies the seam; this fails to compile if it drifts.
  it('satisfies StoragePort, and the token every consumer injects is that seam', () => {
    const port: StoragePort = storage;

    expect(typeof STORAGE_PORT).toBe('symbol');
    expect(typeof port.put).toBe('function');
    expect(typeof port.read).toBe('function');
    expect(typeof port.exists).toBe('function');
  });
});

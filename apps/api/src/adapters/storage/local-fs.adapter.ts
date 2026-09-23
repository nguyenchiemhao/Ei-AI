import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Inject, Injectable } from '@nestjs/common';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import type { StoragePort, StoredObject } from '../../ports/storage.port';

interface Tally {
  bytes: number;
}

// Two characters of the digest as a directory, so one folder never holds every object.
function keyFor(sha256: string): string {
  return join(sha256.slice(0, 2), sha256);
}

async function* hashing(
  chunks: AsyncIterable<Buffer>,
  hash: ReturnType<typeof createHash>,
  tally: Tally,
): AsyncGenerator<Buffer> {
  for await (const chunk of chunks) {
    hash.update(chunk);
    tally.bytes += chunk.length;
    yield chunk;
  }
}

@Injectable()
export class LocalFsAdapter implements StoragePort {
  private readonly base: string;

  constructor(@Inject(CONFIG) config: Env) {
    this.base = config.UPLOADS_DIR;
  }

  // The bytes land in a temporary file while being hashed, because the key cannot be known
  // until the last byte has been read. A file already at that key is the same content by
  // definition, so the temporary one is discarded rather than overwriting it.
  async put(source: Readable): Promise<StoredObject> {
    const hash = createHash('sha256');
    const tally: Tally = { bytes: 0 };
    const temp = join(this.base, 'tmp', `${process.pid}-${Date.now()}-${Math.random()}`);

    await mkdir(dirname(temp), { recursive: true });
    await pipeline(source, (chunks) => hashing(chunks, hash, tally), createWriteStream(temp));

    const sha256 = hash.digest('hex');
    const storageKey = keyFor(sha256);
    const target = join(this.base, storageKey);

    if (await this.exists(storageKey)) {
      await rm(temp, { force: true });
      return { storageKey, sha256, byteSize: tally.bytes };
    }
    await mkdir(dirname(target), { recursive: true });
    await rename(temp, target);
    return { storageKey, sha256, byteSize: tally.bytes };
  }

  read(storageKey: string): Readable {
    return createReadStream(join(this.base, storageKey));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      return (await stat(join(this.base, storageKey))).isFile();
    } catch {
      return false;
    }
  }
}

import type { Readable } from 'node:stream';

export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface StoredObject {
  storageKey: string;
  sha256: string;
  byteSize: number;
}

// One of the three seams design §5.4 permits: a local filesystem now, S3 or MinIO if a customer
// already has one. Storage is content-addressed, so the key is derived from the bytes and two
// uploads of the same content cannot occupy two files.
export interface StoragePort {
  put(source: Readable): Promise<StoredObject>;
  read(storageKey: string): Readable;
  exists(storageKey: string): Promise<boolean>;
}

import { describe, expect, it } from 'vitest';
import {
  declaredLengthExceedsLimit,
  describeLimit,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
} from './upload-limits';

describe('upload limits', () => {
  // The same number the document_versions CHECK enforces. If they drift, a file passes the API
  // and is refused by the database.
  it('matches the limit the schema already writes down', () => {
    expect(MAX_UPLOAD_BYTES).toBe(209_715_200);
    expect(MAX_UPLOAD_MB).toBe(200);
  });

  it('states the limit in words a response can carry', () => {
    expect(describeLimit()).toContain('200');
  });

  it.each([
    ['exactly the limit', String(MAX_UPLOAD_BYTES), false],
    ['one byte over', String(MAX_UPLOAD_BYTES + 1), true],
    ['well under', '1024', false],
    ['absent', undefined, false],
    ['not a number', 'chunked', false],
    ['a list, first value used', [String(MAX_UPLOAD_BYTES + 1), '10'], true],
  ])('reads a declared length that is %s', (_name, header, expected) => {
    expect(declaredLengthExceedsLimit(header as string | string[] | undefined)).toBe(expected);
  });
});

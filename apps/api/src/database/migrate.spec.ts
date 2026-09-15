import { describe, expect, it } from 'vitest';
import { assertUnchanged, checksum } from './migrate';

describe('forward-only migrations', () => {
  it('accepts a file that has not been applied yet', () => {
    expect(() => assertUnchanged('001_extensions.sql', 'SELECT 1', new Map())).not.toThrow();
  });

  it('accepts an applied file whose contents still match', () => {
    const sql = 'CREATE TABLE t (id INT)';
    const applied = new Map([['001_extensions.sql', checksum(sql)]]);

    expect(() => assertUnchanged('001_extensions.sql', sql, applied)).not.toThrow();
  });

  it('refuses an applied file that has been edited, naming the file', () => {
    const applied = new Map([['001_extensions.sql', checksum('CREATE TABLE t (id INT)')]]);

    expect(() =>
      assertUnchanged('001_extensions.sql', 'CREATE TABLE t (id BIGINT)', applied),
    ).toThrowError(/001_extensions\.sql has changed/);
  });

  it('treats whitespace as a change, because Postgres would have applied the old text', () => {
    const applied = new Map([['002_identity.sql', checksum('SELECT 1')]]);

    expect(() => assertUnchanged('002_identity.sql', 'SELECT  1', applied)).toThrow();
  });
});

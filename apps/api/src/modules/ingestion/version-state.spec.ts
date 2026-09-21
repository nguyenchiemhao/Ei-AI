import { describe, expect, it } from 'vitest';
import type { VersionStatus } from '../../database/schema';
import { assertTransition, canTransition, INGESTION_STATES } from './version-state';

const ALL: VersionStatus[] = [
  'uploaded',
  'parsing',
  'parsed',
  'chunking',
  'embedding',
  'indexed',
  'failed',
  'quarantined',
  'superseded',
  'purged',
];

describe('the ingestion state machine', () => {
  it('walks the whole pipeline Detail names, in order', () => {
    for (let i = 1; i < INGESTION_STATES.length; i += 1) {
      expect(canTransition(INGESTION_STATES[i - 1]!, INGESTION_STATES[i]!)).toBe(true);
    }
  });

  it('can fail from every state that does work', () => {
    for (const state of INGESTION_STATES.filter((s) => s !== 'indexed')) {
      expect(canTransition(state, 'failed')).toBe(true);
    }
  });

  it('cannot fail out of indexed, because the work is already done', () => {
    expect(canTransition('indexed', 'failed')).toBe(false);
  });

  it('re-ingests a failed version from the start rather than resuming it', () => {
    expect(canTransition('failed', 'parsing')).toBe(true);
    expect(canTransition('failed', 'embedding')).toBe(false);
    expect(canTransition('failed', 'indexed')).toBe(false);
  });

  it('lets a retry re-enter from wherever the attempt that failed left the row', () => {
    // Including parsing itself: an attempt that dies after the first transition leaves the row
    // there, and a retry that cannot re-enter fails on the state machine instead of on the cause.
    for (const from of [...INGESTION_STATES, 'failed' as VersionStatus]) {
      expect(canTransition(from, 'parsing')).toBe(true);
    }
  });

  it('refuses every skip through the pipeline', () => {
    expect(canTransition('uploaded', 'indexed')).toBe(false);
    expect(canTransition('uploaded', 'chunking')).toBe(false);
    expect(canTransition('parsed', 'embedding')).toBe(false);
    expect(canTransition('chunking', 'indexed')).toBe(false);
  });

  it('refuses every step backwards other than a restart', () => {
    expect(canTransition('embedding', 'chunking')).toBe(false);
    expect(canTransition('embedding', 'parsed')).toBe(false);
    expect(canTransition('indexed', 'uploaded')).toBe(false);
    expect(canTransition('indexed', 'embedding')).toBe(false);
  });

  it('never moves into a state ingestion does not own', () => {
    for (const from of ALL) {
      for (const to of ['quarantined', 'superseded', 'purged'] as VersionStatus[]) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it('leads nowhere from a state ingestion does not own', () => {
    for (const from of ['quarantined', 'superseded', 'purged'] as VersionStatus[]) {
      for (const to of ALL) expect(canTransition(from, to)).toBe(false);
    }
  });

  it('refuses an illegal transition with both ends named', () => {
    expect(() => assertTransition('uploaded', 'indexed')).toThrow(
      /cannot move from uploaded to indexed/,
    );
  });

  it('carries the two states as extensions, so a client need not parse the sentence', () => {
    try {
      assertTransition('indexed', 'embedding');
      expect.unreachable('the transition should have been refused');
    } catch (error) {
      expect((error as { extensions: unknown }).extensions).toEqual({
        from: 'indexed',
        to: 'embedding',
      });
    }
  });

  it('permits the legal transition it is asked about', () => {
    expect(() => assertTransition('chunking', 'embedding')).not.toThrow();
  });
});

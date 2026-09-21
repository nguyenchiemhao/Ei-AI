import { describe, expect, it } from 'vitest';
import { failureReason, isFinalAttempt } from './job-attempts';

describe('isFinalAttempt', () => {
  it('is false while the queue still has a retry left', () => {
    expect(isFinalAttempt({ attemptsMade: 1, attempts: 3 })).toBe(false);
    expect(isFinalAttempt({ attemptsMade: 2, attempts: 3 })).toBe(false);
  });

  it('is true on the last attempt', () => {
    expect(isFinalAttempt({ attemptsMade: 3, attempts: 3 })).toBe(true);
  });

  it('is true past the last attempt, which a requeue can produce', () => {
    expect(isFinalAttempt({ attemptsMade: 4, attempts: 3 })).toBe(true);
  });

  it('treats a job configured with no attempts as one attempt, not as infinite', () => {
    expect(isFinalAttempt({ attemptsMade: 1, attempts: 0 })).toBe(true);
  });
});

describe('failureReason', () => {
  it("takes an Error's message", () => {
    expect(failureReason(new Error('Embedding failed after 5 attempts'))).toBe(
      'Embedding failed after 5 attempts',
    );
  });

  it('keeps the first line only, so a stack trace does not land in the column', () => {
    expect(failureReason(new Error('ENOENT: no such file\n    at read (fs.js:1:1)'))).toBe(
      'ENOENT: no such file',
    );
  });

  it('reads something that is not an Error', () => {
    expect(failureReason('socket hang up')).toBe('socket hang up');
  });

  it('says so rather than storing an empty string', () => {
    expect(failureReason(new Error(''))).toBe('Ingestion failed without a message');
  });

  it('says so rather than storing whitespace', () => {
    expect(failureReason(new Error('   \n  '))).toBe('Ingestion failed without a message');
  });

  it('truncates a reason too long for a person to read', () => {
    expect(failureReason(new Error('x'.repeat(900)))).toHaveLength(500);
  });

  it('keeps Vietnamese intact', () => {
    expect(failureReason(new Error('Không đọc được tệp hợp đồng'))).toBe(
      'Không đọc được tệp hợp đồng',
    );
  });
});

import type { VersionStatus } from '../../database/schema';
import { AppException } from '../../common/app-exception';

// Detail §WP-3.4's subset, and only it. `quarantined`, `superseded` and `purged` are in the column
// because other features will write them; ingestion never does, so they are not reachable here.
//
// Every state can restart at `parsing`, including `parsing` itself. A retried job finds the row
// wherever the attempt that failed abandoned it, and refusing to re-enter would make the second
// attempt fail on the state machine rather than on whatever actually broke — which is how a
// missing file came to be recorded as "cannot move from parsing to parsing". A restart is not a
// skip: each stage still runs, and each stage's output replaces the last run's.
const RESTART: VersionStatus = 'parsing';

const FORWARD: Readonly<Record<string, readonly VersionStatus[]>> = {
  uploaded: ['failed'],
  parsing: ['parsed', 'failed'],
  parsed: ['chunking', 'failed'],
  chunking: ['embedding', 'failed'],
  embedding: ['indexed', 'failed'],
  indexed: [],
  failed: [],
};

const NEXT: Readonly<Record<string, readonly VersionStatus[]>> = Object.fromEntries(
  Object.entries(FORWARD).map(([from, to]) => [from, [RESTART, ...to]]),
);

export const INGESTION_STATES: readonly VersionStatus[] = [
  'uploaded',
  'parsing',
  'parsed',
  'chunking',
  'embedding',
  'indexed',
];

export function canTransition(from: VersionStatus, to: VersionStatus): boolean {
  return (NEXT[from] ?? []).includes(to);
}

// Refused rather than logged: a version that reaches `indexed` from `uploaded` without chunking
// is a document the search index has no rows for, and the state would say otherwise.
export function assertTransition(from: VersionStatus, to: VersionStatus): void {
  if (!canTransition(from, to)) {
    throw new AppException(
      'VALIDATION_FAILED',
      `A document version cannot move from ${from} to ${to}`,
      { from, to },
    );
  }
}

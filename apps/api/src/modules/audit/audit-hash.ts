import { createHash } from 'node:crypto';

// Everything the hash covers, and nothing the database decides for itself. `occurred_at` is set
// here rather than by `now()` precisely so the hash can be computed before the insert and
// recomputed from the stored row afterwards — FR-68 needs both to give the same answer.
export interface HashableEvent {
  occurredAt: Date;
  actorUserId: string | null;
  actorIp: string | null;
  action: string;
  objectKind: string;
  objectId: string | null;
  workspaceId: string | null;
  correlationId: string;
  detail: Record<string, unknown>;
}

// ASCII unit separator: it cannot appear in a uuid, an action name or an IP, and JSON escapes it
// inside strings, so no field can end where the next begins.
const SEPARATOR = String.fromCharCode(31);

// Object keys in JavaScript keep insertion order, so `{a:1,b:2}` and `{b:2,a:1}` serialise
// differently while meaning the same thing. Sorting them is what makes a hash recomputed a year
// later match the one stored — a canonical form is the whole reason this is not `JSON.stringify`.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    // Two keys of one object are never equal, so there is no third case to write.
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

export function canonicalise(event: HashableEvent): string {
  return [
    event.occurredAt.toISOString(),
    event.actorUserId ?? '',
    event.actorIp ?? '',
    event.action,
    event.objectKind,
    event.objectId ?? '',
    event.workspaceId ?? '',
    event.correlationId,
    canonicalJson(event.detail),
  ].join(SEPARATOR);
}

// The previous hash is folded in first, so an event's hash depends on everything before it: change
// one row and every hash after it stops matching, which is what makes a deletion detectable too.
export function hashOf(event: HashableEvent, prevHash: Buffer | null): Buffer {
  return createHash('sha256')
    .update(prevHash ?? Buffer.alloc(0))
    .update(canonicalise(event), 'utf8')
    .digest();
}

export { SEPARATOR };

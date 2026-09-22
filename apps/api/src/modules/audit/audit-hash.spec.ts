import { describe, expect, it } from 'vitest';
import { canonicalise, canonicalJson, type HashableEvent, hashOf, SEPARATOR } from './audit-hash';

const AT = new Date('2026-09-21T10:00:00.000Z');

function event(overrides: Partial<HashableEvent> = {}): HashableEvent {
  return {
    occurredAt: AT,
    actorUserId: 'u-1',
    actorIp: '10.0.0.1',
    action: 'workspace.created',
    objectKind: 'workspace',
    objectId: 'w-1',
    workspaceId: 'w-1',
    correlationId: 'c-1',
    detail: { name: 'Hợp đồng' },
    ...overrides,
  };
}

describe('canonicalJson', () => {
  it('sorts keys, so insertion order cannot change the hash', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });

  it('sorts keys at every depth', () => {
    expect(canonicalJson({ x: { d: 1, c: 2 } })).toBe('{"x":{"c":2,"d":1}}');
  });

  it('keeps array order, which is meaning rather than notation', () => {
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it('drops undefined, which JSON cannot carry anyway', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('keeps null, which it can', () => {
    expect(canonicalJson({ a: null })).toBe('{"a":null}');
  });

  it('writes Vietnamese as itself rather than as escapes', () => {
    expect(canonicalJson({ name: 'Hợp đồng' })).toBe('{"name":"Hợp đồng"}');
  });

  it('serialises undefined as null, because a hash cannot be of nothing', () => {
    expect(canonicalJson(undefined)).toBe('null');
  });

  it('serialises a bare value', () => {
    expect(canonicalJson('x')).toBe('"x"');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(7)).toBe('7');
  });
});

describe('canonicalise', () => {
  it('separates the nine fields with a character none of them can contain', () => {
    expect(canonicalise(event()).split(SEPARATOR)).toHaveLength(9);
  });

  it('cannot be confused by a value that ends where the next begins', () => {
    const a = canonicalise(event({ action: 'ab', objectKind: 'c' }));
    const b = canonicalise(event({ action: 'a', objectKind: 'bc' }));
    expect(a).not.toBe(b);
  });

  it('writes an absent actor as empty rather than as the word null', () => {
    expect(canonicalise(event({ actorUserId: null }))).toContain(SEPARATOR + SEPARATOR);
  });

  it.each(['actorUserId', 'actorIp', 'objectId', 'workspaceId'] as const)(
    'writes an absent %s as empty, and differently from the string "null"',
    (field) => {
      const absent = canonicalise(event({ [field]: null }));
      const literal = canonicalise(event({ [field]: 'null' }));
      expect(absent).not.toBe(literal);
      expect(absent.split(SEPARATOR)).toHaveLength(9);
    },
  );
});

describe('hashOf', () => {
  it('is 32 bytes of sha256', () => {
    expect(hashOf(event(), null)).toHaveLength(32);
  });

  it('is reproducible from the same event and the same predecessor', () => {
    expect(hashOf(event(), null)).toEqual(hashOf(event(), null));
  });

  it('changes when any field of the event changes', () => {
    const base = hashOf(event(), null);
    const fields: Partial<HashableEvent>[] = [
      { occurredAt: new Date('2026-09-21T10:00:00.001Z') },
      { actorUserId: 'u-2' },
      { actorIp: '10.0.0.2' },
      { action: 'workspace.archived' },
      { objectKind: 'document' },
      { objectId: 'w-2' },
      { workspaceId: 'w-2' },
      { correlationId: 'c-2' },
      { detail: { name: 'Khác' } },
    ];
    for (const field of fields) expect(hashOf(event(field), null)).not.toEqual(base);
  });

  it('changes when the predecessor changes, which is what chains them', () => {
    const first = hashOf(event(), null);
    expect(hashOf(event({ action: 'x' }), first)).not.toEqual(hashOf(event({ action: 'x' }), null));
  });

  it('is unchanged by reordering the keys of detail', () => {
    const a = hashOf(event({ detail: { a: 1, b: 2 } }), null);
    const b = hashOf(event({ detail: { b: 2, a: 1 } }), null);
    expect(a).toEqual(b);
  });

  it('breaks every later link when an earlier event is altered', () => {
    const first = hashOf(event({ action: 'one' }), null);
    const second = hashOf(event({ action: 'two' }), first);
    const tampered = hashOf(event({ action: 'ONE' }), null);
    expect(hashOf(event({ action: 'two' }), tampered)).not.toEqual(second);
  });
});

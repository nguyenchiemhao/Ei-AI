import { describe, expect, it, vi } from 'vitest';
import { CORRELATION_ID_HEADER, CorrelationIdMiddleware } from './correlation-id.middleware';
import type { RequestLike, ResponseLike } from './http.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function run(headers: Record<string, string | string[] | undefined>) {
  const set = new Map<string, string>();
  const response = { setHeader: (name: string, value: string) => set.set(name, value) };
  const next = vi.fn();

  new CorrelationIdMiddleware().use(
    { url: '/health', headers } as RequestLike,
    response as unknown as ResponseLike,
    next,
  );

  return { id: set.get(CORRELATION_ID_HEADER), next };
}

describe('CorrelationIdMiddleware', () => {
  it('echoes the id the client sent', () => {
    expect(run({ 'x-correlation-id': 'given-by-client' }).id).toBe('given-by-client');
  });

  it('generates one when the client sent none', () => {
    expect(run({}).id).toMatch(UUID);
  });

  it('generates one when the client sent a blank header rather than echoing the blank', () => {
    expect(run({ 'x-correlation-id': '   ' }).id).toMatch(UUID);
  });

  it('always continues the chain', () => {
    expect(run({}).next).toHaveBeenCalledOnce();
  });
});

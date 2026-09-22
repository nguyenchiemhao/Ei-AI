import { describe, expect, it, vi } from 'vitest';
import {
  CORRELATION_ID_HEADER,
  correlationIdOf,
  CorrelationIdMiddleware,
} from './correlation-id.middleware';
import type { CorrelatedRequest, RequestLike, ResponseLike } from './http.types';

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

describe('the id on the request', () => {
  it('is the same one the response carries', () => {
    const request = { url: '/x', headers: {} } as CorrelatedRequest;
    let header = '';
    new CorrelationIdMiddleware().use(
      request,
      {
        setHeader: (_name: string, value: string) => {
          header = value;
        },
      } as unknown as ResponseLike,
      () => {},
    );
    expect(correlationIdOf(request)).toBe(header);
  });

  it('is the id the caller sent, when one was sent', () => {
    const request = {
      url: '/x',
      headers: { 'x-correlation-id': 'cid-from-caller' },
    } as unknown as CorrelatedRequest;
    new CorrelationIdMiddleware().use(
      request,
      { setHeader: () => {} } as unknown as ResponseLike,
      () => {},
    );
    expect(correlationIdOf(request)).toBe('cid-from-caller');
  });

  it('refuses to invent one, because an id that links to nothing is worse than an error', () => {
    expect(() => correlationIdOf({ url: '/x', headers: {} } as CorrelatedRequest)).toThrow(
      /CorrelationIdMiddleware did not run/,
    );
  });
});

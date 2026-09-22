import { describe, expect, it } from 'vitest';
import type { AuthenticatedRequest } from '../../common/http.types';
import { actorOf, anonymousContext } from './audit-context';

function request(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    url: '/workspaces',
    headers: {},
    correlationId: 'c-1',
    ip: '10.0.0.1',
    principal: {
      userId: 'u-1',
      systemRole: 'Member',
      tokenId: 't-1',
      issuedAt: new Date(),
      expiresAt: new Date(),
    },
    ...overrides,
  } as AuthenticatedRequest;
}

describe('actorOf', () => {
  it('takes the actor, the address and the correlation id from the request', () => {
    expect(actorOf(request())).toEqual({
      actorUserId: 'u-1',
      actorIp: '10.0.0.1',
      correlationId: 'c-1',
    });
  });

  it('refuses a request the guard has not authenticated', () => {
    expect(() => actorOf(request({ principal: undefined }))).toThrow();
  });

  it('records no address rather than an empty one when the request has none', () => {
    expect(actorOf(request({ ip: undefined })).actorIp).toBeNull();
  });

  it('refuses a request the middleware did not reach', () => {
    expect(() => actorOf(request({ correlationId: undefined }))).toThrow(
      /CorrelationIdMiddleware did not run/,
    );
  });
});

describe('anonymousContext', () => {
  it('names no actor when nobody has been identified', () => {
    expect(anonymousContext(request({ principal: undefined }))).toMatchObject({
      actorUserId: null,
      actorIp: '10.0.0.1',
      correlationId: 'c-1',
    });
  });

  it('names the actor when a failed action is known to be theirs', () => {
    expect(anonymousContext(request({ principal: undefined }), 'u-9').actorUserId).toBe('u-9');
  });
});

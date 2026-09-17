import { HttpException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppException } from './app-exception';
import { ProblemJsonFilter } from './problem-json.filter';

function hostFor(url = '/auth/login') {
  const headers = new Map<string, string>();
  const sent: { status?: number; body?: Record<string, unknown> } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return response;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    getHeader(name: string) {
      return headers.get(name);
    },
    json(body: unknown) {
      sent.body = body as Record<string, unknown>;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url, headers: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, sent, headers };
}

describe('ProblemJsonFilter', () => {
  let filter: ProblemJsonFilter;

  beforeEach(() => {
    filter = new ProblemJsonFilter();
  });

  it('renders an AppException as RFC 7807 with its code and the status of that code', () => {
    const { host, sent, headers } = hostFor('/auth/login');

    filter.catch(new AppException('AUTH_INVALID_CREDENTIALS', 'no such account'), host);

    expect(sent.status).toBe(401);
    expect(headers.get('Content-Type')).toBe('application/problem+json');
    expect(sent.body).toMatchObject({
      type: 'https://ei-ai.local/errors/auth-invalid-credentials',
      title: 'Email or password is incorrect',
      status: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
      detail: 'no such account',
      instance: '/auth/login',
    });
  });

  it('carries an exception extension into the problem body', () => {
    const { host, sent } = hostFor();

    filter.catch(
      new AppException('VALIDATION_FAILED', 'bad body', { errors: [{ path: 'email' }] }),
      host,
    );

    expect(sent.body?.errors).toEqual([{ path: 'email' }]);
  });

  it('gives a framework 404 the NOT_FOUND code rather than leaving it codeless', () => {
    const { host, sent } = hostFor('/nope');

    filter.catch(new NotFoundException('Cannot GET /nope'), host);

    expect(sent.status).toBe(404);
    expect(sent.body).toMatchObject({ code: 'NOT_FOUND', detail: 'Cannot GET /nope' });
  });

  it('renders an unknown throw as INTERNAL_ERROR and never repeats its message', () => {
    const { host, sent } = hostFor();
    vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

    filter.catch(new Error('relation "users" does not exist'), host);

    expect(sent.status).toBe(500);
    expect(sent.body).toMatchObject({ code: 'INTERNAL_ERROR', detail: 'Unexpected error' });
    expect(JSON.stringify(sent.body)).not.toContain('relation');
  });

  it('logs a server failure with the correlation id the interceptor already set', () => {
    const { host, headers } = hostFor();
    headers.set('X-Correlation-Id', 'cid-1');
    const error = vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

    filter.catch(new HttpException('boom', 503), host);

    expect(error.mock.calls[0]?.[0]).toContain('correlationId=cid-1');
  });

  it('does not log a client failure', () => {
    const { host } = hostFor();
    const error = vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

    filter.catch(new AppException('AUTH_ACCOUNT_LOCKED', 'locked'), host);

    expect(error).not.toHaveBeenCalled();
  });
});

import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { RequestLike, ResponseLike } from './http.types';

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

function incomingCorrelationId(request: RequestLike): string | undefined {
  const raw = request.headers[CORRELATION_ID_HEADER.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

// NFR-18, and design §7.1's "every request". Middleware rather than an interceptor because an
// interceptor never runs for a path the router does not match, which left 404s with no id at
// all. Setting it before the handler also means it survives a throw: the filter renders the
// problem body onto a response that already carries the header.
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestLike, response: ResponseLike, next: () => void): void {
    response.setHeader(CORRELATION_ID_HEADER, incomingCorrelationId(request) ?? randomUUID());
    next();
  }
}

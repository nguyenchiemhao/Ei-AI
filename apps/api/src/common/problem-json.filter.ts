import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { AppException } from './app-exception';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';
import { ERROR_CODES, type ErrorCode } from './error-codes';
import type { RequestLike, ResponseLike } from './http.types';

const TYPE_BASE = 'https://ei-ai.local/errors/';

// Framework exceptions carry a status and no code. Design §7.4 names a code for every failure
// the product raises deliberately; these two are what the router and the body parser raise.
const FRAMEWORK_CODES: Readonly<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  404: 'NOT_FOUND',
};

function typeUriOf(code: ErrorCode): string {
  return `${TYPE_BASE}${code.toLowerCase().replaceAll('_', '-')}`;
}

function codeOf(exception: unknown): ErrorCode {
  if (exception instanceof AppException) {
    return exception.code;
  }
  if (exception instanceof HttpException) {
    return FRAMEWORK_CODES[exception.getStatus()] ?? 'INTERNAL_ERROR';
  }
  return 'INTERNAL_ERROR';
}

// An unknown exception's own message may carry a query, a path or a driver's text, so the
// response says only what the taxonomy says. The stack goes to the log, never to the client.
function detailOf(exception: unknown, code: ErrorCode): string {
  if (exception instanceof AppException) {
    return exception.detail;
  }
  if (exception instanceof HttpException) {
    return exception.message;
  }
  return ERROR_CODES[code].title;
}

@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemJsonFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<ResponseLike>();
    const code = codeOf(exception);
    const { status, title } = ERROR_CODES[code];
    const extensions = exception instanceof AppException ? exception.extensions : {};

    this.logServerFailure(exception, status, response);

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(status).json({
      type: typeUriOf(code),
      title,
      status,
      code,
      detail: detailOf(exception, code),
      instance: http.getRequest<RequestLike>().url,
      ...extensions,
    });
  }

  private logServerFailure(exception: unknown, status: number, response: ResponseLike): void {
    if (status < 500) {
      return;
    }
    const correlationId = String(response.getHeader(CORRELATION_ID_HEADER) ?? 'none');
    this.logger.error(
      `${status} correlationId=${correlationId}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
  }
}

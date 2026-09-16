import { HttpException } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from './error-codes';

// Every deliberate failure in the API is one of these. The status is looked up from the code,
// so a code cannot be raised with two different statuses in two different places.
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly detail: string,
    readonly extensions: Readonly<Record<string, unknown>> = {},
  ) {
    super(detail, ERROR_CODES[code].status);
  }
}

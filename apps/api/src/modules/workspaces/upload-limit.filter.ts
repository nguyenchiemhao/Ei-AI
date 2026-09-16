import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import { ProblemJsonFilter } from '../../common/problem-json.filter';
import { describeLimit, MAX_UPLOAD_BYTES } from './upload-limits';

// Multer aborts an oversized upload with its own English "File too large", which Nest wraps in
// a PayloadTooLargeException. The code that reaches the client would be right and the message
// would not say what the limit is, which is half of what T-3.3-04 asks for.
@Catch(PayloadTooLargeException)
export class UploadLimitFilter extends ProblemJsonFilter implements ExceptionFilter {
  override catch(_exception: unknown, host: ArgumentsHost): void {
    super.catch(
      new AppException('DOC_TOO_LARGE', describeLimit(), { limitBytes: MAX_UPLOAD_BYTES }),
      host,
    );
  }
}

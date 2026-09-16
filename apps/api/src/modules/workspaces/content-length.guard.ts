import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { AppException } from '../../common/app-exception';
import type { RequestLike } from '../../common/http.types';
import { declaredLengthExceedsLimit, describeLimit, MAX_UPLOAD_BYTES } from './upload-limits';

// The cheap half of the limit: a guard runs before the body is parsed, so a request that
// declares more than the maximum is refused without transferring it. What the client declares
// is not what it sends, which is why UploadService counts the bytes that actually arrive.
@Injectable()
export class ContentLengthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (declaredLengthExceedsLimit(request.headers['content-length'])) {
      throw new AppException('DOC_TOO_LARGE', describeLimit(), { limitBytes: MAX_UPLOAD_BYTES });
    }
    return true;
  }
}

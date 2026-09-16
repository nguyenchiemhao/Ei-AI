import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppException } from '../../common/app-exception';
import { ContentLengthGuard } from './content-length.guard';
import { MAX_UPLOAD_BYTES } from './upload-limits';

function contextWith(contentLength?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        url: '/workspaces/w-1/documents',
        headers: contentLength === undefined ? {} : { 'content-length': contentLength },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ContentLengthGuard', () => {
  it('refuses a request that declares more than the limit, before any body is read', () => {
    const guard = new ContentLengthGuard();

    try {
      guard.canActivate(contextWith(String(MAX_UPLOAD_BYTES + 1)));
      expect.unreachable('the guard admitted an oversized declaration');
    } catch (error) {
      const refusal = error as AppException;
      expect(refusal.code).toBe('DOC_TOO_LARGE');
      expect(refusal.getStatus()).toBe(413);
      expect(refusal.extensions).toMatchObject({ limitBytes: MAX_UPLOAD_BYTES });
      expect(refusal.detail).toContain('200');
    }
  });

  it.each([
    ['exactly the limit', String(MAX_UPLOAD_BYTES)],
    ['a small upload', '2048'],
    ['no header at all, as chunked requests send', undefined],
    ['a header that is not a number', 'chunked'],
  ])('admits %s and leaves the decision to the byte counter', (_name, header) => {
    expect(new ContentLengthGuard().canActivate(contextWith(header))).toBe(true);
  });
});

import { PayloadTooLargeException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES } from './upload-limits';
import { UploadLimitFilter } from './upload-limit.filter';

function hostFor() {
  const headers = new Map<string, string>();
  const sent: { status?: number; body?: Record<string, unknown> } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return response;
    },
    setHeader: (name: string, value: string) => headers.set(name, value),
    getHeader: (name: string) => headers.get(name),
    json: (body: unknown) => {
      sent.body = body as Record<string, unknown>;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/workspaces/w-1/documents', headers: {} }),
    }),
  } as unknown as ArgumentsHost;
  return { host, sent };
}

describe('UploadLimitFilter', () => {
  // Multer's own message is "File too large" and says nothing about how large is too large.
  it('replaces the framework message with one that states the limit', () => {
    const { host, sent } = hostFor();

    new UploadLimitFilter().catch(new PayloadTooLargeException('File too large'), host);

    expect(sent.status).toBe(413);
    expect(sent.body).toMatchObject({
      code: 'DOC_TOO_LARGE',
      limitBytes: MAX_UPLOAD_BYTES,
    });
    expect(String(sent.body?.detail)).toContain('200');
    expect(JSON.stringify(sent.body)).not.toContain('File too large');
  });

  it('renders RFC 7807, like every other error in the system', () => {
    const { host, sent } = hostFor();

    new UploadLimitFilter().catch(new PayloadTooLargeException('File too large'), host);

    expect(sent.body).toMatchObject({
      type: 'https://ei-ai.local/errors/doc-too-large',
      status: 413,
      instance: '/workspaces/w-1/documents',
    });
  });
});

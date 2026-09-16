import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppException } from './app-exception';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

describe('ZodValidationPipe', () => {
  it('returns the parsed value when the payload matches', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(pipe.transform({ email: 'a@b.local', password: 'longenough' })).toEqual({
      email: 'a@b.local',
      password: 'longenough',
    });
  });

  it('raises VALIDATION_FAILED and names every offending field', () => {
    const pipe = new ZodValidationPipe(schema);

    try {
      pipe.transform({ email: 'not-an-email', password: 'short' });
      expect.unreachable('the pipe accepted an invalid payload');
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      const raised = error as AppException;
      expect(raised.code).toBe('VALIDATION_FAILED');
      expect(raised.getStatus()).toBe(400);
      expect(raised.extensions.errors).toEqual([
        { path: 'email', message: expect.any(String) },
        { path: 'password', message: expect.any(String) },
      ]);
    }
  });
});

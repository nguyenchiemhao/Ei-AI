import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodError, ZodSchema } from 'zod';
import { AppException } from './app-exception';

function fieldErrors(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

// Validation is a schema at the edge rather than checks scattered through the services behind it.
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new AppException('VALIDATION_FAILED', 'Request payload failed validation', {
      errors: fieldErrors(result.error),
    });
  }
}

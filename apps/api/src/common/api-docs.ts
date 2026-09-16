import type { INestApplication } from '@nestjs/common';
import { ApiBody, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const API_DOCS_PATH = 'docs';

// Request shapes are zod schemas because that is what ZodValidationPipe enforces at runtime.
// Generating the document from the same object means the page cannot describe a contract the
// server does not actually apply.
export function ApiZodBody(schema: ZodSchema): MethodDecorator {
  return ApiBody({ schema: zodToJsonSchema(schema, { target: 'openApi3' }) as SchemaObject });
}

export function mountApiDocs(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Ei-AI')
      .setDescription(
        'Phase 1 surface. Unbuilt endpoints answer 501 with feature and plannedPhase.',
      )
      .setVersion('0.1')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build(),
  );
  // Swagger UI's validator badge defaults to https://validator.swagger.io/validator, which
  // makes the browser hand this API's definition to a third party. On a system whose posture
  // is default-deny egress that is not a default to accept quietly.
  SwaggerModule.setup(API_DOCS_PATH, app, document, {
    swaggerOptions: { validatorUrl: null },
  });
}

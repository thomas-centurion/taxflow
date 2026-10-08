import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

/** On by default except when NODE_ENV=production. SWAGGER_ENABLED=true|false overrides it in any environment. */
export function isSwaggerEnabled(environment: { SWAGGER_ENABLED?: string; NODE_ENV?: string }): boolean {
  const flag = environment.SWAGGER_ENABLED?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return environment.NODE_ENV !== 'production';
}

/** Serves Swagger UI at /api/docs and the OpenAPI JSON at /api/docs-json. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('TaxFlow API')
    .setDescription([
      'REST API of TaxFlow, a tax compliance platform: companies, tax obligations, documents, notifications, automation runs and audit logs.',
      '',
      '**Authentication:** call `POST /api/auth/login`, copy `accessToken`, press **Authorize** and paste it. Every route except login and health requires it.',
      '',
      '**Errors** share one body: `{ statusCode, message, error? }`. Validation errors (400) return `message` as a list. Unexpected failures return `500` with a generic message.',
      '',
      '**Lists** are paginated with `page` (default 1) and `limit` (default 20, max 100) and return `{ data, meta }`.',
    ].join('\n'))
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token returned by POST /api/auth/login.' })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: 'TaxFlow API',
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'method' },
  });
}

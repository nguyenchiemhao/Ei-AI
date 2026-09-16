import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { mountApiDocs } from './common/api-docs';
import { loadConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  if (config.API_DOCS_ENABLED) {
    mountApiDocs(app);
  }
  await app.listen(config.PORT, '0.0.0.0');
}

void bootstrap();

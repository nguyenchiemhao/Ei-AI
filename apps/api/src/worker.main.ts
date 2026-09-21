import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';
import { IngestConsumer } from './modules/ingestion/ingest.consumer';

// The running BullMQ worker holds the event loop open by itself, so this waits only for a signal.
function runUntilShutdown(): Promise<void> {
  return new Promise((resolve) => {
    process.once('SIGTERM', () => resolve());
    process.once('SIGINT', () => resolve());
  });
}

// The worker shares the API image and differs only by entrypoint: it runs the same modules with
// no HTTP listener. Starting the consumer here and nowhere else is what keeps the API a producer.
async function bootstrap(): Promise<void> {
  loadConfig();
  const context = await NestFactory.createApplicationContext(AppModule);
  context.enableShutdownHooks();
  context.get(IngestConsumer).start();
  await runUntilShutdown();
  await context.close();
}

void bootstrap();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

const KEEPALIVE_MS = 60_000;

// Phase 1 registers no queue consumer yet (BullMQ arrives with T-3.4-01), so nothing holds
// the event loop open. A signal handler alone does not: Node exits as soon as the loop is
// empty, and the container looks as though the worker crashed on boot.
function runUntilShutdown(): Promise<void> {
  return new Promise((resolve) => {
    const keepalive = setInterval(() => {}, KEEPALIVE_MS);
    const stop = (): void => {
      clearInterval(keepalive);
      resolve();
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
  });
}

// The worker shares the API image and differs only by entrypoint: it runs the same
// modules with no HTTP listener, so queue consumers boot under the same config.
async function bootstrap(): Promise<void> {
  loadConfig();
  const context = await NestFactory.createApplicationContext(AppModule);
  context.enableShutdownHooks();
  await runUntilShutdown();
  await context.close();
}

void bootstrap();

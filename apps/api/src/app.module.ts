import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { CacheModule } from './adapters/cache/cache.module';
import { StorageModule } from './adapters/storage/storage.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { ProblemJsonFilter } from './common/problem-json.filter';
import { AdminModule } from './modules/admin/admin.module';
import { IdentityModule } from './modules/identity/identity.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

// The edge is wired here rather than in main.ts so a testing module built from AppModule gets
// the same error shape and the same correlation id as the running process does.
@Module({
  imports: [
    ConfigModule,
    CacheModule,
    StorageModule,
    DatabaseModule,
    AdminModule,
    IdentityModule,
    WorkspacesModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ProblemJsonFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware, cookieParser()).forRoutes('{*splat}');
  }
}

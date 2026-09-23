import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { CacheModule } from './adapters/cache/cache.module';
import { EmbeddingModule } from './adapters/embedding/embedding.module';
import { StorageModule } from './adapters/storage/storage.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { ProblemJsonFilter } from './common/problem-json.filter';
import { AdminModule } from './modules/admin/admin.module';
import { AgentModule } from './modules/agent/agent.module';
import { AnsweringModule } from './modules/answering/answering.module';
import { AuditModule } from './modules/audit/audit.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { EgressModule } from './modules/egress/egress.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { IdentityModule } from './modules/identity/identity.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { ModelProviderModule } from './modules/model-provider/model-provider.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { ToolsModule } from './modules/tools/tools.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

// The edge is wired here rather than in main.ts so a testing module built from AppModule gets
// the same error shape and the same correlation id as the running process does.
@Module({
  imports: [
    ConfigModule,
    CacheModule,
    EmbeddingModule,
    StorageModule,
    DatabaseModule,
    AdminModule,
    AuditModule,
    ToolsModule,
    IdentityModule,
    WorkspacesModule,
    IngestionModule,
    RetrievalModule,
    // Detail §7.1's unbuilt modules. Each is a module file and a 501 controller, so the route
    // exists, the guards decide before it runs, and T-5.5-01's contract tests have a subject.
    AgentModule,
    AnsweringModule,
    ConnectorsModule,
    EgressModule,
    EvaluationModule,
    GovernanceModule,
    ModelProviderModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ProblemJsonFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware, cookieParser()).forRoutes('{*splat}');
  }
}

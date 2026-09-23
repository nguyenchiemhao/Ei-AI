import { Global, Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdentityModule } from '../identity/identity.module';
import { McpServersRepository } from './mcp-servers.repository';
import { ToolsController } from './tools.controller';
import { ToolsRepository } from './tools.repository';
import { ToolsService } from './tools.service';

// Global, and exempted from architecture rule 3 alongside audit. Design §5.4 makes the registry
// "the only place that knows which mode the system is running in", so every surface that reports
// the mode — `GET /me` today, the agent turn in 2B — has to reach it, and reaching it through a
// fourth port is the growth §7.1 forbids.
@Global()
@Module({
  imports: [IdentityModule],
  controllers: [ToolsController],
  providers: [RolesGuard, ToolsService, ToolsRepository, McpServersRepository],
  exports: [ToolsService],
})
export class ToolsModule {}

import { Global, Module } from '@nestjs/common';
import { McpServersRepository } from './mcp-servers.repository';
import { ToolsRepository } from './tools.repository';
import { ToolsService } from './tools.service';

// Global, and exempted from architecture rule 3 alongside audit. Design §5.4 makes the registry
// "the only place that knows which mode the system is running in", so every surface that reports
// the mode — `GET /me` today, the agent turn in 2B — has to reach it, and reaching it through a
// fourth port is the growth §7.1 forbids.
@Global()
@Module({
  providers: [ToolsService, ToolsRepository, McpServersRepository],
  exports: [ToolsService],
})
export class ToolsModule {}

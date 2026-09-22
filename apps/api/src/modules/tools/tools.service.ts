import { type SystemRole, TOOL_ENABLED_FLAG, type ToolName } from '@ei-ai/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { CONFIG } from '../../config/config.module';
import type { Env } from '../../config/env.schema';
import { McpServersRepository } from './mcp-servers.repository';
import { operatingModeOf, type OperatingModeReport } from './operating-mode';
import { ToolsRepository, type ToolView } from './tools.repository';

@Injectable()
export class ToolsService {
  constructor(
    private readonly tools: ToolsRepository,
    private readonly mcpServers: McpServersRepository,
    @Inject(CONFIG) private readonly config: Env,
  ) {}

  async catalogueFor(role: SystemRole): Promise<ToolView[]> {
    const permitted = await this.tools.listEnabledFor(role);
    return permitted.filter((tool) => this.permittedByConfig(tool.name));
  }

  // Recomputed per request rather than cached: FR-80 requires a server added while running to be
  // visible on the next turn without a restart, and a cache is how that stops being true.
  async operatingMode(): Promise<OperatingModeReport> {
    const enabled = await this.tools.listEnabled();
    return operatingModeOf({
      available: enabled.filter((tool) => this.permittedByConfig(tool.name)),
      mcpServerCount: await this.mcpServers.count(),
    });
  }

  // The second half of the two-source rule decided at the plan: the row says enabled and the
  // variable must agree. A tool with no variable of its own — anything discovered over MCP — is
  // governed by its row alone, because there is no flag to name it.
  private permittedByConfig(name: string): boolean {
    const flag = TOOL_ENABLED_FLAG[name as ToolName] as keyof Env | undefined;
    return flag === undefined || this.config[flag] === true;
  }
}

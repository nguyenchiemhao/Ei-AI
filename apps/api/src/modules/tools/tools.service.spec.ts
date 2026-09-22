import { TOOL_NAMES } from '@ei-ai/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema';
import type { McpServersRepository } from './mcp-servers.repository';
import type { ToolsRepository, ToolView } from './tools.repository';
import { ToolsService } from './tools.service';

const tool = (name: string, mcpServerId: string | null = null): ToolView => ({
  id: `id-${name}`,
  name,
  description: name,
  classification: 'read',
  minSystemRole: 'Member',
  mcpServerId,
});

interface Fixture {
  enabled?: ToolView[];
  mcpServerCount?: number;
  flags?: Partial<Env>;
}

// Every flag is named on every call. A fixture that left one out would take the schema default,
// which is `true` for three of the four, and a test about withholding a tool would silently be
// a test about granting it.
const ALL_ON: Partial<Env> = {
  TOOL_SEARCH_DOCUMENTS_ENABLED: true,
  TOOL_READ_DOCUMENT_PAGE_ENABLED: true,
  TOOL_LIST_WORKSPACE_DOCUMENTS_ENABLED: true,
  TOOL_WEB_SEARCH_ENABLED: true,
};

function serviceWith({
  enabled = [tool(TOOL_NAMES.SEARCH_DOCUMENTS)],
  mcpServerCount = 0,
  flags = ALL_ON,
}: Fixture = {}) {
  const tools = {
    listEnabled: vi.fn().mockResolvedValue(enabled),
    listEnabledFor: vi.fn().mockResolvedValue(enabled),
  } as unknown as ToolsRepository;
  const mcpServers = {
    count: vi.fn().mockResolvedValue(mcpServerCount),
  } as unknown as McpServersRepository;
  return new ToolsService(tools, mcpServers, flags as Env);
}

describe('ToolsService, where the row and the variable must agree', () => {
  it('offers a tool whose row is enabled and whose variable is true', async () => {
    const service = serviceWith();

    expect((await service.catalogueFor('Member')).map((t) => t.name)).toEqual([
      TOOL_NAMES.SEARCH_DOCUMENTS,
    ]);
  });

  it('withholds a tool whose variable is false, however the row reads', async () => {
    const service = serviceWith({
      enabled: [tool(TOOL_NAMES.SEARCH_DOCUMENTS)],
      flags: { ...ALL_ON, TOOL_SEARCH_DOCUMENTS_ENABLED: false },
    });

    expect(await service.catalogueFor('Member')).toEqual([]);
  });

  // Nothing names a discovered tool in the environment, so its row is the whole decision. Were
  // this the other way round, registering an MCP server would produce tools nobody can enable.
  it('governs a tool discovered over MCP by its row alone', async () => {
    const service = serviceWith({
      enabled: [tool('erp.read_invoice', 's-1')],
      mcpServerCount: 1,
    });

    expect((await service.catalogueFor('Member')).map((t) => t.name)).toEqual(['erp.read_invoice']);
  });

  it('computes document-only with no server and web search off', async () => {
    const service = serviceWith({ flags: { ...ALL_ON, TOOL_WEB_SEARCH_ENABLED: false } });

    expect(await service.operatingMode()).toMatchObject({ operatingMode: 'document-only' });
  });

  // The variable permits a tool; it does not create one. There is no `web_search` row until 2B
  // builds it, so an operator who sets the flag today changes nothing — and the mode must say so
  // rather than promising a capability the agent would then not find.
  it('stays document-only when web search is permitted but no such tool exists', async () => {
    const service = serviceWith({ flags: ALL_ON });

    expect(await service.operatingMode()).toMatchObject({
      operatingMode: 'document-only',
      toolGroups: { web: 'off' },
    });
  });

  it('asks the database each time rather than caching, so FR-80 holds', async () => {
    const service = serviceWith();

    await service.operatingMode();
    await service.operatingMode();

    expect((service as unknown as { mcpServers: McpServersRepository }).mcpServers.count).
      toHaveBeenCalledTimes(2);
  });
});

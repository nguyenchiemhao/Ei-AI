import {
  type OperatingMode,
  TOOL_NAMES,
  type ToolGroups,
  type ToolGroupStatus,
} from '@ei-ai/shared-types';

export interface AvailableTool {
  name: string;
  mcpServerId: string | null;
}

export interface RegistryState {
  available: readonly AvailableTool[];
  mcpServerCount: number;
}

export interface OperatingModeReport {
  operatingMode: OperatingMode;
  toolGroups: ToolGroups;
}

const onIf = (present: boolean): ToolGroupStatus => (present ? 'on' : 'off');

// FR-78. Zero registered servers is the default installation, and it must read `not_configured`
// so no alert fires; a registered server with no enabled tool is `off`, which is a decision
// somebody made rather than a state of the world. Reachability is not probed here — the MCP client
// is the connectors module, milestone 3A — so a registered server counts as configured.
function erpStatus(state: RegistryState): ToolGroupStatus {
  if (state.mcpServerCount === 0) return 'not_configured';
  return onIf(state.available.some((tool) => tool.mcpServerId !== null));
}

// The mode is derived, never stored and never configured: design §5.4 makes the registry the only
// place that knows it, so this function is the only place that decides it.
export function operatingModeOf(state: RegistryState): OperatingModeReport {
  const has = (name: string) => state.available.some((tool) => tool.name === name);
  const toolGroups: ToolGroups = {
    documents: onIf(has(TOOL_NAMES.SEARCH_DOCUMENTS)),
    web: onIf(has(TOOL_NAMES.WEB_SEARCH)),
    erp: erpStatus(state),
  };
  return { operatingMode: modeOf(toolGroups), toolGroups };
}

function modeOf(groups: ToolGroups): OperatingMode {
  if (groups.erp === 'on') return 'document+web+erp';
  if (groups.web === 'on') return 'document+web';
  return 'document-only';
}

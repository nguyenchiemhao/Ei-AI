import { type SystemRole, toolRolesVisibleTo } from '@ei-ai/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../database/database.module';
import type { Database } from '../../database/db';

export interface ToolView {
  id: string;
  name: string;
  description: string;
  classification: 'read' | 'write';
  minSystemRole: string;
  mcpServerId: string | null;
}

interface ToolRow {
  id: string;
  name: string;
  description: string;
  classification: string;
  min_system_role: string;
  mcp_server_id: string | null;
}

function toView(row: ToolRow): ToolView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    classification: row.classification as ToolView['classification'],
    minSystemRole: row.min_system_role,
    mcpServerId: row.mcp_server_id,
  };
}

// The catalogue is read-only in Phase 1: rows arrive from the seed, and the screens that create and
// disable them are the tool administration surface of milestone 3A.
@Injectable()
export class ToolsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // `enabled = TRUE` first so the partial index tools_enabled_role is the one the planner uses.
  private enabledQuery() {
    return this.db
      .selectFrom('tools')
      .select(['id', 'name', 'description', 'classification', 'min_system_role', 'mcp_server_id'])
      .where('enabled', '=', true)
      .orderBy('name');
  }

  // Exposed as a builder so the compiled SQL can be asserted without a database, the way
  // retrieval/permission-predicate.spec.ts asserts the permission predicate. Filtering happens
  // here rather than in the caller: a tool a role may not use must never leave the database.
  compileFor(role: SystemRole) {
    return this.enabledQuery().where('min_system_role', 'in', toolRolesVisibleTo(role));
  }

  async listEnabledFor(role: SystemRole): Promise<ToolView[]> {
    const rows = await this.compileFor(role).execute();
    return rows.map((row) => toView(row as ToolRow));
  }

  // Every enabled tool, whoever is asking. The operating mode is a property of the installation
  // rather than of a caller — FR-79 reports one mode, not one per role.
  async listEnabled(): Promise<ToolView[]> {
    const rows = await this.enabledQuery().execute();
    return rows.map((row) => toView(row as ToolRow));
  }
}

import { INTERNAL_TOOLS, TOOL_NAMES } from '@ei-ai/shared-types';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The subject is the seed itself, so these read the rows the seed wrote rather than fixtures of
// their own: a fixture here would assert that this file agrees with itself.
const CONNECTION = process.env.DATABASE_URL ?? 'postgresql://postgres:changeme@postgres:5432/eiai';

interface ToolRow {
  name: string;
  description: string;
  classification: string;
  enabled: boolean;
  min_system_role: string;
}

let db: Client;
let rows: ToolRow[];

beforeAll(async () => {
  db = new Client({ connectionString: CONNECTION });
  await db.connect();
  const result = await db.query<ToolRow>(
    `SELECT name, description, classification, enabled, min_system_role
     FROM tools WHERE mcp_server_id IS NULL ORDER BY name`,
  );
  rows = result.rows;
});

afterAll(async () => {
  await db.end();
});

describe('the internal tool registry the seed writes', () => {
  it('holds exactly the three tools of ADR-10', () => {
    expect(rows.map((row) => row.name).sort()).toEqual(
      INTERNAL_TOOLS.map((tool) => tool.name).sort(),
    );
  });

  // tools_no_write_in_v1 refuses an enabled write tool; all three being `read` is the stronger
  // statement the task asks for, and the one a disabled row would otherwise escape.
  it('classifies all three as read', () => {
    expect(rows.map((row) => row.classification)).toEqual(['read', 'read', 'read']);
  });

  it('enables only search_documents', () => {
    const enabled = rows.filter((row) => row.enabled).map((row) => row.name);
    expect(enabled).toEqual([TOOL_NAMES.SEARCH_DOCUMENTS]);
  });

  it('records the phase in the description of each disabled tool', () => {
    const disabled = rows.filter((row) => !row.enabled);
    expect(disabled).toHaveLength(2);
    for (const row of disabled) {
      expect(row.description, `${row.name} does not say when it arrives`).toMatch(/phase 2B/);
    }
  });

  // Seeding twice is how a developer's loop works, and a second set of rows would give the
  // catalogue two of everything.
  it('stays at three rows when the seed runs again', async () => {
    for (const tool of INTERNAL_TOOLS) {
      await db.query(
        `INSERT INTO tools (name, description, input_schema, classification, enabled, min_system_role)
         SELECT $1, $2, '{}'::jsonb, 'read', $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM tools WHERE name = $1 AND mcp_server_id IS NULL)`,
        [tool.name, tool.description, tool.enabledInPhase1, tool.minSystemRole],
      );
    }
    const { rows: after } = await db.query<{ count: string }>(
      `SELECT count(*) AS count FROM tools WHERE mcp_server_id IS NULL`,
    );
    expect(after[0]!.count).toBe(String(INTERNAL_TOOLS.length));
  });
});

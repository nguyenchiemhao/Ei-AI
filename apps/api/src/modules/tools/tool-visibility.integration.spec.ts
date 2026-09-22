import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../../database/db';
import { ToolsRepository } from './tools.repository';

// The seeded catalogue has no Administrator-only tool, so borrowing it would prove nothing: the
// row the filter must hide is built here, and removed again.
const CONNECTION = process.env.DATABASE_URL ?? 'postgresql://postgres:changeme@postgres:5432/eiai';
const ADMIN_ONLY = 'zz_admin_only_fixture';

let db: Database;
let repository: ToolsRepository;

beforeAll(async () => {
  db = createDatabase(CONNECTION);
  repository = new ToolsRepository(db);
  await db
    .insertInto('tools')
    .values({
      name: ADMIN_ONLY,
      description: 'Fixture for T-3.5-02; removed by this suite',
      input_schema: JSON.stringify({ type: 'object' }),
      classification: 'read',
      enabled: true,
      min_system_role: 'Administrator',
    })
    .execute();
});

afterAll(async () => {
  await db.deleteFrom('tools').where('name', '=', ADMIN_ONLY).execute();
  await db.destroy();
});

const namesFor = async (role: Parameters<ToolsRepository['listEnabledFor']>[0]) =>
  (await repository.listEnabledFor(role)).map((tool) => tool.name);

describe('role filtering of the tool catalogue, against the database', () => {
  it('shows the Administrator-only tool to an Administrator', async () => {
    expect(await namesFor('Administrator')).toContain(ADMIN_ONLY);
  });

  it('omits it from a Member catalogue', async () => {
    expect(await namesFor('Member')).not.toContain(ADMIN_ONLY);
  });

  // Without this the previous assertion would also pass against a catalogue that is simply empty,
  // which is how a filter with the wrong comparison direction hides.
  it('still shows a Member the tool their own role reaches', async () => {
    expect(await namesFor('Member')).toContain('search_documents');
  });

  it('gives an Auditor nothing at all', async () => {
    expect(await namesFor('Auditor')).toEqual([]);
  });
});

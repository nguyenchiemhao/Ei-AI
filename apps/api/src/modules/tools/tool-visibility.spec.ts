import { SYSTEM_ROLES, type SystemRole } from '@ei-ai/shared-types';
import { describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../../database/db';
import { ToolsRepository } from './tools.repository';

// Compiled, never run: T-3.5-02 closes on the filtering happening *at the SQL level*, and a result
// set filtered in JavaScript afterwards looks identical from the outside. `pg` opens no connection
// until a query executes, so this needs no database.
const db: Database = createDatabase('postgresql://unused@unused:5432/unused');
const repository = new ToolsRepository(db);

function compiled(role: SystemRole) {
  return repository.compileFor(role).compile();
}

const flattened = (role: SystemRole): string => compiled(role).sql.replace(/\s+/g, ' ');

// The `enabled = TRUE` predicate binds a boolean; everything else the query sends is a role.
const rolesIn = (role: SystemRole): unknown[] =>
  compiled(role).parameters.filter((value) => typeof value === 'string');

describe('the compiled tool catalogue query', () => {
  it('restricts by min_system_role in the query, not after it', () => {
    expect(flattened('Member')).toMatch(/"min_system_role" in \(/);
  });

  it('keeps the enabled predicate, so the partial index still applies', () => {
    expect(flattened('Member')).toContain('"enabled" = ');
  });

  it('binds the roles as parameters rather than interpolating them', () => {
    expect(compiled('Member').parameters).toEqual(expect.arrayContaining(['Member', 'Auditor']));
  });

  // The control, and it is written as an equality rather than three absences on purpose: deleting
  // the filter altogether leaves no roles in the parameters at all, and `not.toContain` is then
  // green against a query that returns every tool there is. The set has to be named to be checked.
  it.each([
    ['Administrator', [...SYSTEM_ROLES]],
    ['Knowledge Manager', ['Knowledge Manager', 'Approver', 'Member', 'Auditor']],
    ['Member', ['Member', 'Auditor']],
    ['Auditor', ['Auditor']],
  ] as const)('sends exactly the roles %s outranks', (role, expected) => {
    expect(rolesIn(role)).toEqual([...expected]);
  });

  it('widens strictly as the role rises', () => {
    const widths = SYSTEM_ROLES.map((role) => rolesIn(role).length);
    expect(widths).toEqual([5, 4, 3, 2, 1]);
  });
});

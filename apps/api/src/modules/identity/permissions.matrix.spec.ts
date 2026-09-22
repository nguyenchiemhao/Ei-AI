import {
  mayUseSystemAction,
  mayUseWorkspaceAction,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
  type SystemRole,
  WORKSPACE_PERMISSIONS,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from '@ei-ai/shared-types';
import { describe, expect, it } from 'vitest';

// T-3.2-05. The cases are generated from the table, never listed here: adding a row to design §9.1
// and copying it into `shared-types` adds five assertions without anyone editing this file, and
// forgetting to decide a role for it fails them.
//
// Design §9.1, transcribed once for this suite alone. The table under test must agree with it, so
// it is written out here rather than imported — a test that reads its expectations from the thing
// it is testing asserts that the file equals itself.
const EXPECTED: Record<string, readonly SystemRole[]> = {
  'question.ask': ['Administrator', 'Knowledge Manager', 'Approver', 'Member'],
  'turn.read-own-steps': ['Administrator', 'Knowledge Manager', 'Approver', 'Member'],
  'workspace.manage': ['Administrator', 'Knowledge Manager'],
  'document.manage': ['Administrator', 'Knowledge Manager'],
  'document.purge': ['Administrator'],
  'approval.decide': ['Administrator', 'Approver'],
  'tool.manage': ['Administrator'],
  'mcp-server.register': ['Administrator'],
  'egress.manage': ['Administrator'],
  'user.manage': ['Administrator'],
  'audit.read': ['Administrator', 'Auditor'],
  'evaluation.run': ['Administrator'],
  'backup.manage': ['Administrator'],
};

const EXPECTED_WORKSPACE: Record<string, readonly WorkspaceRole[]> = {
  'workspace.read': ['Owner', 'Editor', 'Reader'],
  'workspace.documents': ['Owner', 'Editor'],
  'workspace.settings': ['Owner'],
  'workspace.members': ['Owner'],
};

describe('the matrix has the shape Detail counted', () => {
  it('carries the thirteen system actions of design §9.1', () => {
    expect(SYSTEM_PERMISSIONS).toHaveLength(13);
  });

  it('carries the four workspace actions', () => {
    expect(WORKSPACE_PERMISSIONS).toHaveLength(4);
  });

  it('comes to seventy-seven cases', () => {
    const cases =
      SYSTEM_PERMISSIONS.length * SYSTEM_ROLES.length +
      WORKSPACE_PERMISSIONS.length * WORKSPACE_ROLES.length;
    expect(cases).toBe(77);
  });

  it('names every system action design §9.1 names, and no others', () => {
    expect(SYSTEM_PERMISSIONS.map((entry) => entry.action).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  // The rule that makes the table the only place the matrix lives: a row must say where it is
  // enforced today or which phase brings it. The type refuses a row with neither, so this is the
  // assertion that the type was not widened to let one through.
  it('gives every row a route or a phase', () => {
    for (const entry of [...SYSTEM_PERMISSIONS, ...WORKSPACE_PERMISSIONS]) {
      const hasRoute = 'route' in entry && typeof entry.route === 'string';
      const hasPhase = 'phase' in entry && typeof entry.phase === 'string';
      expect(hasRoute || hasPhase, `${entry.action} has neither a route nor a phase`).toBe(true);
    }
  });

  it('gives no row both, so nobody has to ask which one applies', () => {
    for (const entry of [...SYSTEM_PERMISSIONS, ...WORKSPACE_PERMISSIONS]) {
      const both = 'route' in entry && 'phase' in entry && entry.route && entry.phase;
      expect(both, `${entry.action} has a route and a phase`).toBeFalsy();
    }
  });
});

// 65 cases: every system action against every system role.
describe.each(SYSTEM_PERMISSIONS.map((entry) => entry.action))('system action %s', (action) => {
  it.each(SYSTEM_ROLES)('decides %s', (role) => {
    const permitted = EXPECTED[action];
    expect(permitted, `design §9.1 has no row for ${action}`).toBeDefined();
    expect(mayUseSystemAction(role, action)).toBe(permitted!.includes(role));
  });
});

// 12 cases: every workspace action against every workspace role.
describe.each(WORKSPACE_PERMISSIONS.map((entry) => entry.action))(
  'workspace action %s',
  (action) => {
    it.each(WORKSPACE_ROLES)('decides %s', (role) => {
      const permitted = EXPECTED_WORKSPACE[action];
      expect(permitted, `no expectation for ${action}`).toBeDefined();
      expect(mayUseWorkspaceAction(role, action)).toBe(permitted!.includes(role));
    });
  },
);

describe('the lookup itself', () => {
  it('refuses an action nobody has written down', () => {
    expect(() => mayUseSystemAction('Administrator', 'nonsense' as never)).toThrow(
      /No system permission named nonsense/,
    );
  });

  it('refuses a workspace action nobody has written down', () => {
    expect(() => mayUseWorkspaceAction('Owner', 'nonsense' as never)).toThrow(
      /No workspace permission named nonsense/,
    );
  });

  it('refuses a role that is not one of the five', () => {
    expect(mayUseSystemAction('Wizard', 'question.ask')).toBe(false);
  });
});

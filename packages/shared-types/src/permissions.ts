// Design §9.1's matrix, and the only place it is written down. The guards read it, the matrix test
// generates its cases from it, and the web app will read it to decide what to offer — so a role
// that may not do something stops being a claim in three files and becomes one row here.
//
// Every row names either the route that enforces it today or the phase it arrives in. That is not
// bookkeeping: ten of the thirteen system actions belong to features Phase 1 does not build, and a
// row with neither a route nor a phase is a permission nobody has decided where to put. The type
// below refuses it, so the build fails rather than a test.

export const SYSTEM_ROLES = [
  'Administrator',
  'Knowledge Manager',
  'Approver',
  'Member',
  'Auditor',
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const WORKSPACE_ROLES = ['Owner', 'Editor', 'Reader'] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

interface Permission<TRole> {
  action: string;
  roles: readonly TRole[];
}

/** Enforced by a route that exists today. */
interface Enforced<TRole> extends Permission<TRole> {
  route: string;
  phase?: never;
}

/** Decided now, enforced when the feature arrives. */
interface Planned<TRole> extends Permission<TRole> {
  phase: string;
  route?: never;
}

export type SystemPermission = Enforced<SystemRole> | Planned<SystemRole>;
export type WorkspacePermission = Enforced<WorkspaceRole> | Planned<WorkspaceRole>;

// The thirteen rows of §9.1, in its order. `question.ask` is served in Phase 1 by `POST /search` —
// the stand-in for the `search_documents` tool that milestone 2B's agent turn will wrap.
export const SYSTEM_PERMISSIONS = [
  {
    action: 'question.ask',
    roles: ['Administrator', 'Knowledge Manager', 'Approver', 'Member'],
    route: 'POST /search',
  },
  {
    action: 'turn.read-own-steps',
    roles: ['Administrator', 'Knowledge Manager', 'Approver', 'Member'],
    phase: '2B',
  },
  {
    action: 'workspace.manage',
    roles: ['Administrator', 'Knowledge Manager'],
    route: 'POST /workspaces',
  },
  {
    action: 'document.manage',
    roles: ['Administrator', 'Knowledge Manager'],
    route: 'POST /workspaces/:id/documents',
  },
  { action: 'document.purge', roles: ['Administrator'], phase: '2A' },
  { action: 'approval.decide', roles: ['Administrator', 'Approver'], phase: '3B' },
  { action: 'tool.manage', roles: ['Administrator'], phase: '3A' },
  { action: 'mcp-server.register', roles: ['Administrator'], phase: '3A' },
  // Phase 1's own debt rather than a later phase: `T-2.2-05` is the task WP-2.2 closed without.
  { action: 'egress.manage', roles: ['Administrator'], phase: 'T-2.2-05' },
  { action: 'user.manage', roles: ['Administrator'], phase: '4A' },
  { action: 'audit.read', roles: ['Administrator', 'Auditor'], phase: '2D' },
  { action: 'evaluation.run', roles: ['Administrator'], phase: '2D' },
  { action: 'backup.manage', roles: ['Administrator'], phase: '4A' },
] as const satisfies readonly SystemPermission[];

// §9.1 gives the three workspace roles one sentence each and no actions — Owner "manages members
// and documents", Editor "manages documents", Reader "read only". These four are that sentence read
// against the surface that exists, and they belong back in §9.1 rather than only here.
export const WORKSPACE_PERMISSIONS = [
  {
    action: 'workspace.read',
    roles: ['Owner', 'Editor', 'Reader'],
    route: 'GET /workspaces/:id',
  },
  {
    action: 'workspace.documents',
    roles: ['Owner', 'Editor'],
    route: 'POST /workspaces/:id/documents',
  },
  { action: 'workspace.settings', roles: ['Owner'], route: 'PATCH /workspaces/:id' },
  { action: 'workspace.members', roles: ['Owner'], route: 'POST /workspaces/:id/members' },
] as const satisfies readonly WorkspacePermission[];

export type SystemAction = (typeof SYSTEM_PERMISSIONS)[number]['action'];
export type WorkspaceAction = (typeof WORKSPACE_PERMISSIONS)[number]['action'];

export function systemRolesFor(action: SystemAction): readonly SystemRole[] {
  const permission = SYSTEM_PERMISSIONS.find((entry) => entry.action === action);
  if (permission === undefined) throw new Error(`No system permission named ${action}`);
  return permission.roles;
}

export function workspaceRolesFor(action: WorkspaceAction): readonly WorkspaceRole[] {
  const permission = WORKSPACE_PERMISSIONS.find((entry) => entry.action === action);
  if (permission === undefined) throw new Error(`No workspace permission named ${action}`);
  return permission.roles;
}

export function mayUseSystemAction(role: string, action: SystemAction): boolean {
  return (systemRolesFor(action) as readonly string[]).includes(role);
}

export function mayUseWorkspaceAction(role: string, action: WorkspaceAction): boolean {
  return (workspaceRolesFor(action) as readonly string[]).includes(role);
}

// `tools.min_system_role` stores a single "minimum role", which only means something if the roles
// form a chain — and §9.1's matrix above is not one: an Auditor reads the audit log a Knowledge
// Manager may not, and a Knowledge Manager manages workspaces an Auditor may not. So this order is
// declared here, beside the matrix, and it governs **which tools a role is offered and nothing
// else**. The matrix stays the authority on what a role may do.
export const SYSTEM_ROLE_RANK = {
  Administrator: 0,
  'Knowledge Manager': 1,
  Approver: 2,
  Member: 3,
  Auditor: 4,
} as const satisfies Record<SystemRole, number>;

// The roles a caller outranks or equals — the set their catalogue may draw from. The Auditor is
// last, so their catalogue is empty, which is §9.1's dash under "Ask a question" seen from here.
export function toolRolesVisibleTo(role: SystemRole): SystemRole[] {
  return SYSTEM_ROLES.filter((other) => SYSTEM_ROLE_RANK[other] >= SYSTEM_ROLE_RANK[role]);
}

// The audit event taxonomy of FR-66, as constants rather than string literals at call sites: a
// typo in a literal produces an event nobody can search for, and an auditor cannot tell a missing
// event from a misspelt one. Shared because `apps/web` will render these names in the audit log
// (FR-67, milestone 2D) and must read them from the same list the API writes.
//
// The shape is `<object>.<past tense verb>`: an audit log records what happened, never what was
// asked for. Phase 1 fills authentication, workspace, membership, document and search; the agent,
// tool, approval and configuration events of FR-66 arrive with the features that raise them.

export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCEEDED: 'auth.login.succeeded',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_ACCOUNT_LOCKED: 'auth.account.locked',
  AUTH_TOKEN_REFRESHED: 'auth.token.refreshed',
  AUTH_TOKEN_REUSE_DETECTED: 'auth.token.reuse_detected',
  AUTH_LOGGED_OUT: 'auth.logged_out',

  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_ARCHIVED: 'workspace.archived',

  MEMBERSHIP_ADDED: 'membership.added',
  MEMBERSHIP_ROLE_CHANGED: 'membership.role_changed',
  MEMBERSHIP_REMOVED: 'membership.removed',

  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_DOWNLOADED: 'document.downloaded',
  DOCUMENT_VERSION_STATE_CHANGED: 'document.version.state_changed',

  SEARCH_PERFORMED: 'search.performed',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// What the event is about. `object_kind` is a column of its own so an auditor can filter by the
// kind of thing without parsing the action name.
export const AUDIT_OBJECTS = {
  USER: 'user',
  WORKSPACE: 'workspace',
  MEMBERSHIP: 'membership',
  DOCUMENT: 'document',
  DOCUMENT_VERSION: 'document_version',
  SEARCH: 'search',
} as const;

export type AuditObjectKind = (typeof AUDIT_OBJECTS)[keyof typeof AUDIT_OBJECTS];

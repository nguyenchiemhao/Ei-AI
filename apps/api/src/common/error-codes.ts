// The error taxonomy of design §7.4. Every problem+json response carries one of these codes,
// and the HTTP status comes from this table rather than from the call site that raises it.
// Five are additions §7.4 does not name. NOT_FOUND and RATE_LIMITED fill gaps §7.2 relies on —
// it lists both statuses on endpoints while the taxonomy names neither. AUTH_TOKEN_EXPIRED is
// what lets a client tell "refresh" from "log in again". VALIDATION_FAILED and INTERNAL_ERROR
// are what the HTTP edge itself raises.
// Titles are English since 2026-09-17; design §7.4's "Nghĩa" column, which they were taken
// from, is Vietnamese. Q-18 in Progress §3 carries the question of which language the API speaks.
export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: { status: 401, title: 'Email or password is incorrect' },
  AUTH_ACCOUNT_LOCKED: { status: 423, title: 'Account is locked' },
  AUTH_TOKEN_REUSE: { status: 401, title: 'Refresh token was replayed' },
  AUTH_TOKEN_EXPIRED: { status: 401, title: 'Session has expired' },
  RATE_LIMITED: { status: 429, title: 'Too many requests' },
  WORKSPACE_NAME_TAKEN: { status: 409, title: 'Workspace name is already taken' },
  WORKSPACE_LAST_OWNER: { status: 409, title: 'A workspace must keep at least one Owner' },
  DOC_DUPLICATE_CONTENT: {
    status: 409,
    title: 'This content is already a version of the document',
  },
  AUTHZ_WORKSPACE_FORBIDDEN: { status: 403, title: 'Not a member of this workspace' },
  AUTHZ_TOOL_FORBIDDEN: { status: 403, title: 'This role may not call this tool' },
  DOC_UNSUPPORTED_FORMAT: { status: 415, title: 'Document format is not supported' },
  DOC_TOO_LARGE: { status: 413, title: 'Document exceeds the size limit' },
  DOC_CONTENT_MISMATCH: { status: 415, title: 'Content does not match the file extension' },
  AGENT_INVALID_ACTION: {
    status: 500,
    title: 'The agent returned an action that does not match the schema',
  },
  MCP_WRITE_DISABLED: { status: 409, title: 'Write tools are disabled in this release' },
  MCP_PAYLOAD_INVALID: { status: 400, title: "Payload does not match the tool's schema" },
  MCP_UNREACHABLE: { status: 503, title: 'MCP server did not respond' },
  APPROVAL_EXPIRED: { status: 410, title: 'Approval request has expired' },
  APPROVAL_ALREADY_DECIDED: { status: 409, title: 'Approval request has already been decided' },
  EGRESS_NOT_ALLOWLISTED: { status: 403, title: 'Destination is not on the allowlist' },
  VALIDATION_FAILED: { status: 400, title: 'The submitted data is not valid' },
  NOT_FOUND: { status: 404, title: 'Not found' },
  NOT_IMPLEMENTED: { status: 501, title: 'Not implemented yet' },
  INTERNAL_ERROR: { status: 500, title: 'Unexpected error' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// TURN_BUDGET_EXHAUSTED and TURN_LOOP_DETECTED are in §7.4 with status 200 and are deliberately
// absent: they are turn outcomes carried in a successful body, not failures the filter renders.

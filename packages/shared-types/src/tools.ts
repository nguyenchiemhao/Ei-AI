// The internal tools of design §5.4 and ADR-10, written down once so the seed that creates the rows,
// the registry that reads them and the mode computation that counts them cannot drift apart.
//
// A tool is offered when its row says `enabled` **and** its variable says true. Design ADR-10 says
// `search_documents` has "no configuration to disable it", and `TOOL_SEARCH_DOCUMENTS_ENABLED`
// exists — this is the deviation recorded in docs/plan/notes/WP-3.5.md, decided at the plan.
// FR-77 requires exactly this shape for `web_search`, so the rule is uniform rather than special.

export const TOOL_NAMES = {
  SEARCH_DOCUMENTS: 'search_documents',
  READ_DOCUMENT_PAGE: 'read_document_page',
  LIST_WORKSPACE_DOCUMENTS: 'list_workspace_documents',
  WEB_SEARCH: 'web_search',
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const TOOL_ENABLED_FLAG = {
  search_documents: 'TOOL_SEARCH_DOCUMENTS_ENABLED',
  read_document_page: 'TOOL_READ_DOCUMENT_PAGE_ENABLED',
  list_workspace_documents: 'TOOL_LIST_WORKSPACE_DOCUMENTS_ENABLED',
  web_search: 'TOOL_WEB_SEARCH_ENABLED',
} as const satisfies Record<ToolName, string>;

export type ToolClassification = 'read' | 'write';

export interface InternalTool {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  classification: ToolClassification;
  minSystemRole: string;
  enabledInPhase1: boolean;
}

// `web_search` is absent: it gets a row when milestone 2B builds it, and until then the tool the
// design calls optional is optional by not existing. The two disabled rows carry their phase in
// the description because that description is what the tool administration screen renders.
export const INTERNAL_TOOLS: readonly InternalTool[] = [
  {
    name: TOOL_NAMES.SEARCH_DOCUMENTS,
    description: 'Search indexed documents and return cited passages',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    classification: 'read',
    minSystemRole: 'Member',
    enabledInPhase1: true,
  },
  {
    name: TOOL_NAMES.READ_DOCUMENT_PAGE,
    description: 'Read one page of a document in full. Implemented in phase 2B',
    inputSchema: {
      type: 'object',
      properties: { documentId: { type: 'string' }, page: { type: 'integer' } },
      required: ['documentId', 'page'],
    },
    classification: 'read',
    minSystemRole: 'Member',
    enabledInPhase1: false,
  },
  {
    name: TOOL_NAMES.LIST_WORKSPACE_DOCUMENTS,
    description: 'List the documents of a workspace the caller may read. Implemented in phase 2B',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string' } },
      required: ['workspaceId'],
    },
    classification: 'read',
    minSystemRole: 'Member',
    enabledInPhase1: false,
  },
];

// Design §3's three modes, spelled as the design spells them. There is no "document + ERP": a
// registered ERP names the full mode, and the per-group line below is what says whether web search
// is actually on. FR-79's status line reads the groups; the mode is the one-word summary.
export const OPERATING_MODES = ['document-only', 'document+web', 'document+web+erp'] as const;

export type OperatingMode = (typeof OPERATING_MODES)[number];

// `not_configured` rather than `unreachable` is FR-78: an installation with no MCP server is a
// supported configuration, not a fault, and the indicator must not raise an alert about it.
export type ToolGroupStatus = 'on' | 'off' | 'not_configured';

export interface ToolGroups {
  documents: ToolGroupStatus;
  web: ToolGroupStatus;
  erp: ToolGroupStatus;
}

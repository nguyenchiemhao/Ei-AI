import type { FeatureKey } from '@ei-ai/shared-types';

// Design §8.1's twenty-one screens, plus `Search documents`, which §8.1 does not list: it is the
// Phase 1 surface for finding a passage, the screen-level counterpart of `POST /search` standing in
// for the `search_documents` tool the agent turn will wrap in 2B.
//
// Design §8.2 gives the navigation map and no URLs, so the paths are chosen here. The
// administration area is `/admin/*` because the proving command navigates a Member into it and
// expects the server to refuse.
//
// `feature` is what a planned screen shows: the badge beside it in the sidebar and the phase inside
// its panel both read `FEATURE_STATUS` through this key. Keeping the map here rather than in
// `GET /me` is what lets six screens share one module's phase without the API knowing about
// screens at all.

export interface ScreenRoute {
  path: string;
  title: string;
  /** Design §8.1's row, or `null` for `Search documents`, which has none. */
  designRow: string | null;
  /** Absent on a screen Phase 1 builds for real. */
  feature?: FeatureKey;
  /** What the placeholder tells a reader the screen will do. */
  summary?: string;
  /**
   * The endpoint this screen will use. The placeholder calls it, so what a person sees is the
   * server's own answer — `501` with the phase, or `403` if their role may not be here. The web
   * app makes no security decision, and this is where that stops being a claim.
   */
  probe?: string;
  nav?: { group: 'work' | 'admin'; label: string };
}

export const ROUTES: readonly ScreenRoute[] = [
  { path: '/login', title: 'Sign in', designRow: 'Login' },

  {
    path: '/search',
    title: 'Search documents',
    designRow: null,
    nav: { group: 'work', label: 'Search' },
  },
  {
    path: '/workspaces',
    title: 'Workspaces',
    designRow: 'Workspace list',
    nav: { group: 'work', label: 'Workspaces' },
  },
  { path: '/workspaces/:workspaceId', title: 'Workspace documents', designRow: 'Workspace documents' },
  { path: '/workspaces/:workspaceId/upload', title: 'Upload', designRow: 'Upload' },

  {
    path: '/ask',
    title: 'Ask',
    designRow: 'Ask',
    feature: 'agent-loop',
    summary: 'Ask a question in your own words and let the agent choose how to answer it.',
    nav: { group: 'work', label: 'Ask' },
  },
  {
    path: '/turns/:turnId',
    title: 'Running',
    designRow: 'Running',
    feature: 'agent-loop',
    summary: 'Watch each step the agent takes, why it chose it, and how much budget is left.',
    probe: '/turns/00000000-0000-0000-0000-000000000000',
  },
  {
    path: '/turns/:turnId/answer',
    title: 'Answer',
    designRow: 'Answer',
    feature: 'verified-answers',
    summary: 'Read an answer whose every sentence carries a citation you can open.',
    probe: '/turns/00000000-0000-0000-0000-000000000000/answer',
  },
  {
    path: '/turns/:turnId/refusal',
    title: 'Refusal',
    designRow: 'Refusal',
    feature: 'verified-answers',
    summary: 'See what was searched for, where, and what to try next when there is no evidence.',
  },
  {
    path: '/turns/:turnId/partial',
    title: 'Partial answer',
    designRow: 'Partial answer',
    feature: 'verified-answers',
    summary: 'Read the part that is supported, and a plain sentence about what is missing.',
  },
  {
    path: '/documents/:documentId/source',
    title: 'Source review',
    designRow: 'Source review',
    feature: 'verified-answers',
    summary: 'Check a citation against the page it came from, with the passage highlighted.',
  },
  {
    path: '/documents/:documentId',
    title: 'Document detail',
    designRow: 'Document detail',
    feature: 'full-ingestion',
    summary: 'Version history, ingestion state, page counts and per-page extraction method.',
  },

  {
    path: '/approvals',
    title: 'Approval inbox',
    designRow: 'Approval inbox',
    feature: 'approvals',
    summary: 'Triage the write actions waiting for a decision, oldest and nearest expiry first.',
    nav: { group: 'work', label: 'Approvals' },
    probe: '/approvals',
  },
  {
    path: '/approvals/:approvalId',
    title: 'Approval detail',
    designRow: 'Approval detail',
    feature: 'approvals',
    summary: 'Decide one request, with the verbatim payload and the reason it was asked for.',
    probe: '/approvals',
  },
  {
    path: '/audit',
    title: 'Audit log',
    designRow: 'Audit log',
    feature: 'audit-log',
    summary: 'Filter every recorded event, export it, and verify the hash chain end to end.',
    nav: { group: 'work', label: 'Audit log' },
    probe: '/audit',
  },

  {
    path: '/admin/tools',
    title: 'Tool administration',
    designRow: 'Tool administration',
    feature: 'tool-administration',
    summary: 'The tool catalogue with classification and minimum role, and pre-authorisations.',
    nav: { group: 'admin', label: 'Tools' },
    probe: '/tools',
  },
  {
    path: '/admin/connectors',
    title: 'Connector administration',
    designRow: 'Connector administration',
    feature: 'connectors',
    summary: 'Register MCP servers, re-run discovery, and see each one’s health.',
    nav: { group: 'admin', label: 'Connectors' },
    probe: '/admin/connectors',
  },
  {
    path: '/admin/egress',
    title: 'Egress administration',
    designRow: 'Egress administration',
    feature: 'egress-administration',
    summary: 'The allowlist, the egress log, and which model provider a workspace is pinned to.',
    nav: { group: 'admin', label: 'Egress' },
    probe: '/egress/allowlist',
  },
  {
    path: '/admin/users',
    title: 'User administration',
    designRow: 'User administration',
    feature: 'administration',
    summary: 'The user table with auth source and status, role assignment, disable and unlock.',
    nav: { group: 'admin', label: 'Users' },
    probe: '/admin/users',
  },
  {
    path: '/admin/health',
    title: 'Health dashboard',
    designRow: 'Health dashboard',
    feature: 'administration',
    summary: 'Indicator tiles, active alerts, queue depth and age, and backup history.',
    nav: { group: 'admin', label: 'Health' },
  },
  {
    path: '/admin/evaluation',
    title: 'Evaluation',
    designRow: 'Evaluation',
    feature: 'evaluation',
    summary: 'Run the golden set, compare metric trends, and inspect one question at a time.',
    nav: { group: 'admin', label: 'Evaluation' },
    probe: '/admin/evaluation',
  },
  {
    path: '/admin/restore',
    title: 'Restore',
    designRow: 'Restore',
    feature: 'administration',
    summary: 'The backup list with verification status, and a restore behind a typed confirmation.',
    nav: { group: 'admin', label: 'Restore' },
    probe: '/admin/restore',
  },
];

export const REAL_ROUTES = ROUTES.filter((route) => route.feature === undefined);
export const PLANNED_ROUTES = ROUTES.filter((route) => route.feature !== undefined);

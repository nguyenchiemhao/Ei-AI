// Detail §WP-3.5 names `FEATURE_STATUS` twice and defines it nowhere. This is that definition,
// transcribed from Detail §7.1's "fourteen modules, six of them real": one entry per module Phase 1
// does not finish, carrying the phase that finishes it. The web app's badges and its fifteen
// "Coming soon" panels read it, and so do the contract tests of T-5.5-01, which need exactly the
// `feature` and `plannedPhase` a 501 body carries.
//
// The four FEATURE_* environment variables override `status` for the four features they name; the
// rest are `coming_soon` because §7.1 says they are unbuilt, and nothing configures that.

export const FEATURE_STATUSES = ['available', 'coming_soon', 'disabled'] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export interface PlannedFeature {
  module: string;
  plannedPhase: string;
  status: FeatureStatus;
}

export const PLANNED_FEATURES = {
  'agent-loop': { module: 'agent', plannedPhase: '2B', status: 'coming_soon' },
  'verified-answers': { module: 'answering', plannedPhase: '2C', status: 'coming_soon' },
  evaluation: { module: 'evaluation', plannedPhase: '2D', status: 'coming_soon' },
  connectors: { module: 'connectors', plannedPhase: '3A', status: 'coming_soon' },
  'tool-administration': { module: 'tools', plannedPhase: '3A', status: 'coming_soon' },
  approvals: { module: 'governance', plannedPhase: '3B', status: 'coming_soon' },
  'model-provider': { module: 'model-provider', plannedPhase: '3D', status: 'coming_soon' },
  administration: { module: 'admin', plannedPhase: '4A', status: 'coming_soon' },

  // Three modules §7.1 calls "Full" are full only for what Phase 1 promised, and each has a screen
  // that needs the rest: the document detail pane needs every format, the audit log screen needs
  // the verification and export side, and the egress screen needs the admin surface. Added at
  // WP-3.6, where the screens are; the shape — one entry per module, phase from §7.1 — is the one
  // settled at the WP-3.5 gate.
  'full-ingestion': { module: 'ingestion', plannedPhase: '2A', status: 'coming_soon' },
  'audit-log': { module: 'audit', plannedPhase: '2D', status: 'coming_soon' },
  'egress-administration': { module: 'egress', plannedPhase: '3C', status: 'coming_soon' },
} as const satisfies Record<string, PlannedFeature>;

export type FeatureKey = keyof typeof PLANNED_FEATURES;

export type FeatureStatusMap = Record<FeatureKey, PlannedFeature>;

// Only four of the eleven have a variable. A feature absent from this map is not configurable,
// which is the honest state: there is no switch for a module that does not exist yet.
export const FEATURE_ENV_FLAG = {
  'agent-loop': 'FEATURE_AGENT_LOOP',
  'verified-answers': 'FEATURE_VERIFIED_ANSWERS',
  approvals: 'FEATURE_APPROVALS',
  connectors: 'FEATURE_CONNECTORS',
} as const satisfies Partial<Record<FeatureKey, string>>;

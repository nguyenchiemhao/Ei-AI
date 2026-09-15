/**
 * Stage 4 — the architecture rules of WP-2.5. Four of the five are import-graph rules and live
 * here. Rule 1, "only one file may query chunks", is a source-text rule and lives in
 * eslint.architecture.config.mjs: a SQL table name produces no dependency edge to forbid.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'A cycle is where a module boundary stops being a boundary.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'connectors-only-via-governance',
      comment:
        'Rule 2 — the approval gate cannot be bypassed while there is exactly one door into the ' +
        'connectors. Connector files may import each other; nothing else may reach them.',
      severity: 'error',
      from: {
        pathNot: '^apps/api/src/modules/(governance/execution\\.gateway\\.ts$|connectors/)',
      },
      to: { path: '^apps/api/src/modules/connectors/' },
    },
    {
      name: 'no-cross-module-service',
      comment:
        'Rule 3 — a module reaches another module through its exported surface, never through ' +
        'its *.service.ts. ports/ holds the three outbound seams of design 5.4 and may not grow ' +
        'a fourth, so this, not "only through ports/", is the boundary that can be enforced.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: {
        path: '^apps/api/src/modules/[^/]+/.+\\.service\\.ts$',
        pathNot: '^apps/api/src/modules/$1/',
      },
    },
    {
      name: 'web-not-to-api',
      comment:
        'Rule 4 — backend detail does not leak into the client. The plan words this as an ' +
        'allowlist onto packages/shared-types, which does not exist yet; the half that can be ' +
        'enforced today is the refusal, and T-3.2-01 is the task that first fills the package.',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^apps/api/' },
    },
    {
      name: 'provider-sdk-only-in-adapter',
      comment:
        'Rule 5 — ModelProviderPort stays a seam rather than a label. The providers are named ' +
        'rather than guessed, and the pattern matches both the bare specifier of an SDK that is ' +
        'not installed and the node_modules path of one that is.',
      severity: 'error',
      from: { pathNot: '^apps/api/src/adapters/model-provider/' },
      to: {
        path:
          '(^|node_modules/)(@anthropic-ai/sdk|openai|@google/genai|' +
          '@aws-sdk/client-bedrock-runtime)(/|$)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Type-only imports are erased before runtime, and consistent-type-imports turns most
    // cross-boundary imports into them. Without this the rules below would see almost nothing.
    tsPreCompilationDeps: true,
  },
};

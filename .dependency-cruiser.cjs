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
        'connectors. Connector files may import each other; nothing else may reach them. The ' +
        'composition root is exempt, by decision at WP-3.6: Nest has to be handed the module to ' +
        'register its routes, and assembling a module is not a path that calls a connector. ' +
        'The rule below is what keeps that exemption to the module file alone.',
      severity: 'error',
      from: {
        pathNot:
          '^apps/api/src/(app\\.module\\.ts$|' +
          'modules/(governance/execution\\.gateway\\.ts$|connectors/))',
      },
      to: { path: '^apps/api/src/modules/connectors/' },
    },
    {
      name: 'composition-root-takes-only-the-connectors-module',
      comment:
        'Rule 2, the other half. app.module.ts is exempted above so Nest can be handed the module; ' +
        'without this it could reach any file under connectors/ and the exemption would be a hole ' +
        'rather than a door.',
      severity: 'error',
      from: { path: '^apps/api/src/app\\.module\\.ts$' },
      to: {
        path: '^apps/api/src/modules/connectors/',
        pathNot: '^apps/api/src/modules/connectors/connectors\\.module\\.ts$',
      },
    },
    {
      name: 'no-cross-module-service',
      comment:
        'Rule 3 — a module reaches another module through its exported surface, never through ' +
        'its *.service.ts. ports/ holds the three outbound seams of design 5.4 and may not grow ' +
        'a fourth, so this, not "only through ports/", is the boundary that can be enforced. ' +
        'The audit module is exempt, by decision at WP-2.4: FR-66 has every module write events, ' +
        "AuditService is that module's exported surface rather than an internal of it, and a " +
        'filename cannot tell the two apart. The tools module is exempt on the same argument, by ' +
        'decision at WP-3.5: design 5.4 makes the registry "the only place that knows which mode ' +
        'the system is running in", so every surface that reports the mode has to reach it. ' +
        'Every other pair of modules is still refused.',
      severity: 'error',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: {
        path: '^apps/api/src/modules/[^/]+/.+\\.service\\.ts$',
        pathNot: [
          '^apps/api/src/modules/$1/',
          '^apps/api/src/modules/audit/',
          '^apps/api/src/modules/tools/',
        ],
      },
    },
    {
      name: 'web-not-to-api',
      comment:
        'Rule 4 — backend detail does not leak into the client. The refusal half; the allowlist ' +
        'half is the rule below, written at WP-3.6 now that packages/shared-types exists and ' +
        'apps/web imports it. T-3.2-01 was the task that filled the package.',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^apps/api/' },
    },
    {
      name: 'web-shared-only-through-shared-types',
      comment:
        'Rule 4, the allowlist half. The client may reach exactly one workspace package. Another ' +
        'one would be a second contract between the two ends, and the point of shared-types is ' +
        'that there is one.',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^packages/', pathNot: '^packages/shared-types/' },
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

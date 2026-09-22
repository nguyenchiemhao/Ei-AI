# WP-3.5 · Tool registry and operating mode

Opened 2026-09-22. Authorities: [Detail §WP-3.5](../ei-ai-phase-1-detail.md) · [Tasks §5](../ei-ai-phase-1-tasks.md) · FR-21, FR-22, FR-75, FR-79 · [Design §5.4, §9.1, ADR-10](../../design/ei-ai-agentic-knowledge-assistant.md) · [Progress §4.3](../ei-ai-progress.md).

The table is ready and the constraints are already doing their job. `tools` carries `classification`,
`enabled`, `min_system_role` with a CHECK over the five roles, the partial index
`tools_enabled_role … WHERE enabled = TRUE` that `T-3.5-02` will use, and `tools_no_write_in_v1`
from WP-2.1 — a write tool cannot be enabled at all. `mcp_servers` is empty, which is the state the
proving command is about. `T-3.2-01` is done, so the package's dependency is discharged.

## Contradictions found on opening

- 2026-09-22 — **the design contradicts itself about whether the mode is configured or computed.**
  §3 says *"three operating modes, **switched by configuration**"*; §5.4 gives the tool registry
  *"computes the operating mode at the start of every turn from the set of enabled tools — the only
  place that knows which mode the system is running in"*, and ADR-10 repeats it. Detail §WP-3.5 takes
  the second: *"operating mode is computed, never configured"*. Two of the three agree, which is how
  it will be built, but §3 is the sentence a reader meets first.
- 2026-09-22 — **there are two sources of truth for whether a tool is enabled.** `tools.enabled` is a
  column, and `TOOL_SEARCH_DOCUMENTS_ENABLED`, `TOOL_READ_DOCUMENT_PAGE_ENABLED`,
  `TOOL_LIST_WORKSPACE_DOCUMENTS_ENABLED` and `TOOL_WEB_SEARCH_ENABLED` are environment variables in
  `env.schema.ts`. Worse, ADR-10 says `search_documents` is *"an internal tool, always present, **with
  no configuration to disable it**"* — and `TOOL_SEARCH_DOCUMENTS_ENABLED` is exactly that
  configuration.
- 2026-09-22 — **the config's three tool flags default to `true`, and `T-3.5-01` wants two of those
  tools disabled.** *"Three rows, all `read`; two disabled with the phase recorded in the
  description"* against `TOOL_READ_DOCUMENT_PAGE_ENABLED=true` and
  `TOOL_LIST_WORKSPACE_DOCUMENTS_ENABLED=true` in `.env.example`.
- 2026-09-22 — **`min_system_role` presupposes an ordering of the five roles that design §9.1
  denies.** A single "minimum" role only means something if the roles form a chain, and §9.1's
  matrix is not one: the Auditor may read the whole audit log and the Knowledge Manager may not,
  while the Knowledge Manager may manage workspaces and the Auditor may not. Neither is above the
  other. `T-3.5-02` closes on *"a Member's catalogue omits Administrator-only tools at the SQL
  level"*, which needs an order nothing writes down.
- 2026-09-22 — **the seed has one tool and the task wants three.** `seedSearchTool` writes
  `search_documents` alone. Adding the other two touches `T-1.2-11`'s output, as WP-3.4 did when it
  gave the seed real bytes.
- 2026-09-22 — **`FEATURE_STATUS` is named twice in Detail and defined nowhere.** `env.schema.ts` has
  four `FEATURE_*` variables — agent loop, verified answers, approvals, connectors — while Detail
  §7.1 lists fourteen modules of which eight are unbuilt, and §WP-3.6 has fifteen screens showing
  "Coming soon". Which set the map carries, and whether its values are the three of `featureStatus`
  or the phase strings of §7.1's `plannedPhase`, is written down nowhere.
- 2026-09-22 — **half of the proving command has nothing to check.** *"…and no health indicator reads
  `unreachable` because of it"* — `/health` returns `{"status":"ok"}` and has no indicators at all.
  FR-78's aggregation over database, Redis and disk is 4A's, as the WP-3.2 gate recorded.
- 2026-09-22 — **`T-3.5-04`'s "Done when" is about a web app that does not exist.** *"The web app's
  badges and 'Coming soon' panels are driven entirely by this response"* — WP-3.6 is 0/12. The same
  shape as `T-3.4-11`, which the WP-3.4 gate deferred to `T-3.6-10`.
- 2026-09-22 — **`GET /me` has no row in the matrix**, like `GET /workspaces`. It needs an explicit
  decision in `scripts/check-route-decisions.mjs`, which will otherwise report it undecided — which
  is the check working.

## Open questions

- 2026-09-22 — **what decides that a tool is enabled**: the `tools.enabled` column alone, with the
  `TOOL_*_ENABLED` variables removed; the configuration alone; or configuration gating a registry
  that records? ADR-10 says `search_documents` has no configuration to disable it, and there is a
  variable that does. · **blocks `T-3.5-01` and `T-3.5-03`**
- 2026-09-22 — **the ordering behind `min_system_role`.** §9.1's five roles are not a chain. Is the
  order Administrator > Knowledge Manager > Approver > Member > Auditor, written down for the first
  time here; or does the column become a set of roles like the matrix; or does a tool's audience
  come from the matrix instead? · **blocks `T-3.5-02`**
- 2026-09-22 — **what `FEATURE_STATUS` carries**: the four `FEATURE_*` variables as they stand, or a
  row per unbuilt module with the phase §7.1 gives it? The web app needs one to render fifteen
  panels. · **blocks `T-3.5-04`**
- 2026-09-22 — **the health clause of the proving command**: dropped as belonging to FR-78 in 4A, or
  read as "nothing this package adds makes an existing check fail"? · **blocks the package's close,
  not its start**

## Answered before the first edit

- 2026-09-22 — **what decides that a tool is enabled: both, at request time.** A tool is offered when
  `tools.enabled` is `TRUE` **and** its `TOOL_*_ENABLED` variable is true. Options put: the column
  alone, with the four variables deleted; the configuration seeding the column once; both at runtime.
  Both, chosen with the ADR-10 conflict stated — see the deviation below, which is where it lands.
- 2026-09-22 — **the ordering behind `min_system_role`: declared, and scoped.** Administrator >
  Knowledge Manager > Approver > Member > Auditor, written beside the matrix in `permissions.ts`,
  governing tool visibility and nothing else. The alternatives were a `TEXT[]` column behind a new
  migration, and giving every tool a row in the 77-row matrix — which would have broken the count
  the G3 gate reads and reopened WP-3.2.
- 2026-09-22 — **`FEATURE_STATUS` is the §7.1 map, with the environment overriding it.** One entry
  per unbuilt module carrying `status` and `plannedPhase`; the four `FEATURE_*` variables override
  the `status` of the four modules they name. The flat four-variable object was refused because
  fifteen screens and `T-5.5-01`'s contract tests both need `plannedPhase`, which it cannot carry.
- 2026-09-22 — **the health clause of the proving command is read as "this package turns nothing
  red".** The indicator half belongs to FR-78 and is deferred by name to the `admin` module in
  milestone 4A, per §7.1. The package's own proof runs the full suite and shows `/health` still
  answering.

## What running it taught

- 2026-09-22 — **the control passed against a query with no filter in it at all.** The compiled-SQL
  control was written as three absences — a Member's parameters must not contain `Administrator`,
  `Knowledge Manager`, `Approver`. Deleting the `min_system_role` predicate leaves *no* roles in the
  parameter list, so all three absences hold and the control stayed green while the query returned
  every tool in the table. Rewritten as an equality per role, it goes red with six others. An
  absence is only evidence when something is known to be present.
- 2026-09-22 — **the api container has no `curl`.** The liveness wait was written with it and came
  back `sh: curl: not found`; had the loop swallowed the exit code, "up" would have been an empty
  string compared against `200`. Written in Node's own `fetch` instead, which the image certainly
  has because it is the runtime.
- 2026-09-22 — **`.dependency-cruiser.cjs` is not inside the container's mount.** `/workspace` holds
  `apps`, `packages` and the workspace files, not the repository root's dotfiles, so `pnpm arch`
  cannot run from inside without `docker compose cp` first. CI runs it on a full checkout and is
  unaffected; a developer reaching for it locally is not.
- 2026-09-22 — **the rule-3 exemption still discriminates.** With `modules/tools/` exempt, an import
  of `WorkspacesService` from the very same file — `me.controller.ts` — is still refused with
  `no-cross-module-service`. The loosening admits one module, not cross-module imports.
- 2026-09-22 — **the mode answers the database, not a constant.** Inserting one `mcp_servers` row
  moved the ERP group from `not_configured` to `off` and deleting it moved it back, with no restart
  between — which is FR-80 demonstrated rather than asserted.

## Interpretations

- 2026-09-22 — **the three modes are spelled `document-only`, `document+web`, `document+web+erp`.**
  Detail pins only the first. Design §3's table has no `document + ERP` row, so an ERP registered
  without web search still names the full mode, and the per-group line carries the truth that web is
  off. `GET /me` returns both.
- 2026-09-22 — **"reachable" is not probed in Phase 1.** Detail says the mode comes from tools
  "enabled and reachable", and the MCP client that could ask belongs to the connectors module in
  milestone 3A. So a registered server counts as configured: the ERP group reads `not_configured`
  with no server (FR-78), `off` with a server that contributes no enabled tool, and `on` otherwise.
- 2026-09-22 — **a tool with no variable of its own is governed by its row alone.** Nothing in the
  environment names a tool discovered over MCP, and the alternative reading — absent variable means
  absent permission — would make a registered server produce tools nobody could ever enable.
- 2026-09-22 — **`FEATURE_STATUS` is keyed by feature, not by module.** `T-5.5-01` asserts the
  `feature` field of a 501 body, which design gives as `agent-loop`; the module name rides alongside
  so §7.1 stays traceable.
- 2026-09-22 — **`GET /me` resolves the caller through `AuthService.activeUser`, not `findById`.**
  The route whose whole job is to describe the caller is the last place a token that outlived its
  account should still work; this reuses the refusal Q-16 added rather than writing a second one.

## Deviations

- 2026-09-22 — **ADR-10 is departed from: `search_documents` can be switched off by configuration.**
  The decision at the plan was that a tool is offered only when `tools.enabled` and its
  `TOOL_*_ENABLED` variable agree, and the design says this tool has "no configuration to disable
  it". FR-77 requires exactly this shape for `web_search`, so the rule is uniform rather than carved
  out. What the departure costs is visible rather than hidden: with the variable false the
  installation reports `documents: off`, still under the mode name `document-only`, and a unit test
  asserts that reading.
- 2026-09-22 — **architecture rule 3 is loosened a second time, for `modules/tools/`.** Design §5.4
  makes the registry "the only place that knows which mode the system is running in", so `GET /me`
  has to reach it; the alternatives were a fourth entry in `ports/`, which §7.1 forbids, and moving
  `/me` into `tools`, which reverses the violation. Same argument as audit at WP-2.4, and the
  near-miss control was run: `WorkspacesService` from the same file is still refused.
- 2026-09-22 — **`web_search` gets no row.** `T-3.5-01` says three internal tools and the fourth
  variable has no subject. The variable permits a tool; it does not create one, and the mode reports
  `web: off` however the variable reads until 2B builds it.

## Tradeoffs

- 2026-09-22 — **`min_system_role` kept as a scalar with the order declared in TypeScript**, rather
  than migrated to `TEXT[]`. Keeps the column and the partial index `tools_enabled_role` that
  `T-3.5-02` was written for, and costs an ordering the database cannot check: a row inserted with
  a role the order does not rank would pass the CHECK and be invisible to everyone. Acceptable while
  the only writer is the seed; the tool administration screen in 3A is where it stops being so.
- 2026-09-22 — **the caller's membership list is read inside `identity`** rather than reaching into
  `workspaces`. `workspaces.listForMember` returns the workspaces without the role, so no existing
  query answers `GET /me`, and a cross-module import would have needed a third rule-3 exemption for
  one read. The cost is two modules querying `workspace_members` by user. See the open question.

## Open questions

- 2026-09-22 — **where does "my memberships, with my role" belong?** `identity` and `workspaces` now
  both read `workspace_members` by user, for different shapes. Either `workspaces` grows the query
  and rule 3 gains a third exemption, or the two stay separate and the duplication is accepted as
  the price of the boundary. Nothing breaks either way today. · **for the gate**

## Proof

**What a command demonstrated**

- `GET /me` on the running stack reports `"operatingMode": "document-only"` with `mcp_servers` at
  0 rows, `toolGroups` `{documents: on, web: off, erp: not_configured}`, and no `unreachable`
  anywhere in the response. `GET /health` answers `200 {"status":"ok"}` after the change.
- The registry holds exactly three internal rows, all `read`, only `search_documents` enabled, the
  other two carrying `phase 2B` in the description.
- 985 unit tests pass; coverage 100 % lines, 99.8 % branches, with the one uncovered branch
  pre-existing in `ingest.consumer.ts`. 62 integration tests pass, 16 of them new.
- `depcruise` reports no violations, and reports one when `WorkspacesService` is imported from
  `me.controller.ts`. `check-route-decisions.mjs` reports 16 routes decided and 0 undecided, and
  reports `MISS GET /me` with exit 1 when the decision is removed.
- Inserting and deleting one `mcp_servers` row moves the ERP group and moves it back, with no
  restart.

**What needs the reader's hands**

- Run `pnpm arch` from a full checkout (CI stage 4 does this; it cannot run from inside the api
  container, which does not mount the repository root). A pass is
  `no dependency violations found`.
- The web app's badges and "Coming soon" panels driven by this response — `T-3.5-04`'s Done when —
  cannot be shown until WP-3.6 exists. Deferred by name to **`T-3.6-05`**, which is the task that
  renders `FEATURE_STATUS`, and to **`T-5.5-01`**, which asserts `feature` and `plannedPhase` on
  every 501 route.

**What was skipped on purpose**

- The FR-78 health *indicator* — a tile reading `Not configured` — is not built. `/health` returns
  `{"status":"ok"}` and has no indicators; the aggregation over database, Redis and disk belongs to
  the `admin` module in milestone **4A** per §7.1. This package's half of the clause is shown by the
  suite above turning nothing red. The risk left open: nothing yet prevents a future indicator from
  reading `unreachable` for an absent MCP server, which is the exact thing FR-78 forbids.
- MCP reachability is not probed, so an ERP group reading `on` means "a server is registered and its
  tools are enabled", not "the server answered". Deferred to the connectors module in **3A**. The
  risk: between 3A's registration screens and its client, a mode could claim ERP for a server that
  is down — which is FR-76's territory and has no code yet.

## Gate · closed 2026-09-22

Four tasks, 16/16 h, all four "Done when" met or deferred by name. The proving command passed on the
running stack: `GET /me` reports `"operatingMode": "document-only"` with `mcp_servers` at 0 rows,
`/health` still answers, and nothing in the response reads `unreachable`.

**Promoted to CLAUDE.md** — three rules, from the diary above:

- *"Not present" is only evidence when something is known to be present* — the compiled-SQL control
  that stayed green against a query with no filter at all.
- *A switch withholds; it does not create* — `TOOL_WEB_SEARCH_ENABLED=true` against a tool with no
  row, and the two-source rule generally.
- *An order the database cannot check is kept only by whoever writes the rows* — `SYSTEM_ROLE_RANK`
  in TypeScript against a CHECK that ranks nothing.

**Carried to Progress §3** — one open question, `Q-27`: where "my memberships, with my role" belongs
now that `identity` and `workspaces` both read `workspace_members` by user.

**Not promoted.** The ADR-10 deviation stays a note in this file rather than a rule: it is a decision
about this product's configuration surface, not a lesson about how to work. The rule-3 loosening is
already covered by *A rule that fires is not yet a rule that discriminates*, whose near-miss control
is what was run.

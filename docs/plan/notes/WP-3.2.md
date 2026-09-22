# WP-3.2 · Authorisation

Opened 2026-09-22. Authorities: [Detail §WP-3.2](../ei-ai-phase-1-detail.md) · [Tasks §5](../ei-ai-phase-1-tasks.md) · FR-61, FR-62, FR-22 · [Design §9.1](../../design/ei-ai-agentic-knowledge-assistant.md) the matrix · [Progress §4.3](../ei-ai-progress.md).

The ground is ready in the places the package needs it. `users.system_role` carries a CHECK over
exactly the five roles of design §9.1; `workspace_members.workspace_role` carries Owner, Editor and
Reader; `JwtAuthGuard` puts a `Principal` on the request with `systemRole` already on it; and
`packages/shared-types` exists as of the WP-2.4 gate, which is what `T-3.2-01` writes into — `Q-13`
is closed and no longer blocks this package.

What does not exist: `RolesGuard`, `WorkspaceRoleGuard`, and any `@Roles()` or `@WorkspaceRole()`
decorator. Authorisation today lives in four services — `upload` (Editor or Owner), `memberships`
(Owner), `downloads` (membership), `documents-listing` (membership) — plus the `permitted` CTE in
retrieval, which is a different thing and stays where it is.

## Contradictions found on opening

- 2026-09-22 — **most of the matrix is about actions no endpoint implements.** Design §9.1 has
  thirteen system-role actions and `T-3.2-05` closes on *"adding a matrix row without an
  implementation fails the build"*. Of the thirteen, Phase 1 builds **three**: create and manage
  workspaces, upload documents, and ask a question — and even "ask a question" is the agent turn of
  2B rather than `POST /search`. Purging a document, approving an outbound step, enabling tools,
  registering MCP servers, managing users and roles, reading the audit log, running evaluations and
  backup/restore are all 2B, 2D, 3A, 3B or 4A. Sixty-five of the seventy-seven cases concern
  routes that will not exist until later phases, so a test that demands an implementation per row
  would fail on the day it is written.
- 2026-09-22 — **the egress allowlist action has no endpoint either, and that is a deferral rather
  than a phase.** *"Manage the egress allowlist"* is one of the thirteen, [Detail §8](../ei-ai-phase-1-detail.md)
  lists `GET/POST /egress/allowlist` as implemented, and `T-2.2-05` is the task — the one task WP-2.2
  closed without. It is the only row of the matrix whose absence is a debt inside Phase 1.
- 2026-09-22 — **`/health` has no guard at all.** [Detail §8](../ei-ai-phase-1-detail.md) marks it
  Administrator; `health.controller.ts` carries no `@UseGuards`, not even `JwtAuthGuard`, so it is
  open to anyone who can reach the port. `T-3.2-06` closes on *"no implemented route is reachable
  without an explicit role decision"*, and this is the route that decision was never made for.
- 2026-09-22 — **`WorkspaceRoleGuard` cannot read a workspace id that is not in the path.**
  `GET /documents/:id` and `GET /documents/:id/download` identify a document, and the workspace is
  reached through it; `POST /search` names no workspace at all. A guard that reads `:id` from the
  route works for `/workspaces/:id/*` and for nothing else, so `T-3.2-04`'s decorator needs a way to
  say where the workspace comes from — or those routes keep their check in the service.
- 2026-09-22 — **the Auditor may not ask a question.** §9.1's row gives Auditor a dash under *"Ask a
  question"*, and the only tick in its column is the audit log. Read literally, an Auditor calling
  `POST /search` gets 403 — which is defensible and is also the first time anyone will notice that
  the product's read-only role cannot read documents.
- 2026-09-22 — **four services already refuse, and the plan says the guard replaces one of them.**
  The WP-3.3 gate recorded the Owner rule in `MembershipsService` as a deviation to be *"replaced by
  `WorkspaceRoleGuard` at `T-3.2-06`"*. It says nothing about `upload`, `downloads` or
  `documents-listing`, which grew the same shape later. Removing a service check moves the decision
  to one place; keeping it means two places agree until one of them is edited.
- 2026-09-22 — **`Q-16` is due at this gate and nothing in the package's tasks touches it.** A locked
  account can still refresh: `activeUser` checks `status` and not `locked_until`, so a holder of a
  valid refresh token keeps minting access tokens through a lockout. Progress §3 marks it *"before
  WP-3.2 closes"*, and none of the eight tasks mentions the refresh path.
- 2026-09-22 — **13 × 5 is 65, and the tasks say 13 actions.** The arithmetic in Detail — *"5 system
  roles × 13 actions + 3 workspace roles × 4 actions = 77"* — checks out against §9.1's table, which
  has exactly thirteen rows. What §9.1 does not give is the four workspace-role actions; the three
  roles are described in one sentence — Owner *"manages members and documents"*, Editor *"manages
  documents"*, Reader *"read only"* — and which four actions those become is nowhere written down.

## Open questions

- ~~2026-09-22 — **what the matrix test asserts for an action with no endpoint**~~ · **Answered
  2026-09-22: all 77 rows, each carrying the phase it lands in.**
- ~~2026-09-22 — **the four workspace-role actions**~~ · **Answered 2026-09-22: read, manage
  documents, change the workspace, manage members.**
- ~~2026-09-22 — **service checks**~~ · **Answered 2026-09-22: removed; the guard is the one place.**
- ~~2026-09-22 — **routes with no workspace in the path**~~ · **Answered 2026-09-22: the decorator
  says where the workspace comes from; `/search` keeps its predicate and takes no guard.**
- ~~2026-09-22 — **`/health`**~~ · **Answered 2026-09-22: split — open liveness, Administrator
  detail.**
- ~~2026-09-22 — **`Q-16`**~~ · **Answered 2026-09-22: fixed in this package.**

## Answered before the first edit

- 2026-09-22 — **the matrix carries all seventy-seven rows, and every row names its phase.** The test
  asserts the decision for all of them and drives a live 403 for the rows that have a route today.
  `T-3.2-05`'s *"adding a matrix row without an implementation fails the build"* becomes: a row with
  neither a route nor a phase fails the build, and a row whose route exists but has no guard fails
  it too. Cutting the matrix to what Phase 1 builds would have made every case a live 403 and left
  `shared-types` holding something that is not design §9.1; building 501 stubs for the other ten
  actions would have made every row live, and pulled roughly thirteen routes no task names into a
  forty-hour package.
- 2026-09-22 — **the four workspace-role actions are read, manage documents, change the workspace,
  and manage members.** Owner has all four, Editor has read and documents, Reader has read. That is
  §9.1's prose — Owner *"manages members and documents"*, Editor *"manages documents"*, Reader
  *"read only"* — against the surface that exists, and it should be written back into §9.1 rather
  than living only here.
- 2026-09-22 — **the service checks are removed.** `upload`, `memberships`, `downloads` and
  `documents-listing` each refuse today; once the guard always runs first, those branches cannot
  fire, and a guard that cannot fire is not a guard. None of the four is reached from the worker, so
  nothing but HTTP calls them. The decision moves to one place, which is the point of having one.
- 2026-09-22 — **`@WorkspaceRole()` names where the workspace comes from** — the route parameter for
  `/workspaces/:id/*`, and the document for `/documents/:id` and `/documents/:id/download`, which the
  guard resolves. **`POST /search` takes no workspace guard at all**: its authorisation is per chunk
  and lives in the `permitted` CTE, and a guard that answered "yes" for the workspace would say
  nothing about the rows.
- 2026-09-22 — **`/health` splits in two.** Liveness stays open and unauthenticated — CI polls it to
  wait for the API (`ci.yml:222`) and a check that goes red because authentication broke is a check
  that fails outside its subject. FR-78's aggregation, which is what Detail §8 meant by
  Administrator, moves to its own route behind the guard.
- 2026-09-22 — **`Q-16` is fixed here.** `activeUser` refuses a locked account as well as a disabled
  one, so a refresh token cannot outlive a lockout. It touches WP-3.1's file; recorded as a
  deviation.

## What running it taught

- 2026-09-22 — **the route scan reported a bare route as guarded.** It read a fixed fourteen lines
  after each method decorator, which reached into the next handler and found its `@Roles` there;
  `GET /workspaces` came back "guarded" when it carries no decorator at all. Bounded to the lines
  before the next method decorator, and checked against a deliberate removal: `MISS POST
  /workspaces`, `14 routes decided, 1 without a decision`.
- 2026-09-22 — **the loosening check was run three ways because one way sees least.** Removing the
  guard from the controller chain leaves the table right and the decorator in place: the matrix spec
  and the route scan are both green, and only the integration suite goes red. The numbers in
  `modules/identity/README.md` are measured; the first draft of that table guessed and was wrong
  about all three.
- 2026-09-22 — **a Member who is a workspace Editor can no longer upload**, and it turned four
  WP-3.3 tests red. §9.1's two dimensions are ANDed, so the narrower one decides: "upload and delete
  documents" belongs to Administrator and Knowledge Manager, and no workspace role reaches past it.
  The WP-3.3 suite's user is a Knowledge Manager now. `Q-25` carries the question of whether that is
  what §9.1 intends.
- 2026-09-22 — **the WP-2.4 gate's 100 % coverage was measured before its last edit.** The fix that
  stopped a failed audit write from killing the worker landed after the last `test:coverage` run,
  and was never covered. Found here by chasing the list rather than the number, together with a dead
  branch in the key comparator — two keys of one object are never equal — which was removed.
- 2026-09-22 — `Q-16` was in the plan and I did not do it until the gate. `activeUser` now refuses a
  locked account as well as a disabled one, with a test on each side of the expiry.

## Interpretations

- 2026-09-22 — **a route with no `@Roles` is not silently allowed.** The guard lets it through, and
  `scripts/check-route-decisions.mjs` refuses it unless it appears in the list of routes that need
  no role, each with the reason. Five do: two public auth routes, logout, liveness, and the
  workspace list, which is scoped by the caller's own memberships.
- 2026-09-22 — **not a member and too small a role give the same answer.** Telling them apart would
  say whether a workspace exists to someone who may not know that.
- 2026-09-22 — **the matrix spec transcribes design §9.1 separately** rather than importing the
  table it tests. A suite that reads its expectations from the thing under test asserts that the
  file equals itself.

## Deviations

- 2026-09-22 — **`/health` does not split in two.** The plan said it would; adding a
  `health.read-detail` row makes the matrix 14 actions and 82 cases, breaking the 77 Detail counts,
  and §9.1 has no such action. Liveness stays open — CI polls it at `ci.yml:222` — and FR-78's
  aggregation is 4A's, which is what Detail §8's "Administrator" was written for.
- 2026-09-22 — **`AUTHZ_ROLE_FORBIDDEN` added**, an eighth code §7.4 does not name.
  `AUTHZ_TOOL_FORBIDDEN` is FR-22's, about the tool catalogue; a system role refused an action of
  §9.1 is a different refusal. `Q-14` asks whether the taxonomy adopts these.
- 2026-09-22 — **four service checks removed**, and their assertions moved rather than deleted:
  `upload`, `memberships`, `downloads` and `documents-listing` each lost an authorisation branch,
  and `common/guards/*.spec.ts` gained the cases, with a comment in each service spec naming where
  they went.
- 2026-09-22 — `MembershipsService.list`, `DownloadsService.current` and
  `DocumentsListingService.list` no longer take a caller id: there is nothing left for them to
  decide about the caller. `DocumentsListingService` no longer depends on the members repository.

---

## Gate · closed 2026-09-22

Reviewed and accepted: all eight tasks. The matrix reports **77/77** — 13 system actions × 5 roles
and 4 workspace actions × 3 roles — from a table whose type refuses a row naming neither a route nor
a phase; seven rows are enforced by a route today and ten carry the phase that will enforce them.
**15 routes carry a decision and none is without one**, checked against the routes the application
maps rather than read by eye. The deliberate loosening was run three ways and each turned something
red. 956 unit tests, 46 integration tests, every file at 100 % coverage, `arch:chunks` and
`depcruise` clean over 171 modules.

**Not proved here:** no CI run number, as with the four packages before it. Sixty-five of the
seventy-seven cases are asserted as decisions rather than as live 403s, because their routes arrive
in 2A, 2B, 2D, 3A, 3B and 4A — each row names which. The egress row names `T-2.2-05` instead, the
one task WP-2.2 closed without and the only matrix row whose absence is a debt inside Phase 1.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — three rules, in force from the next package: three
checks that see different things, and the weakest is the one you would have written; coverage
measured before the last edit is not coverage; two permission dimensions ANDed make one of them
unreachable. Not promoted, because existing rules carry them: the route scan's fixed window is "a
check that can pass for the wrong reason", and the `Worker` double accumulating across a file is "a
fixture built once at module scope ages with the file".

**Promoted to [Progress §3](../ei-ai-progress.md)** — `Q-25`, whether §9.1 intends its two
dimensions to leave the workspace Editor role unreachable for a Member; `Q-26`, whether the four
workspace-role actions go back into §9.1. `Q-16` is closed rather than carried.

# WP-3.6 · Web — 19 routes, four of them real

Opened 2026-09-22. Authorities: [Detail §WP-3.6](../ei-ai-phase-1-detail.md) · [Tasks §5](../ei-ai-phase-1-tasks.md) · [Design §8.1, §8.2](../../design/ei-ai-agentic-knowledge-assistant.md) · FR-01, FR-02, FR-09, FR-58 · [Progress §4.3](../ei-ai-progress.md).

Everything the package consumes exists. `POST /auth/login`, `/auth/refresh`, `/auth/logout`,
`GET /me`, `GET /workspaces`, `POST /workspaces`, the document table and upload endpoints, and
`POST /search` all answer, with `problem+json` and `X-Correlation-Id` on every error. The `web`
service is declared in Compose with its own `node_modules` volumes and sits on `backend`; its
entrypoint is a placeholder that says so.

## Contradictions found on opening

- 2026-09-22 — **"19 routes" is written in seven documents and design §8.1 lists twenty-one
  screens.** Counted: Login, Ask, Running, Answer, Refusal, Partial answer, Source review, Approval
  inbox, Approval detail, Workspace list, Workspace documents, Upload, Document detail, Tool
  administration, Connector administration, Egress administration, User administration, Audit log,
  Health dashboard, Evaluation, Restore. `T-3.6-04`'s "Done when" is *"every route in design §8.1
  resolves to a component"*, which is twenty-one; the task's own title says nineteen.
- 2026-09-22 — **Detail's own table does not agree with design §8.1 either.** Its "Coming soon"
  column lists sixteen screens, not the fifteen the sentence above it claims. Its "Real in Phase 1"
  column lists Login, Workspace list, "Workspace documents + Upload" and **Search documents** —
  five screens under four bullets. And **`Document detail` appears in neither column**, while
  `Search documents` appears in no §8.1 row.
- 2026-09-22 — **the proving command needs a `403` from a route nobody builds.** *"A Member's direct
  navigation to an admin route yields a server 403"*: §7.1 gives eight modules "Module file + `501`
  controller", `T-5.5-01` tests them — *"a stub returning 404 fails the test"* — and **no task
  creates them**. A route that does not exist answers 404, and an unguarded `501` stub answers 501.
  Neither is 403, so the stubs must exist *and* carry `@Roles`, which also puts eight or more new
  rows into `scripts/check-route-decisions.mjs`.
- 2026-09-22 — **nothing owns the Playwright harness.** Detail §11 lists *"E2E (Playwright) · Log in
  → create workspace → upload → `indexed` → search → passages · 1 flow"*, and §10's G3 gate has two
  lines only a browser can check. WP-3.6's twelve tasks name no such task, and `eval/runner/` is a
  directory and a README.
- 2026-09-22 — **`FEATURE_STATUS` has eight entries and the sidebar has sixteen unbuilt screens.**
  `T-3.6-05` drives badges from it and `T-3.6-06` has the panel name the phase, and the map from a
  screen to the feature that explains it does not exist. WP-3.5 built the map per **module**, from
  §7.1; six of the sixteen screens belong to one module (`agent`).
- 2026-09-22 — **`Search documents` has no requirement and no §8.1 row.** Its nearest requirements,
  FR-29 and FR-36, sit under `Ask`, which is 2B. It is the screen-level counterpart of the stand-in
  already recorded for `POST /search` — the Phase 1 surface for a capability the agent turn will
  wrap — but nothing writes that down at the screen level.
- 2026-09-22 — **adding the dependencies is a lockfile regeneration on a host with no Node.**
  `apps/web/Dockerfile` runs `pnpm install --frozen-lockfile`, the host has neither `node` nor
  `pnpm`, and this package needs React 19, react-dom, react-router, TanStack Query, Zustand,
  Tailwind 4 and the shadcn/ui set in one go. WP-2.5 hit this with one package and WP-3.1 with four;
  the discipline settled at WP-3.1 is **one edit for all of them**, then rebuild, then drop the
  volume.
- 2026-09-22 — **architecture rule 4's deferral has come due.** Its comment says the allowlist onto
  `packages/shared-types` *"does not exist yet; the half that can be enforced today is the refusal,
  and `T-3.2-01` is the task that first fills the package"*. `T-3.2-01` closed 2026-09-22 and the
  package now holds four modules, so the half that was deferred can be written.

## Open questions

- 2026-09-22 — **nineteen or twenty-one?** Design §8.1 is the authority `T-3.6-04` points at and it
  lists twenty-one. Does the router build all twenty-one, adding `Document detail` as a `ComingSoon`
  and `Search documents` as real — or does §8.1 lose two rows and the plan keep its number?
  · **blocks `T-3.6-04`, and the G3 gate line that counts screens**
- 2026-09-22 — **who builds the eight `501` controllers?** The proving command needs them and no
  task describes them. Pulled forward into this package by the rule that a proving command needing
  another package's task pulls it forward; given their own id; or the `403` clause is re-read
  against a route that does exist. · **blocks the proving command, not the first task**
- 2026-09-22 — **what maps a screen to a feature?** A table in the web app keyed by route; a second
  field on `FEATURE_STATUS`; or one `FEATURE_STATUS` entry per screen rather than per module.
  · **blocks `T-3.6-05` and `T-3.6-06`**
- 2026-09-22 — **is the Playwright flow inside this package?** It is the only thing that can check
  two of the G3 gate's lines, and it is nobody's task. · **blocks the package's close, not its
  start**

## Answered before the first edit

- 2026-09-22 — **twenty-one screens, from design §8.1.** The design is the authority `T-3.6-04` is
  scored against; "19" is a wrong count copied into seven documents. `Document detail` is built as a
  `ComingSoon` for phase 2A, `Search documents` is the fifth real screen, and the number is
  corrected at the gate as a deviation. The alternatives were twenty — Detail's own table, which
  drops `Document detail` — and cutting two §8.1 rows to protect the number.
- 2026-09-22 — **the eight `501` controllers are pulled into this package, and their hours stay with
  WP-5.5.** The rule is that a proving command needing another package's task pulls it forward
  rather than waiting. Each stub carries `@Roles`, because the clause asks for `403` and an
  unguarded stub answers `501`; each new route gets a row in `scripts/check-route-decisions.mjs`.
- 2026-09-22 — **a route→feature table in the web app maps a screen to its badge.** `GET /me` keeps
  the eight module-level entries settled at the WP-3.5 gate this morning, and `router.tsx` carries
  the table that points each of the twenty-one routes at one of them. The alternative — sixteen
  screen-level entries in `shared-types` — was refused for reopening a decision hours old.
- 2026-09-22 — **Playwright is in scope: one flow, at the end of the package.** It is the only thing
  that can demonstrate two of the G3 gate's lines. Added as scope no task names, so it is
  provisional until the gate decides whether it grows `T-3.6-12` or earns an id.

## What running it taught

- 2026-09-22 — **the count in my own plan was wrong, and the script found it.** I wrote "5 real + 16
  ComingSoon = 21". Design §8.1 has twenty-one rows of which Phase 1 builds four for real — `Ask` is
  in the Coming soon column — so adding `Search documents` makes **twenty-two routes, five real,
  seventeen planned**. `scripts/check-screen-inventory.mjs` reads §8.1 out of the design document
  and prints `21 screens in design §8.1, 22 routes declared (1 outside §8.1)`. Arithmetic asserted
  in prose is arithmetic nobody has done.
- 2026-09-22 — **the documents table never refetched, and the E2E is the only thing that noticed.**
  A document reached `indexed` in the database at 08:12:05 and the screen still read `embedding`
  three minutes later, because `useQuery` has no polling and nothing invalidated it. Every unit and
  integration test in the repository was green throughout: they test the API, and this was a screen
  that shows a state which changes without the reader doing anything. Now polled at 2 s while any
  row is unsettled, and stopped the moment they all are.
- 2026-09-22 — **our own shared package could not be loaded by our own client.** `shared-types`
  compiles to CommonJS for `apps/api`, and the browser's ESM loader answered *"does not provide an
  export named `PLANNED_FEATURES`"* — the app mounted nothing, the page was an empty `#root`, and
  `tsc` was green because it reads the `.d.ts`. The package now emits both, with `exports` choosing.
  The same shape as `file-type` at WP-3.3 and `zod-to-json-schema` at WP-3.1, this time from inside.
- 2026-09-22 — **the E2E signed in once per test and the product locked it out.** Twenty-three tests
  meant twenty-three logins in two minutes, past FR-65's ten-in-fifteen-minutes, and the suite went
  red on `RATE_LIMITED` — the defence firing on the tests written to exercise it. One context per
  spec file, signing in once and letting the refresh cookie rotate inside it.
- 2026-09-22 — **the refresh cookie could not come back through the dev proxy.** FR-64 narrows it to
  `Path=/auth`, and behind Vite's `/api` prefix the browser sees `/api/auth` and never sends it —
  so every full page load signed the developer out. Rewritten in the proxy, which is where the
  prefix was invented; production puts the API on its own port, where the path already matches.
- 2026-09-22 — **a cold start asked `/me` without a token on purpose.** The 401 was handled and the
  refresh worked, and it still put `401 (Unauthorized)` in the console of every reload. Refreshing
  first removes the round trip and the noise. It also had to go through the deduplicating path:
  React StrictMode runs effects twice in development, and two refreshes of a single-use token look
  exactly like the replay that revokes the family.
- 2026-09-22 — **rule 2 caught the composition root, and it was right to.** Nothing may reach the
  connectors except `governance/execution.gateway.ts`, and Nest has to be handed the module to
  register its route. Exempting `app.module.ts` opened a hole — it could then import any file under
  `connectors/` — so a second rule keeps the exemption to the module file alone. Both halves were
  checked with the import that must still be refused.
- 2026-09-22 — **"no console error" would have failed against a correct build.** Chromium logs every
  failed request as a console error, and the `ComingSoon` panels call their endpoints on purpose to
  show the server's 403 or 501. Those two statuses are excluded by name; everything else, and every
  uncaught exception, still counts.

## Interpretations

- 2026-09-22 — **twenty-two routes: design §8.1's twenty-one, plus `Search documents`.** Recorded in
  `routes.ts` as `designRow: null`, the only route with no §8.1 row, and counted separately by the
  inventory check so the two numbers never blur.
- 2026-09-22 — **the paths are chosen here.** Design §8.2 gives the navigation map and no URLs. The
  administration area is `/admin/*` because the proving command navigates a Member into it.
- 2026-09-22 — **`/` redirects to `/search`.** §8.1 makes `Ask` the default screen and `Ask` is 2B;
  the Phase 1 default is the screen that answers.
- 2026-09-22 — **a `ComingSoon` panel calls its own endpoint.** That is what turns "the web app
  makes no security decision" from a sentence in Detail into something a test can watch: the panel
  renders the server's refusal, and `authorisation.spec.ts` asserts the API was asked.

## Deviations

- 2026-09-22 — **`FEATURE_STATUS` grew from eight entries to eleven.** The WP-3.5 gate built it from
  §7.1's unbuilt modules, and three modules §7.1 calls "Full" are full only for Phase 1: `ingestion`
  finishes in 2A, `audit` in 2D, `egress` in 3C, and each owns a screen. The shape settled at that
  gate — one entry per module, phase from §7.1 — is unchanged.
- 2026-09-22 — **the eight `501` controllers were pulled forward**, with `@Roles` from the existing
  matrix actions, so the matrix stays at 77 and eleven new routes carry a decision. Their contract
  tests remain `T-5.5-01`'s; what landed here is the shape one suite asserts, because this package's
  proving command rests on it.
- 2026-09-22 — **`SEED_MEMBER_PASSWORD` was added** beside `SEED_ADMIN_PASSWORD`. Proving that a
  Member is refused needs a Member who can sign in, and the seed sets no password but the admin's.
- 2026-09-22 — **`NO_PROXY` gained `api` and `web`.** The list is the internal services, and those
  two were missing because nothing had driven a browser at them before; Chromium sent
  `http://web:5173` to Squid, which denied it.
- 2026-09-22 — **the E2E runner is built on the project's Node**, not on the Playwright image. That
  image ships Node 24, the workspace pins `>=22.13 <23` with `engine-strict`, and running the tests
  on a runtime the product never uses is the stand-in this project already has a rule about.

## Tradeoffs

- 2026-09-22 — **react-router 7.18.4, not 8.4.0.** Both satisfy their peers against React 19.3. A
  major-version move is not something to fold into a package with twelve tasks, and the code here is
  written against the API that is settled. Revisit when WP-3.6's screens are stable.
- 2026-09-22 — **the workspace list counts documents with one request per workspace.** `GET
  /workspaces` carries no count, so the cards fetch each workspace's listing. Two workspaces today;
  it is the wrong shape at two hundred. See the open question.

## Open questions

- 2026-09-22 — **where does a workspace's document count belong?** `GET /workspaces` returns no
  count, so the cards issue one listing request per workspace. Does the endpoint gain `documentCount`
  and `indexedCount`, or does the screen stop showing them? · **for the gate**
- 2026-09-22 — **`ToolsService.catalogueFor` still has no caller.** WP-3.5 built the role-filtered
  catalogue and `GET /tools` is a `501` stub, because tool administration is 3A. The query, its
  compiled-SQL spec and its integration spec all exist and nothing in the running system reaches
  them. Does `GET /tools` become real for the caller's own catalogue, or does it wait for 3A?
  · **for the gate**
- 2026-09-22 — **the E2E leaves a document behind on every run.** Content has to differ each time or
  `dv_content_unique` refuses it, and Phase 1 has no delete endpoint, so the seeded corpus grows by
  one per run. Harmless in development; it is the shape that makes a CI database drift. · **for the
  gate**

## Proof

**What a command demonstrated**

- `docker compose --profile e2e run --rm e2e` — **28 of 28 Playwright tests pass**. All twenty-two
  routes render with no console error; each of the seventeen planned screens shows its phase and its
  description; a Member typing `/admin/users`, `/admin/restore`, `/admin/connectors` or
  `/admin/evaluation` sees `403 AUTHZ_ROLE_FORBIDDEN` and the network shows the API was asked; an
  Administrator on the same screen sees `Arrives in phase 4A` instead. The flow uploads
  `hợp đồng thử nghiệm <run>.md`, reaches `indexed`, and finds the passage again with the file name
  and a character span.
- `node apps/web/scripts/check-screen-inventory.mjs` — `21 screens in design §8.1, 22 routes
  declared (1 outside §8.1), 0 problems`; renaming one route reports both halves and exits 1.
- `node apps/api/scripts/check-route-decisions.mjs` — **27 routes decided, 0 without a decision.**
- `depcruise` — no violations over `apps/api/src` (205 modules) or `apps/web/src` (37 modules). Four
  controls run: `retrieval` reaching into `connectors` is refused; `app.module.ts` reaching past the
  connectors module is refused; `apps/web` importing a workspace package other than `shared-types`
  is refused; disabling the `ComingSoon` probe turns `authorisation.spec.ts` red.
- `pnpm --filter @ei-ai/api test:coverage` — 985 unit tests, 100 % lines, 99.8 % branches.
  `test:integration` — 73 tests across 9 files, 11 of them the new `501` contract.
- `pnpm --filter @ei-ai/web build` — 1 977 modules, 425 kB (134 kB gzipped). `typecheck` and `lint`
  clean on both apps.

**What needs the reader's hands**

The web app is at **http://localhost:4173**, the API at **http://localhost:4180**. Sign in as
`admin@ei-ai.local` or `member@ei-ai.local` with the passwords in `.env`. Nothing automated judges
whether a screen is legible, so these are the pages to look at and what a pass looks like on each.

| # | Page | What to do | A pass looks like |
| --- | --- | --- | --- |
| 1 | `/login` | Sign in with a wrong password eleven times | The eleventh says the account is **locked**, not "incorrect" — a different sentence, not a different wording of the same one |
| 2 | `/login` | Sign in as the Administrator | Lands on `/search`; the sidebar appears with a phase badge beside every unbuilt item |
| 3 | any page | Press reload | You stay signed in, and the browser console has no red line. The access token is thrown away on reload and fetched again from the cookie |
| 4 | sidebar | Read the line under the navigation | `Documents: on · Web search: off · ERP: not configured` — FR-79's status line, computed, not configured |
| 5 | `/workspaces` | Look at the two cards | Each says `N documents · M indexed`; Legal and Finance are both there |
| 6 | `/workspaces/<id>` | Read the table | State, pages, size and date per row; a failed row shows its reason under the state |
| 7 | `/workspaces/<id>/upload` | Drop a `.md` file with a **Vietnamese filename** | The row shows the filename with its diacritics intact and `Stored · uploaded` |
| 8 | `/workspaces/<id>` | Go back and watch, without touching anything | The state moves `uploaded → parsing → … → indexed` **on its own**, within a few seconds |
| 9 | `/workspaces/<id>/upload` | Drop the same file again | `DOC_DUPLICATE` in the row, in words — the database refused it and the screen says so |
| 10 | `/search` | Ask a question in Vietnamese, scope All | Passages with the file name, chunk number, character span and pages. The line under the heading says no text is generated |
| 11 | `/search` | Narrow the scope to one workspace | Results come only from it |
| 12 | `/ask`, `/turns/…`, `/approvals`, `/audit` | Open each | A panel naming what the screen will do and **the phase it arrives in** — never a blank page, never a dead link |
| 13 | `/admin/tools`, `/admin/health`, `/admin/users`, `/admin/restore`, `/admin/connectors`, `/admin/egress`, `/admin/evaluation` | Open each as the Administrator | Same: a description and a phase |
| 14 | — | Sign out, sign in as `member@ei-ai.local`, then **type** `/admin/users` in the address bar | A red panel reading `403 AUTHZ_ROLE_FORBIDDEN` — the **server** refused. Not a blank page, and not a screen the router quietly hid |
| 15 | sidebar | As the Member, look at the badges | They still show; hiding an item is tidiness, and the refusal above is the security |

The fifteen wireframes inside the panels and the accessibility pass are **WP-5.5**. Today each panel
is a description and a phase, which Detail says is already better than a dead link.

**What was skipped on purpose**

- **Contract tests for every `501` route** stay `T-5.5-01`'s. What landed here is the shape asserted
  on five of them; the remaining routes are untested for shape. The risk: a stub added later could
  answer 404 or omit `plannedPhase` and nothing would say so until WP-5.5.
- **The E2E runs on Chromium only.** No second engine, and no visual regression. The risk: a layout
  that breaks in Firefox or Safari passes here.
- **CI stage 6d has never run on CI.** It is written and the images build locally; the first real
  run is the next push. The risk: a job that is green locally and red on a runner, which is what
  happened to `verify-egress.sh`.

## Gate · closed 2026-09-22

Twelve tasks, 72/72 h. The proving command passed: twenty-two routes render with no console error,
a Member's direct navigation to an admin route yields `403 AUTHZ_ROLE_FORBIDDEN` from the server,
and the search screen returns passages for a seeded query — 28 of 28 Playwright tests, with the
fifteen-step manual walk above checked by hand.

G3 is complete: every task in the group is built.

**Promoted to CLAUDE.md** — three rules, from the diary above:

- *Arithmetic written in prose is arithmetic nobody has done* — "5 real + 16 planned = 21" against
  design §8.1's twenty-one rows and twenty-two routes.
- *A screen that shows a state which changes on its own has to ask again* — the documents table
  frozen at `embedding` three minutes after the database said `indexed`, with every API test green.
- *A test suite is a caller, and the product's defences apply to it* — twenty-three sign-ins in two
  minutes tripping FR-65, the lockout firing on the suite written to exercise it.

**Carried to Progress §3** — `Q-28`, `Q-29`, `Q-30`.

**Not promoted.** The ESM/CommonJS failure is already covered by *A library your build cannot load
is not a candidate*, which names the WP-3.1 shape almost exactly; what WP-3.6 adds is that it
applies to your own workspace packages, and that belongs in the existing rule's story rather than a
new one. The rule-2 loosening is covered by *A rule that fires is not yet a rule that discriminates*,
whose near-miss control is what caught the hole.

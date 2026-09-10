# Ei-AI — Phase 1 · Task breakdown

> The executable layer of the Phase 1 plan. [Overview](./ei-ai-phase-1-overview.md) sets the five priority groups; [Detail](./ei-ai-phase-1-detail.md) opens them into 20 work packages; this document opens each package into individual tasks — one sitting, one commit, one verifiable result.

| Field | Value |
| --- | --- |
| Version | 0.1 — **draft for review** |
| Date | 2026-09-10 |
| Contents | **149 tasks · 688 hours · 86 person-days** across 20 packages |
| Pairs with | [Overview](./ei-ai-phase-1-overview.md) · [Detail](./ei-ai-phase-1-detail.md) |

**How to read it.** Ids are `T-<package>-<nn>` and are stable — a dropped task keeps its id retired rather than reused. Lanes: `L` tech lead / backend · `B2` second backend · `FE` frontend · `ML` Python/ML · `DO` DevOps. Hours are working hours at 8 h per person-day; **every package's task hours sum exactly to its person-day figure in the detail document**, so the three layers cannot drift without the arithmetic showing it.

**How to use it.** Tasks inside a package run in listed order unless the `Depends` note says otherwise; the package-level dependency is stated above each table. "Done when" is the acceptance test — if it cannot be demonstrated, the task is not done, and a package is closed only when its detail-document proving command passes.

---

## 1. Summary

| Group | Package | Tasks | Hours | pd | Lanes |
| --- | --- | --- | --- | --- | --- |
| **G1** | WP-1.1 Repo, toolchain, Compose, Dev Container | 12 | 48 | 6 | DO 32 · L 16 |
| | WP-1.2 Schema, migrations, seed | 10 | 40 | 5 | L 32 · B2 8 |
| | WP-1.3 Base CI — stages 1–3, 5, 6 | 6 | 24 | 3 | DO 16 · L 8 |
| **G2** | WP-2.1 Invariant database constraints | 6 | 16 | 2 | L 16 |
| | WP-2.2 Egress default-deny | 6 | 24 | 3 | DO 16 · L 8 |
| | WP-2.3 Retrieval with the permission predicate | 11 | 48 | 6 | L 48 |
| | WP-2.4 Audit, append-only | 8 | 32 | 4 | B2 32 |
| | WP-2.5 Architecture rules in CI | 7 | 16 | 2 | L 8 · DO 8 |
| **G3** | WP-3.1 Identity | 12 | 56 | 7 | B2 56 |
| | WP-3.2 Authorisation | 8 | 40 | 5 | B2 40 |
| | WP-3.3 Workspaces, upload, storage | 9 | 40 | 5 | L 40 |
| | WP-3.4 Markdown ingestion pipeline | 11 | 56 | 7 | L 40 · B2 16 |
| | WP-3.5 Tool registry, operating mode | 4 | 16 | 2 | L 16 |
| | WP-3.6 Web — 19 routes, four real | 12 | 72 | 9 | FE 72 |
| **G4** | WP-4.1 Corpus, OCR spike, GPU benchmark | 11 | 80 | 10 | ML 80 |
| **G5** | WP-5.1 ZIP expansion | 4 | 16 | 2 | L 16 |
| | WP-5.2 Allowlist generation from the database | 4 | 16 | 2 | L 8 · DO 8 |
| | WP-5.3 Document detail API and screen | 2 | 16 | 2 | L 8 · FE 8 |
| | WP-5.4 CI stages 7–9 | 3 | 16 | 2 | DO 16 |
| | WP-5.5 Contract tests, wireframes, accessibility | 3 | 16 | 2 | FE 12 · B2 4 |
| | **Total** | **149** | **688** | **86** | |

### 1.1 Startable on day 1, with nothing blocking them

Twenty tasks sit in wave 1 (§2): the whole of WP-1.1 except the two that follow the workspace root, CI stages 1, 2 and 5, the Squid service and its empty allowlist, the web app's providers, and the entire first half of the measurement lane.

`T-1.1-01` · `T-1.1-02` · `T-1.1-05` … `T-1.1-12` · `T-1.3-02` · `T-1.3-03` · `T-1.3-05` · `T-2.2-02` · `T-2.2-03` · `T-3.6-02` · `T-4.1-01` … `T-4.1-04`

That is 95 hours of work available before anything is blocked — 5.8 days of it DevOps and 4.5 days of it ML, which is why those two lanes should be loaded first and why the backend has only one day of unblocked work on day 1.

### 1.2 The critical path — 66 hours, 8.2 days

Computed over the dependency graph, not estimated:

```
T-1.1-01 → T-1.1-03 → T-1.2-01 → T-1.2-03 → T-1.2-10 → T-3.1-02 → T-3.1-03
 workspace   Nest app   extensions  workspaces  kysely      users +      login
                                    tables      types       Argon2id
  → T-3.1-04 → T-3.2-01 → T-3.2-02 → T-3.2-04 → T-3.2-05 → T-3.2-06 → T-3.2-07
    access      matrix as   RolesGuard  workspace   77-case    guards on   negative
    token       data                    guard       matrix     routes      tests
```

**The spine of Phase 1 is identity and authorisation, not retrieval.** That is worth knowing before staffing: the longest chain runs schema → generated types → auth → roles → matrix → wiring, and it is one person's chain — a second backend developer cannot shorten it, only work beside it.

**It also means the three-week boundary is not a sequencing problem.** 8.2 days of chain inside a 15-day window leaves room; what does not fit is the *volume* — see the schedule simulation in [overview §6](./ei-ai-phase-1-overview.md#6-capacity--the-one-thing-to-settle-before-day-1).

---

## 2. Execution order

**The package tables in §3–§7 are ordered by priority group, which is not the order the work can be done in** — ten tasks in those tables appear before something they depend on. This section is the order to pull tickets in.

Rank is by **dependency wave**: a task's wave is one more than the deepest wave among its dependencies, so every task in wave *n* can start as soon as wave *n−1* is finished, and tasks inside a wave are independent of each other. Waves are a property of the graph, not of the staffing — the ranking stays valid whatever is decided about headcount. **A wave is not a day.** Wave 12 holds 70 hours of work; how many calendar days that takes depends on how many people are in each lane.

| Wave | Tasks | Hours | BE | FE | ML | DO |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 20 | 95 | 1.0 d | 0.6 d | 4.5 d | 5.8 d |
| 2 | 13 | 71 | 2.0 d | 1.6 d | 2.8 d | 2.5 d |
| 3 | 12 | 60 | 3.5 d | 0.8 d | 1.2 d | 2.0 d |
| 4 | 16 | 63 | 5.4 d | 0.5 d | 1.5 d | 0.5 d |
| 5 | 12 | 49 | 4.6 d | 1.0 d | — | 0.5 d |
| 6 | 9 | 40 | 5.0 d | — | — | — |
| 7 | 6 | 31 | 3.9 d | — | — | — |
| 8 | 9 | 44 | 4.8 d | 0.8 d | — | — |
| 9 | 12 | 50 | 6.2 d | — | — | — |
| 10 | 9 | 35 | 4.4 d | — | — | — |
| 11 | 8 | 38 | 4.0 d | 0.8 d | — | — |
| 12 | 14 | 70 | 5.5 d | 3.2 d | — | — |
| 13 | 8 | 39 | 1.9 d | 2.2 d | — | 0.8 d |
| 14 | 1 | 3 | 0.4 d | — | — | — |

Read the shape rather than the rows: **ML and DevOps front-load and finish early** (both are done by wave 5, ML by wave 4), while **backend load grows through the middle waves and peaks at wave 9**. The lane that is idle in week 1 is the one that has 6 days of work in a single wave later — which is the argument for moving DevOps to full time in week 1 and adding backend capacity from week 2 rather than spreading everyone evenly.

The graph lives in [`tools/task-order.py`](./tools/task-order.py), which reads the task tables below for ids, lanes and hours — run it after changing any task and paste its `--table` output back into this section, so the order cannot drift from the tasks it orders.

`T-1.3-06` is split here into `T-1.3-06a` (script, backend) and `T-1.3-06b` (CI wiring, DevOps). `T-2.5-07` is a 0-hour checklist item folded into `T-2.5-01` and is not ranked.

| # | Wave | ID | Lane | h | Task | Blocked by |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | T-1.1-01 | L | 4 | pnpm 10 workspace root: package.json, pnpm-workspace.yaml,… | — |
| 2 | 1 | T-1.1-02 | L | 4 | packages/tsconfig and packages/eslint-config + Prettier co… | — |
| 3 | 1 | T-1.1-05 | DO | 5 | apps/api/Dockerfile multi-stage dev/prod, Node 22.13 + pnp… | — |
| 4 | 1 | T-1.1-06 | DO | 3 | apps/web/Dockerfile with a dev target running Vite bound t… | — |
| 5 | 1 | T-1.1-07 | DO | 3 | apps/parser/Dockerfile — Python 3.12, Docling and Tesserac… | — |
| 6 | 1 | T-1.1-08 | DO | 4 | Compose: postgres 17.2 + pgvector 0.8.0 and redis 7.4, bot… | — |
| 7 | 1 | T-1.1-09 | DO | 4 | Compose: infinity 0.0.76 with the GPU reservation and the… | — |
| 8 | 1 | T-1.1-10 | DO | 5 | Compose: two networks — backend (internal: true) for api,… | — |
| 9 | 1 | T-1.1-11 | DO | 4 | Compose: uploads volume (rw in api/worker, ro in parser) a… | — |
| 10 | 1 | T-1.1-12 | DO | 4 | .devcontainer/devcontainer.json with in-container typescri… | — |
| 11 | 1 | T-1.3-02 | DO | 2 | Stage 1 — ESLint + Prettier across the workspace | — |
| 12 | 1 | T-1.3-03 | DO | 2 | Stage 2 — tsc --noEmit in every package | — |
| 13 | 1 | T-1.3-05 | DO | 4 | Stage 5 — build api, web and parser images | — |
| 14 | 1 | T-2.2-02 | DO | 4 | Squid service on a pinned stable tag, joined to both netwo… | — |
| 15 | 1 | T-2.2-03 | DO | 2 | allowlist.conf ships empty, with a README stating that emp… | — |
| 16 | 1 | T-3.6-02 | FE | 5 | providers.tsx — TanStack Query, Zustand auth store, theme | — |
| 17 | 1 | T-4.1-01 | ML | 10 | Collect 30–50 scanned legal PDFs — Vietnamese diacritics,… | — |
| 18 | 1 | T-4.1-02 | ML | 6 | Collect 10–20 report documents with real tabular layout, p… | — |
| 19 | 1 | T-4.1-03 | ML | 12 | Hand-transcribe ~20 reference pages spread across the docu… | — |
| 20 | 1 | T-4.1-04 | ML | 8 | Docling + Tesseract spike harness — a standalone script, d… | — |
| 21 | 2 | T-1.1-03 | L | 4 | apps/api NestJS 11 scaffold: main.ts, app.module.ts, worke… | T-1.1-01 |
| 22 | 2 | T-1.3-01 | DO | 4 | .github/workflows/ci.yml skeleton — the nine stages declar… | T-1.1-02 |
| 23 | 2 | T-2.2-01 | DO | 5 | squid.conf — custom log format name (C-3), include /etc/sq… | T-1.1-10 |
| 24 | 2 | T-3.4-05 | L | 6 | D-5 decision — measure the XLM-RoBERTa tokenizer against a… | T-1.1-09 |
| 25 | 2 | T-3.4-09 | L | 6 | InfinityClient — /embeddings at batch 8, timeout, retry an… | T-1.1-09 |
| 26 | 2 | T-3.6-01 | FE | 5 | Vite 6 + React 19 + TypeScript + Tailwind 4 + shadcn/ui in… | T-1.1-06 |
| 27 | 2 | T-3.6-03 | FE | 8 | apiClient.ts — problem+json parsing, transparent refresh o… | T-3.6-02 |
| 28 | 2 | T-4.1-05 | ML | 8 | OCR run 1 over the whole corpus, with failure triage | T-4.1-04 |
| 29 | 2 | T-4.1-08 | ML | 4 | GPU — VRAM in use with BGE-M3 and the reranker both loaded | T-1.1-09 |
| 30 | 2 | T-4.1-09 | ML | 6 | GPU — embedding throughput in chunks/second at batch 8 | T-1.1-09 |
| 31 | 2 | T-4.1-10 | ML | 4 | GPU — rerank latency for 60 candidates | T-1.1-09 |
| 32 | 2 | T-5.2-03 | DO | 4 | Reload mechanism — squid -k parse then squid -k reconfigure | T-2.2-02 |
| 33 | 2 | T-5.4-03 | DO | 7 | Stage 9 — Trivy on images, npm audit --audit-level=high, v… | T-1.3-05 |
| 34 | 3 | T-1.1-04 | L | 4 | config/ — zod schema for every environment variable, fail-… | T-1.1-03 |
| 35 | 3 | T-1.2-01 | L | 4 | 001_extensions.sql — vector, unaccent, pg_trgm, pgcrypto;… | T-1.1-03, T-1.1-08 |
| 36 | 3 | T-1.2-09 | B2 | 4 | Migration runner — numbered, forward-only, applied-migrati… | T-1.1-03 |
| 37 | 3 | T-1.3-04 | L | 4 | Stage 3 — Vitest with a coverage gate of 80% on domain mod… | T-1.3-01 |
| 38 | 3 | T-2.2-04 | DO | 5 | Network verification script — no default route, service na… | T-2.2-01, T-2.2-02, T-2.2-03 |
| 39 | 3 | T-2.3-01 | L | 4 | rank-fusion.ts — RRF as a pure function, with unit tests i… | T-1.1-03 |
| 40 | 3 | T-2.5-01 | DO | 4 | dependency-cruiser installed, baseline config, CI stage 4… | T-1.3-01 |
| 41 | 3 | T-3.4-06 | L | 8 | Chunker — 200–400 tokens with 15% overlap | T-3.4-05 |
| 42 | 3 | T-3.6-04 | FE | 6 | router.tsx — all 19 routes declared, including the unbuilt… | T-3.6-01 |
| 43 | 3 | T-4.1-06 | ML | 10 | Scoring — character-level and field-level accuracy per doc… | T-4.1-03, T-4.1-05 |
| 44 | 3 | T-5.2-04 | DO | 4 | Rollback on invalid config — keep the previous file, surfa… | T-5.2-03 |
| 45 | 3 | T-5.4-02 | DO | 3 | Stage 8 — red-team harness with zero cases, printing 0 cas… | T-1.3-01 |
| 46 | 4 | T-1.2-02 | L | 4 | 002_identity.sql — users, refresh_tokens (family, single-u… | T-1.2-01 |
| 47 | 4 | T-1.2-03 | L | 4 | 003_workspaces.sql part A — workspaces, workspace_members,… | T-1.2-01 |
| 48 | 4 | T-1.2-05 | L | 4 | 004_agent.sql — conversations, turns, agent_steps, answers… | T-1.2-01 |
| 49 | 4 | T-1.2-06 | L | 5 | 005_tools_governance.sql — tools, mcp_servers, pre_authori… | T-1.2-01 |
| 50 | 4 | T-1.2-07 | L | 3 | 006_audit_egress.sql — audit_events, allowlist_entries, eg… | T-1.2-01 |
| 51 | 4 | T-1.3-06a | L | 4 | Stage 6 — migration script (empty→head, prev tag→head) | T-1.2-09 |
| 52 | 4 | T-2.1-01 | L | 3 | S-1 — immutable_unaccent(text) as IMMUTABLE PARALLEL SAFE,… | T-1.2-01 |
| 53 | 4 | T-2.5-03 | L | 2 | Rule 2 — only governance/execution.gateway.ts may import m… | T-2.5-01 |
| 54 | 4 | T-2.5-04 | L | 3 | Rule 3 — no cross-module service imports; only through por… | T-2.5-01 |
| 55 | 4 | T-2.5-05 | DO | 2 | Rule 4 — apps/web imports packages/shared-types only, neve… | T-2.5-01, T-3.6-04 |
| 56 | 4 | T-2.5-06 | DO | 2 | Rule 5 — a provider SDK may only be imported under adapter… | T-2.5-01 |
| 57 | 4 | T-3.1-01 | B2 | 5 | common/ — problem-json.filter.ts, zod-validation.pipe.ts,… | T-1.1-04 |
| 58 | 4 | T-3.4-07 | L | 6 | Chunker — character offsets and heading_path preserved thr… | T-3.4-06 |
| 59 | 4 | T-3.6-06 | FE | 4 | ComingSoon component — purpose, planned phase, and what it… | T-3.6-04 |
| 60 | 4 | T-4.1-07 | ML | 6 | Table extraction check on the report documents | T-4.1-06 |
| 61 | 4 | T-4.1-11 | ML | 6 | docs/ops/week-1-measurements.md — five numbers, each with… | T-4.1-06, T-4.1-10 |
| 62 | 5 | T-1.2-04 | L | 5 | 003_workspaces.sql part B — document_versions, pages, chun… | T-1.2-03, T-2.1-01 |
| 63 | 5 | T-1.2-10 | B2 | 4 | kysely-codegen wiring, database/db.ts, transaction.ts help… | T-1.2-03, T-1.2-09 |
| 64 | 5 | T-1.3-06b | DO | 4 | Stage 6 — CI wiring on Testcontainers Postgres | T-1.3-01, T-1.3-06a |
| 65 | 5 | T-2.1-02 | L | 2 | S-2 — partial unique index pre_auth_one_active … WHERE rev… | T-1.2-06 |
| 66 | 5 | T-2.1-03 | L | 2 | S-3 — approval_requests.decided_at, and the corrected part… | T-1.2-06 |
| 67 | 5 | T-2.1-04 | L | 3 | tools — UNIQUE (id, classification) and tools_no_write_in_… | T-1.2-06 |
| 68 | 5 | T-2.1-06 | L | 3 | S-5 — reject_mutation() plus triggers on audit_events and… | T-1.2-07 |
| 69 | 5 | T-2.2-05 | L | 5 | allowlist_entries repository and GET/POST /egress/allowlis… | T-1.2-07, T-3.1-01 |
| 70 | 5 | T-3.3-01 | L | 6 | Workspaces repository and CRUD, with archive semantics (re… | T-1.2-03, T-3.1-01 |
| 71 | 5 | T-3.4-08 | L | 3 | Offset round-trip test — slicing the source by the offsets… | T-3.4-07 |
| 72 | 5 | T-3.5-01 | L | 4 | tools repository and seed of the three internal tools; onl… | T-1.2-06 |
| 73 | 5 | T-5.5-02 | FE | 8 | Wireframe component and a layout sketch inside each of the… | T-3.6-06 |
| 74 | 6 | T-1.2-08 | L | 3 | 007_indexes.sql — HNSW on chunks.embedding halfvec_cosine_… | T-1.2-04, T-1.2-05, T-1.2-06, T-1.2-07 |
| 75 | 6 | T-2.1-05 | L | 3 | S-4 · FR-44 — pre_authorisations.classification + composit… | T-2.1-04 |
| 76 | 6 | T-2.2-06 | L | 3 | Seed one destination, document the manual reload step, and… | T-2.2-04, T-2.2-05 |
| 77 | 6 | T-2.4-01 | B2 | 6 | audit.repository.ts — canonical payload serialisation and… | T-1.2-07, T-2.1-06 |
| 78 | 6 | T-3.1-02 | B2 | 4 | users repository, Argon2id hashing, configurable password… | T-1.2-02, T-1.2-10, T-3.1-01 |
| 79 | 6 | T-3.3-02 | L | 5 | Membership endpoints — add, remove, change role | T-3.3-01 |
| 80 | 6 | T-3.3-03 | L | 5 | StoragePort + LocalFsAdapter, sha256 keying under the uplo… | T-1.1-11, T-1.2-04 |
| 81 | 6 | T-3.4-01 | B2 | 6 | BullMQ setup, queue definitions, worker.main.ts consumer e… | T-1.1-11, T-1.2-10 |
| 82 | 6 | T-5.2-01 | L | 5 | Generator — allowlist_entries → allowlist.conf, written at… | T-2.2-05 |
| 83 | 7 | T-2.3-02 | L | 6 | hybrid-search.repository.ts — the permitted CTE: membershi… | T-1.2-04, T-1.2-08 |
| 84 | 7 | T-2.4-02 | B2 | 6 | audit-transaction.interceptor.ts — opens the transaction b… | T-2.4-01, T-3.1-01 |
| 85 | 7 | T-3.1-03 | B2 | 4 | POST /auth/login with AUTH_INVALID_CREDENTIALS, timing-saf… | T-3.1-02 |
| 86 | 7 | T-3.3-04 | L | 6 | Multipart upload endpoint, 200 MB limit → DOC_TOO_LARGE | T-3.3-01, T-3.3-03 |
| 87 | 7 | T-3.4-02 | B2 | 6 | Job lifecycle — retry with back-off, failure reason persis… | T-3.4-01 |
| 88 | 7 | T-5.2-02 | L | 3 | Generator tests, including the empty case | T-5.2-01 |
| 89 | 8 | T-2.3-03 | L | 5 | Dense branch — HNSW over halfvec, candidate limit from con… | T-2.3-02 |
| 90 | 8 | T-2.3-04 | L | 5 | Lexical branch — GIN + plainto_tsquery('simple', unaccent(… | T-2.3-02 |
| 91 | 8 | T-2.4-03 | B2 | 4 | auditService.record() and the event-name taxonomy constant… | T-2.4-02 |
| 92 | 8 | T-2.5-02 | L | 3 | Rule 1 — only retrieval/hybrid-search.repository.ts may qu… | T-2.3-02, T-2.5-01 |
| 93 | 8 | T-3.1-04 | B2 | 6 | Access token — 15 minutes, issue and verify, JwtAuthGuard | T-3.1-03 |
| 94 | 8 | T-3.1-08 | B2 | 4 | login_attempts and the rate limit — 10 per account per 15… | T-3.1-03 |
| 95 | 8 | T-3.3-05 | L | 6 | Content-type sniffing by file signature vs extension → DOC… | T-3.3-04 |
| 96 | 8 | T-3.3-07 | L | 5 | documents + document_versions creation, dv_content_unique… | T-1.2-04, T-3.3-04 |
| 97 | 8 | T-3.6-07 | FE | 6 | Login screen, including the lockout message | T-3.1-03, T-3.6-03 |
| 98 | 9 | T-2.3-05 | L | 5 | Full outer join, fusion, RETRIEVAL_KEEP_TOP, RETRIEVAL_REL… | T-2.3-01, T-2.3-03, T-2.3-04 |
| 99 | 9 | T-2.4-05 | B2 | 3 | Wire workspace, membership and permission-change events | T-2.4-03, T-3.3-02 |
| 100 | 9 | T-2.4-08 | B2 | 3 | Immutability and chain-integrity tests | T-2.4-03 |
| 101 | 9 | T-3.1-05 | B2 | 7 | refresh_tokens — family_id, single use, rotation on every… | T-3.1-04 |
| 102 | 9 | T-3.1-09 | B2 | 4 | Lockout after 10 consecutive failures → AUTH_ACCOUNT_LOCKE… | T-3.1-08 |
| 103 | 9 | T-3.1-10 | B2 | 5 | Redis revocation list, checked in the guard — a disabled a… | T-3.1-04 |
| 104 | 9 | T-3.2-01 | B2 | 5 | The permission matrix as data in shared-types — 5 system r… | T-3.1-04 |
| 105 | 9 | T-3.2-03 | B2 | 5 | Workspace role resolution from workspace_members — Owner,… | T-1.2-03, T-3.1-04 |
| 106 | 9 | T-3.3-06 | L | 3 | Format allowlist — the 10 supported formats → DOC_UNSUPPOR… | T-3.3-05 |
| 107 | 9 | T-3.3-08 | L | 2 | Download endpoint — Content-Disposition: attachment, X-Con… | T-3.3-07 |
| 108 | 9 | T-3.4-03 | B2 | 4 | Ingestion state machine — uploaded → parsing → parsed → ch… | T-3.3-07, T-3.4-02 |
| 109 | 9 | T-3.4-04 | L | 4 | Markdown pass-through "parsing" — one pages row, extractio… | T-3.3-07 |
| 110 | 10 | T-2.3-08 | L | 4 | permission-predicate.spec.ts — asserts the compiled SQL te… | T-2.3-05 |
| 111 | 10 | T-2.4-04 | B2 | 3 | Wire authentication events — success, failure, lockout | T-2.4-03, T-3.1-09 |
| 112 | 10 | T-2.4-06 | B2 | 4 | Wire upload and every ingestion state change | T-2.4-03, T-3.4-03 |
| 113 | 10 | T-3.1-06 | B2 | 4 | POST /auth/refresh with the HttpOnly, SameSite=Strict cook… | T-3.1-05 |
| 114 | 10 | T-3.2-02 | B2 | 5 | RolesGuard + @Roles() decorator, driven by that table | T-3.2-01 |
| 115 | 10 | T-3.3-09 | L | 2 | Tests — ELF-in-pdf, oversize, duplicate, unsupported format | T-3.3-05, T-3.3-06, T-3.3-07 |
| 116 | 10 | T-3.4-10 | L | 4 | Persist embeddings as halfvec, with the completeness check | T-3.4-03, T-3.4-07, T-3.4-09 |
| 117 | 10 | T-3.5-02 | L | 4 | Role filtering inside the query by min_system_role | T-3.2-01, T-3.5-01 |
| 118 | 10 | T-5.1-01 | L | 5 | ZIP expansion to 500 files, streamed rather than fully buf… | T-3.3-06 |
| 119 | 11 | T-2.3-06 | L | 6 | retrieval.service.ts, DTOs and POST /search — response car… | T-2.3-05, T-3.4-10 |
| 120 | 11 | T-3.1-07 | B2 | 6 | Reuse detection — a used refresh token revokes the whole f… | T-3.1-06 |
| 121 | 11 | T-3.2-04 | B2 | 5 | WorkspaceRoleGuard + @WorkspaceRole() decorator | T-3.2-02, T-3.2-03 |
| 122 | 11 | T-3.4-11 | L | 3 | End-to-end — upload a folder, reach indexed, expose ingest… | T-3.4-03, T-3.4-04, T-3.4-10 |
| 123 | 11 | T-3.5-03 | L | 4 | Operating-mode computation per request from enabled and re… | T-3.5-02 |
| 124 | 11 | T-3.6-08 | FE | 6 | Auth flow — guarded routes, token storage, 401 → refresh →… | T-3.1-06, T-3.6-07 |
| 125 | 11 | T-5.1-02 | L | 4 | Path-traversal and nested-archive refusal, entry-count and… | T-5.1-01 |
| 126 | 11 | T-5.1-03 | L | 4 | Per-file result summary returned to the caller | T-5.1-01 |
| 127 | 12 | T-2.3-07 | L | 4 | Question embedding through InfinityClient, cached in Redis… | T-1.1-09, T-2.3-06 |
| 128 | 12 | T-2.3-09 | L | 5 | leakage.spec.ts — B's restricted chunk appears in no resul… | T-2.3-06 |
| 129 | 12 | T-2.3-11 | L | 2 | Query-plan review of both branches at seeded volume, recor… | T-2.3-06 |
| 130 | 12 | T-2.4-07 | B2 | 3 | Wire search events with workspace scope — no document cont… | T-2.3-06, T-2.4-03 |
| 131 | 12 | T-3.1-11 | B2 | 3 | POST /auth/logout — clears the cookie, revokes the family | T-3.1-07 |
| 132 | 12 | T-3.1-12 | B2 | 4 | Integration tests — the two gate scenarios: replay-revokes… | T-3.1-07, T-3.1-09 |
| 133 | 12 | T-3.2-05 | B2 | 8 | Matrix test generator — one case per role/action pair, 77… | T-3.2-02, T-3.2-04 |
| 134 | 12 | T-3.5-04 | L | 4 | GET /me — user, roles, memberships, operatingMode, FEATURE… | T-3.1-04, T-3.5-03 |
| 135 | 12 | T-3.6-09 | FE | 6 | Workspace list — cards with document count and index status | T-3.3-01, T-3.6-06, T-3.6-08 |
| 136 | 12 | T-3.6-10 | FE | 6 | Workspace documents table — status, pages, uploader, date,… | T-3.4-11, T-3.6-06, T-3.6-08 |
| 137 | 12 | T-3.6-11 | FE | 6 | Upload screen — drag and drop, per-file progress, per-file… | T-3.3-06, T-3.6-06, T-3.6-08 |
| 138 | 12 | T-3.6-12 | FE | 8 | Search screen — query box, workspace scope, results with f… | T-2.3-06, T-3.6-06, T-3.6-08 |
| 139 | 12 | T-5.1-04 | L | 3 | Tests — traversal, nesting, over-count, mixed valid and in… | T-5.1-02, T-5.1-03 |
| 140 | 12 | T-5.3-01 | L | 8 | GET /documents/{id} detail — version history, status reaso… | T-3.4-11 |
| 141 | 13 | T-2.3-10 | L | 2 | Mutation check — remove the permitted join and confirm bot… | T-2.3-08, T-2.3-09 |
| 142 | 13 | T-3.2-06 | B2 | 6 | Guards applied to every implemented endpoint, with the doc… | T-3.2-05, T-3.3-04, T-3.5-04 |
| 143 | 13 | T-3.2-08 | B2 | 3 | Deliberate-loosening check — remove one guard, confirm the… | T-3.2-05 |
| 144 | 13 | T-3.6-05 | FE | 6 | AppShell + Sidebar, badges driven by FEATURE_STATUS | T-3.5-04, T-3.6-04 |
| 145 | 13 | T-5.3-02 | FE | 8 | Document detail screen — versions, ingestion state and rea… | T-3.6-06, T-5.3-01 |
| 146 | 13 | T-5.4-01 | DO | 6 | Stage 7 — Testcontainers integration suite (Postgres 17.2… | T-1.3-06b, T-2.3-09, T-3.2-05 |
| 147 | 13 | T-5.5-01 | B2 | 4 | Contract tests for every 501 route — code, feature, planne… | T-1.1-03, T-3.5-04 |
| 148 | 13 | T-5.5-03 | FE | 4 | Accessibility pass on the four real screens — keyboard, fo… | T-3.6-12 |
| 149 | 14 | T-3.2-07 | B2 | 3 | Negative tests — Reader cannot upload, Editor cannot chang… | T-3.2-06 |

### 2.1 The ten tasks that were out of order

Found by comparing the priority-group order in §3–§7 against the dependency graph. Every one of them would otherwise have been discovered the hard way, mid-sprint. Positions are the task's place in the package tables, counting the 148 tasks that carry hours.

| Task | Appears at | Needs | Which appears at |
| --- | --- | --- | --- |
| T-1.2-04 · `chunks` table | #16 | T-2.1-01 · `immutable_unaccent()` | #30 |
| T-2.2-05 · allowlist API | #40 | T-3.1-01 · `common/` HTTP infrastructure | #67 |
| T-2.3-06 · `POST /search` | #47 | T-3.4-10 · embeddings persisted | #105 |
| T-2.4-02 · audit transaction interceptor | #54 | T-3.1-01 · `common/` | #67 |
| T-2.4-04 · wire authentication events | #56 | T-3.1-09 · lockout | #75 |
| T-2.4-05 · wire workspace events | #57 | T-3.3-02 · membership endpoints | #88 |
| T-2.4-06 · wire ingestion events | #58 | T-3.4-03 · state machine | #98 |
| T-2.5-05 · architecture rule 4 | #65 | T-3.6-04 · the 19 routes | #114 |
| T-3.2-06 · guards on every implemented route | #84 | T-3.3-04 · upload endpoint | #90 |
| T-3.2-06 | #84 | T-3.5-04 · `GET /me` | #110 |

The first one is the one that would have hurt: **`chunks` cannot be created until the `IMMUTABLE` unaccent wrapper exists** (defect S-1), and `chunks` is what four other packages build on. The cluster in WP-2.4 says something structural — **audit wiring follows the feature it audits**, so those four tasks are late by nature and were listed early only because their package sits in G2.

Four dependencies were also **loosened** while building the graph, because the package-level statements in the detail document were stricter than the work actually is:

| Package | Detail doc says | Actually needs | Why it matters |
| --- | --- | --- | --- |
| WP-3.3 workspaces, upload | depends on T-3.2-04 (workspace guard) | the schema and `common/` — guards are wired on by T-3.2-06 | Otherwise the lead waits for the whole of identity + authorisation before touching upload |
| WP-2.3 retrieval | depends on T-3.4-10 | only T-2.3-06 onward needs indexed chunks; the query can be written against the schema | Retrieval and the pipeline overlap by about three days |
| WP-3.6 web | depends on T-3.1-03, T-3.5-04 | the shell tasks need neither — they run against a mocked client from day 1 | The frontend is not blocked in week 1 |
| WP-3.6 screens | listed in sequence | each screen needs the shell and its own route, not the previous screen | A second frontend developer can parallelise |

---

## 3. G1 · Foundation that blocks everything

### WP-1.1 · Repo, toolchain, Compose stack, Dev Container — 48 h

*Package depends on: E-4 (Docker usable from Ubuntu).*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-1.1-01 | pnpm 10 workspace root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.gitignore` | L | 4 | `pnpm install` succeeds at the root and resolves all three apps |
| T-1.1-02 | `packages/tsconfig` and `packages/eslint-config` + Prettier config, consumed by every package | L | 4 | `pnpm -r lint` and `pnpm -r typecheck` run in all packages |
| T-1.1-03 | `apps/api` NestJS 11 scaffold: `main.ts`, `app.module.ts`, `worker.main.ts`, `nest-cli.json` | L | 4 | `pnpm --filter api start:dev` serves a health route locally |
| T-1.1-04 | `config/` — zod schema for every environment variable, **fail-fast boot**, `.env.example` committed | L | 4 | Removing `DATABASE_URL` stops the process with a named error, not a stack trace |
| T-1.1-05 | `apps/api/Dockerfile` multi-stage `dev`/`prod`, Node 22.13 + pnpm 10 **pinned by digest** (C-2) | DO | 5 | `docker build --target dev` succeeds; `node -v` inside → v22.13.x |
| T-1.1-06 | `apps/web/Dockerfile` with a `dev` target running Vite bound to 0.0.0.0 | DO | 3 | Image builds; container serves on 5173 |
| T-1.1-07 | `apps/parser/Dockerfile` — Python 3.12, Docling and Tesseract installed, skeleton entrypoint | DO | 3 | `python -V` → 3.12.x; `tesseract --list-langs` includes `vie` |
| T-1.1-08 | Compose: `postgres` 17.2 + pgvector 0.8.0 and `redis` 7.4, both pinned, with healthchecks and `postgres/init` scripts | DO | 4 | `docker compose ps` shows postgres `healthy`; `\dx` lists `vector` |
| T-1.1-09 | Compose: `infinity` 0.0.76 with the GPU reservation and the `models` volume; **download weights on first boot, before the network is locked** | DO | 4 | `curl localhost:7997/embeddings` returns a 1024-dimension vector |
| T-1.1-10 | Compose: **two networks** — `backend` (`internal: true`) for api, worker, parser, web, postgres, redis, infinity; `egress` for Squid only (**C-1**) | DO | 5 | `ip route` in api shows no default route; `getent hosts postgres redis infinity` resolves all three |
| T-1.1-11 | Compose: `uploads` volume (rw in api/worker, ro in parser) and `node_modules` named volumes; **one root `.env`** via `--env-file`, wrapped in `pnpm dev` (**C-4, C-5**) | DO | 4 | `docker compose config` shows one env source; `/workspace/node_modules` is a volume, not a bind mount |
| T-1.1-12 | `.devcontainer/devcontainer.json` with in-container `typescript.tsdk`, `runServices: [api, postgres, redis]`, port 9229 forwarded, and `launch.json` with `remoteRoot: /workspace` | DO | 4 | Opening the folder in the container gives working autocomplete; a breakpoint in a controller is hit |

### WP-1.2 · Schema, migrations, seed — 40 h

*Package depends on: T-1.1-03, T-1.1-08.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-1.2-01 | `001_extensions.sql` — `vector`, `unaccent`, `pg_trgm`, `pgcrypto`; **`immutable_unaccent()`**; all five ENUM types | L | 4 | `\dx` and `\dT` list every extension and enum |
| T-1.2-02 | `002_identity.sql` — `users`, `refresh_tokens` (family, single-use, revocation), `login_attempts`, `group_mappings` | L | 4 | Tables present with their FKs and unique constraints |
| T-1.2-03 | `003_workspaces.sql` part A — `workspaces`, `workspace_members`, `documents`, `document_grants` | L | 4 | Present; `documents.current_version_id` FK deferred to part B |
| T-1.2-04 | `003_workspaces.sql` part B — `document_versions`, `pages`, `chunks` with `halfvec(1024)` and the generated `text_search` column | L | 5 | `\d chunks` shows the generated column; inserting a row populates `text_search`. **Depends on T-2.1-01** |
| T-1.2-05 | `004_agent.sql` — `conversations`, `turns`, `agent_steps`, `answers`, `claims`, `citations` | L | 4 | All present, with `agent_steps` unique on `(turn_id, seq)` |
| T-1.2-06 | `005_tools_governance.sql` — `tools`, `mcp_servers`, `pre_authorisations`, `approval_requests`, `approval_decisions`, `write_snapshots` | L | 5 | All present; constraints belong to WP-2.1 |
| T-1.2-07 | `006_audit_egress.sql` — `audit_events`, `allowlist_entries`, `egress_records`, `model_provider_settings` | L | 3 | All present |
| T-1.2-08 | `007_indexes.sql` — HNSW on `chunks.embedding halfvec_cosine_ops`, GIN on `text_search`, plus the eight from design §6.2 | L | 3 | `\di` lists all ten; `EXPLAIN` on a vector search picks the HNSW index |
| T-1.2-09 | Migration runner — numbered, forward-only, applied-migrations ledger, `migrate` / `migrate:fresh` scripts | B2 | 4 | `migrate:fresh` on an empty database reaches head with no manual step |
| T-1.2-10 | `kysely-codegen` wiring, `database/db.ts`, `transaction.ts` helper | B2 | 4 | Generated types compile; a query against a wrong column name fails typecheck |

### WP-1.3 · Base CI — stages 1–3, 5, 6 — 24 h

*Package depends on: T-1.1-02, T-1.2-09.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-1.3-01 | `.github/workflows/ci.yml` skeleton — the nine stages declared in order, pnpm store cached, unimplemented stages visibly skipped | DO | 4 | A pull request shows nine stages, five running and four marked skipped |
| T-1.3-02 | Stage 1 — ESLint + Prettier across the workspace | DO | 2 | A badly formatted file turns it red |
| T-1.3-03 | Stage 2 — `tsc --noEmit` in every package | DO | 2 | A deliberate type error turns it red |
| T-1.3-04 | Stage 3 — Vitest with a coverage gate of 80% on domain modules | L | 4 | Coverage below the gate fails the stage |
| T-1.3-05 | Stage 5 — build api, web and parser images | DO | 4 | All three images build from a clean cache |
| T-1.3-06 | Stage 6 — **empty → head**, and **previous release tag → head** (§1.3 of the detail doc) | L 4 · DO 4 | 8 | Both paths run against a Testcontainers Postgres and report the applied count |

---

## 4. G2 · Safety invariants

### WP-2.1 · Invariant database constraints — 16 h

*Package depends on: T-1.2-01. **On the critical path** — `chunks` cannot be created before T-2.1-01 exists.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-2.1-01 | **S-1** — `immutable_unaccent(text)` as `IMMUTABLE PARALLEL SAFE`, and the `chunks.text_search` generated column built on it | L | 3 | The migration applies; inserting Vietnamese text with diacritics produces an unaccented `tsvector` |
| T-2.1-02 | **S-2** — partial unique index `pre_auth_one_active … WHERE revoked_at IS NULL` | L | 2 | Two active pre-authorisations for one tool are refused; a revoked one plus a new one is accepted |
| T-2.1-03 | **S-3** — `approval_requests.decided_at`, and the corrected partial index `(expires_at) WHERE decided_at IS NULL` | L | 2 | The index is created; `\d+ approval_requests` shows the predicate with no subquery |
| T-2.1-04 | `tools` — `UNIQUE (id, classification)` and `tools_no_write_in_v1` (`classification = 'read' OR enabled = FALSE`) | L | 3 | Enabling a `write` tool is refused by the database |
| T-2.1-05 | **S-4 · FR-44** — `pre_authorisations.classification` + composite FK to `tools(id, classification)` + `CHECK (classification = 'read')` | L | 3 | Inserting a pre-authorisation for a write tool raises; the detail-doc command returns ERROR |
| T-2.1-06 | **S-5** — `reject_mutation()` plus triggers on `audit_events` and `approval_decisions`; the v1 rules removed | L | 3 | `UPDATE audit_events …` raises an exception, **not** `UPDATE 0` |

### WP-2.2 · Egress default-deny — 24 h

*Package depends on: T-1.1-10.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-2.2-01 | `squid.conf` — **custom log format name (C-3)**, `include /etc/squid/allowlist.conf`, `Safe_ports`/`CONNECT` acls, `http_access deny all` last | DO | 5 | `squid -k parse` reports no error; the container starts and stays up |
| T-2.2-02 | Squid service on a **pinned stable** tag, joined to both networks, with a log volume | DO | 4 | `docker compose ps` shows it running; the access log file exists and grows |
| T-2.2-03 | `allowlist.conf` ships **empty**, with a README stating that empty means deny and is the intended default | DO | 2 | The file is committed empty; a fresh clone denies everything |
| T-2.2-04 | Network verification script — no default route, service names resolve, **direct egress blocked with the proxy env removed** | DO | 5 | `infra/scripts/verify-egress.sh` exits 0 on a correct stack and non-zero when a default route exists |
| T-2.2-05 | `allowlist_entries` repository and `GET`/`POST /egress/allowlist`, Administrator only, zod DTOs | L | 5 | A Member receives 403; an Administrator can list and add an entry |
| T-2.2-06 | Seed one destination, document the manual reload step, and wire the network test into CI | L | 3 | The verification script runs in CI and fails the build if egress opens |

### WP-2.3 · Retrieval with the permission predicate — 48 h

*Package depends on: T-1.2-04, T-1.2-08, T-3.4-10 (needs indexed chunks to test against).*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-2.3-01 | `rank-fusion.ts` — RRF as a pure function, with unit tests including ties and single-branch hits | L | 4 | Unit tests green; the function has no database or config import |
| T-2.3-02 | `hybrid-search.repository.ts` — the `permitted` CTE: membership, workspace status, `indexed` versions, restricted-document grants | L | 6 | A user outside the workspace gets an empty candidate set, proved by SQL, not by filtering afterwards |
| T-2.3-03 | Dense branch — HNSW over `halfvec`, candidate limit from config | L | 5 | `EXPLAIN` shows an index scan, not a sequential scan |
| T-2.3-04 | Lexical branch — GIN + `plainto_tsquery('simple', unaccent($n))` | L | 5 | A part number written differently in the question is still found |
| T-2.3-05 | Full outer join, fusion, `RETRIEVAL_KEEP_TOP`, `RETRIEVAL_RELEVANCE_FLOOR` — all from config | L | 5 | Changing the floor in `.env` changes the result count with no code change |
| T-2.3-06 | `retrieval.service.ts`, DTOs and `POST /search` — response carries file name, page and character span | L | 6 | The endpoint returns passages for a seeded query, with positions that resolve |
| T-2.3-07 | Question embedding through `InfinityClient`, cached in Redis for 1 hour | L | 4 | The second identical question skips the embedding call, visible in the client's metrics |
| T-2.3-08 | `permission-predicate.spec.ts` — **asserts the compiled SQL text contains** the `permitted` CTE and the `workspace_members` join | L | 4 | Green; asserts on SQL, not on results |
| T-2.3-09 | `leakage.spec.ts` — B's restricted chunk appears in no result, no intermediate structure and no log line | L | 5 | Green, including a log-capture assertion |
| T-2.3-10 | Mutation check — remove the `permitted` join and confirm **both** tests fail; record the procedure in the package's README | L | 2 | Both go red; the procedure is written down |
| T-2.3-11 | Query-plan review of both branches at seeded volume, recorded in `docs/ops/` | L | 2 | `EXPLAIN (ANALYZE)` output committed with the date and row count |

### WP-2.4 · Audit, append-only — 32 h

*Package depends on: T-1.2-07, T-2.1-06.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-2.4-01 | `audit.repository.ts` — canonical payload serialisation and `prev_hash` → `hash` chaining | B2 | 6 | Two consecutive events link; the hash is reproducible from the row |
| T-2.4-02 | `audit-transaction.interceptor.ts` — opens the transaction before the controller, commits after | B2 | 6 | A deliberate failure in the audit write rolls back the action itself |
| T-2.4-03 | `auditService.record()` and the event-name taxonomy constants in `shared-types` | B2 | 4 | Every event name in Phase 1 is a constant, not a string literal at the call site |
| T-2.4-04 | Wire authentication events — success, failure, lockout | B2 | 3 | Eleven failed logins produce eleven events and one lockout event |
| T-2.4-05 | Wire workspace, membership and permission-change events | B2 | 3 | Each action produces exactly one event with the actor and object |
| T-2.4-06 | Wire upload and every ingestion state change | B2 | 4 | One upload of one file produces the upload event plus one per state transition |
| T-2.4-07 | Wire search events with workspace scope — **no document content in any log** | B2 | 3 | The event records the question and scope; a grep for chunk text in logs finds nothing |
| T-2.4-08 | Immutability and chain-integrity tests | B2 | 3 | `UPDATE` raises; breaking one row's hash is detectable by recomputation |

### WP-2.5 · Architecture rules in CI — 16 h

*Package depends on: T-1.3-01.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-2.5-01 | `dependency-cruiser` installed, baseline config, **CI stage 4** wired | DO | 4 | Stage 4 runs on a pull request and reports zero violations |
| T-2.5-02 | Rule 1 — only `retrieval/hybrid-search.repository.ts` may query `chunks` | L | 3 | A `chunks` query added elsewhere fails the build |
| T-2.5-03 | Rule 2 — only `governance/execution.gateway.ts` may import `modules/connectors` | L | 2 | Green today (neither exists), and red the moment a second importer appears |
| T-2.5-04 | Rule 3 — no cross-module service imports; only through `ports/` | L | 3 | An import of another module's service fails the build |
| T-2.5-05 | Rule 4 — `apps/web` imports `packages/shared-types` only, never `apps/api` | DO | 2 | An import from `apps/api` in web fails the build |
| T-2.5-06 | Rule 5 — a provider SDK may only be imported under `adapters/model-provider/` | DO | 2 | Importing `@anthropic-ai/sdk` in a module fails the build |
| T-2.5-07 | Deliberate-violation test documented, and one violation committed then reverted to prove the gate | L 0 · DO 0 | 0 | Recorded in the WP-2.5 README; time is inside T-2.5-01 |

---

## 5. G3 · The product path

### WP-3.1 · Identity — 56 h

*Package depends on: T-1.2-02, T-1.2-10, and the `common/` HTTP infrastructure (guards, `problem+json` filter, zod pipe, correlation-id interceptor) which B2 builds inside T-3.1-01 to T-3.1-03.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-3.1-01 | `common/` — `problem-json.filter.ts`, `zod-validation.pipe.ts`, `correlation-id.interceptor.ts`, `error-codes.ts`, `app-exception.ts` | B2 | 5 | Every error response is RFC 7807 with a `code`; `X-Correlation-Id` is echoed or generated |
| T-3.1-02 | `users` repository, Argon2id hashing, configurable password policy | B2 | 4 | A password under policy is refused; the stored hash is Argon2id with a unique salt |
| T-3.1-03 | `POST /auth/login` with `AUTH_INVALID_CREDENTIALS`, timing-safe on unknown accounts | B2 | 4 | Unknown email and wrong password are indistinguishable in response and in timing |
| T-3.1-04 | Access token — 15 minutes, issue and verify, `JwtAuthGuard` | B2 | 6 | A request with an expired token receives 401 with the documented code |
| T-3.1-05 | `refresh_tokens` — `family_id`, single use, rotation on every refresh | B2 | 7 | Each refresh issues a new token and marks the old one used |
| T-3.1-06 | `POST /auth/refresh` with the HttpOnly, `SameSite=Strict` cookie | B2 | 4 | The refresh token never appears in a response body or in a log |
| T-3.1-07 | **Reuse detection** — a used refresh token revokes the whole family (`AUTH_TOKEN_REUSE`) | B2 | 6 | Replaying token 1 after rotating to token 2 kills both |
| T-3.1-08 | `login_attempts` and the rate limit — 10 per account per 15 minutes | B2 | 4 | The 11th attempt inside the window is rate-limited before the password is even checked |
| T-3.1-09 | Lockout after 10 consecutive failures → `AUTH_ACCOUNT_LOCKED` (423); a success resets the counter | B2 | 4 | The 11th failure returns 423; a correct password after 9 failures clears the count |
| T-3.1-10 | Redis revocation list, checked in the guard — a disabled account loses access within 60 seconds | B2 | 5 | Disabling a user invalidates a live access token inside a minute |
| T-3.1-11 | `POST /auth/logout` — clears the cookie, revokes the family | B2 | 3 | After logout, the refresh token is dead and the access token is on the revocation list |
| T-3.1-12 | Integration tests — the two gate scenarios: replay-revokes-family, and 11-failures-locks | B2 | 4 | Both green in CI stage 7 |

### WP-3.2 · Authorisation — 40 h

*Package depends on: T-3.1-04.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-3.2-01 | The permission matrix as **data** in `shared-types` — 5 system roles × 13 actions, exactly design §9.1 | B2 | 5 | The table is the only place the matrix is written down |
| T-3.2-02 | `RolesGuard` + `@Roles()` decorator, driven by that table | B2 | 5 | Changing the table changes enforcement with no other edit |
| T-3.2-03 | Workspace role resolution from `workspace_members` — Owner, Editor, Reader | B2 | 5 | A user's effective role in each workspace is resolvable in one query |
| T-3.2-04 | `WorkspaceRoleGuard` + `@WorkspaceRole()` decorator | B2 | 5 | A Reader calling upload receives 403 with `AUTHZ_WORKSPACE_FORBIDDEN` |
| T-3.2-05 | **Matrix test generator** — one case per role/action pair, 77 in total | B2 | 8 | Reports 77/77; adding a matrix row without an implementation fails the build |
| T-3.2-06 | Guards applied to every implemented endpoint, with the documented 403 shapes | B2 | 6 | No implemented route is reachable without an explicit role decision |
| T-3.2-07 | Negative tests — Reader cannot upload, Editor cannot change membership | B2 | 3 | Both green |
| T-3.2-08 | Deliberate-loosening check — remove one guard, confirm the matrix test goes red, revert | B2 | 3 | Procedure recorded in the package README |

### WP-3.3 · Workspaces, upload, storage — 40 h

*Package depends on: T-1.2-03, T-3.2-04.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-3.3-01 | Workspaces repository and CRUD, with archive semantics (retained, out of retrieval) | L | 6 | An archived workspace still lists but returns no candidates in search |
| T-3.3-02 | Membership endpoints — add, remove, change role | L | 5 | Only an Owner can change membership; every change is audited |
| T-3.3-03 | `StoragePort` + `LocalFsAdapter`, sha256 keying under the `uploads` volume | L | 5 | The same bytes uploaded twice occupy one file on disk |
| T-3.3-04 | Multipart upload endpoint, 200 MB limit → `DOC_TOO_LARGE` | L | 6 | A 201 MB file is refused with the limit stated in the response |
| T-3.3-05 | **Content-type sniffing by file signature vs extension** → `DOC_CONTENT_MISMATCH` | L | 6 | A `.pdf` whose bytes are an ELF binary is refused |
| T-3.3-06 | Format allowlist — the 10 supported formats → `DOC_UNSUPPORTED_FORMAT` | L | 3 | An `.exe` and a `.zip` (until WP-5.1) are refused with the format list in the message |
| T-3.3-07 | `documents` + `document_versions` creation, `dv_content_unique` dedupe, `current_version_id` maintenance | L | 5 | Re-uploading identical content to the same document is refused by the constraint |
| T-3.3-08 | Download endpoint — `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, never rendered server-side | L | 2 | An HTML file uploaded and downloaded is not executed by the browser in the app's origin |
| T-3.3-09 | Tests — ELF-in-pdf, oversize, duplicate, unsupported format | L | 2 | Four tests green in CI stage 7 |

### WP-3.4 · Markdown ingestion pipeline — 56 h

*Package depends on: T-3.3-07, T-1.1-09.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-3.4-01 | BullMQ setup, queue definitions, `worker.main.ts` consumer entrypoint | B2 | 6 | `docker compose up ingest-worker` consumes a test job |
| T-3.4-02 | Job lifecycle — retry with back-off, failure reason persisted on the version | B2 | 6 | A failing job leaves `status = 'failed'` with a readable `status_reason` |
| T-3.4-03 | Ingestion state machine — `uploaded → parsing → parsed → chunking → embedding → indexed`, plus `failed` | B2 | 4 | Every transition is written and audited; an illegal transition is refused |
| T-3.4-04 | Markdown pass-through "parsing" — one `pages` row, `extraction_method = 'text_layer'` | L | 4 | A `.md` file produces exactly one page row whose text matches the file |
| T-3.4-05 | **D-5 decision** — measure the XLM-RoBERTa tokenizer against a character-ratio approximation, choose, record in `chunker_version` | L | 6 | The measurement and the decision are committed in `docs/ops/`; the choice is configurable |
| T-3.4-06 | Chunker — 200–400 tokens with 15% overlap | L | 8 | Chunk token counts fall inside the range for a 50-file corpus, verified by the chosen tokenizer |
| T-3.4-07 | Chunker — character offsets and `heading_path` preserved through the split | L | 6 | Every chunk carries `char_start`, `char_end` and its heading trail |
| T-3.4-08 | Offset round-trip test — slicing the source by the offsets reproduces `chunks.text` exactly | L | 3 | Green for every chunk of the seeded corpus, not a sample |
| T-3.4-09 | `InfinityClient` — `/embeddings` at batch 8, timeout, retry and back-off | L | 6 | A restart of the infinity container mid-run resumes without losing chunks |
| T-3.4-10 | Persist embeddings as `halfvec`, with the completeness check | L | 4 | `SELECT count(*) FROM chunks WHERE embedding IS NULL` → `0` |
| T-3.4-11 | End-to-end — upload a folder, reach `indexed`, expose ingestion status per document | L | 3 | The documents list shows the state machine advancing without a page reload |

### WP-3.5 · Tool registry and operating mode — 16 h

*Package depends on: T-1.2-06, T-3.2-01.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-3.5-01 | `tools` repository and seed of the three internal tools; only `search_documents` enabled | L | 4 | Three rows, all `read`; two disabled with the phase recorded in the description |
| T-3.5-02 | Role filtering **inside the query** by `min_system_role` | L | 4 | A Member's catalogue omits Administrator-only tools at the SQL level |
| T-3.5-03 | Operating-mode computation per request from enabled and reachable tools | L | 4 | With zero MCP servers and `web_search` off, the mode is `document-only` |
| T-3.5-04 | `GET /me` — user, roles, memberships, `operatingMode`, `FEATURE_STATUS` | L | 4 | The web app's badges and "Coming soon" panels are driven entirely by this response |

### WP-3.6 · Web — 19 routes, four of them real — 72 h

*Package depends on: T-1.1-06 for the container; T-3.1-03 and T-3.5-04 for real data — the shell tasks start on day 1 against a mocked client.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-3.6-01 | Vite 6 + React 19 + TypeScript + Tailwind 4 + shadcn/ui initialised | FE | 5 | `pnpm --filter web dev` serves; a shadcn button renders |
| T-3.6-02 | `providers.tsx` — TanStack Query, Zustand auth store, theme | FE | 5 | A page can read the current user from the store |
| T-3.6-03 | `apiClient.ts` — `problem+json` parsing, transparent refresh on 401, `X-Correlation-Id` propagation | FE | 8 | An expired access token is refreshed and the original request retried, once |
| T-3.6-04 | `router.tsx` — **all 19 routes declared**, including the unbuilt ones | FE | 6 | Every route in design §8.1 resolves to a component |
| T-3.6-05 | `AppShell` + `Sidebar`, badges driven by `FEATURE_STATUS` | FE | 6 | Flipping a flag in `GET /me` moves an item between "ready" and "coming soon" |
| T-3.6-06 | `ComingSoon` component — purpose, planned phase, and what it will do | FE | 4 | Fifteen routes render it with their own text, none of them blank |
| T-3.6-07 | Login screen, including the lockout message | FE | 6 | A locked account shows an explanation, not a generic failure |
| T-3.6-08 | Auth flow — guarded routes, token storage, 401 → refresh → retry, logout | FE | 6 | Reloading the page keeps the session; logout clears it everywhere |
| T-3.6-09 | Workspace list — cards with document count and index status | FE | 6 | Counts match the API; an archived workspace is visibly marked |
| T-3.6-10 | Workspace documents table — status, pages, uploader, date, per-row actions | FE | 6 | Ingestion state changes appear without a manual refresh |
| T-3.6-11 | Upload screen — drag and drop, per-file progress, per-file result with the rejection reason | FE | 6 | A mixed batch shows accepted and rejected files with distinct reasons |
| T-3.6-12 | **Search screen** — query box, workspace scope, results with file name and position, **no generated text** | FE | 8 | Results are passages from documents; nothing on screen is model-written |

---

## 6. G4 · Measurement — the parallel lane

### WP-4.1 · Corpus, OCR spike, GPU benchmark — 80 h

*Package depends on: E-4 only. Touches no product code and blocks nobody; T-4.1-08 onward needs `infinity` up from T-1.1-09.*

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-4.1-01 | Collect 30–50 scanned legal PDFs — Vietnamese diacritics, stamps, multi-column, mixed quality | ML | 10 | The corpus is committed to a location outside git (with a manifest in git) and classified by document type |
| T-4.1-02 | Collect 10–20 report documents with real tabular layout, plus the `.md` sample set | ML | 6 | Manifest lists every file with its class and provenance |
| T-4.1-03 | **Hand-transcribe ~20 reference pages** spread across the document classes | ML | 12 | The reference is committed; each page names its source file and page number |
| T-4.1-04 | Docling + Tesseract spike harness — a standalone script, deliberately outside the product | ML | 8 | `python spike/ocr_bench.py --corpus …` produces per-page output and a summary |
| T-4.1-05 | OCR run 1 over the whole corpus, with failure triage | ML | 8 | Every file either produces text or a recorded reason for failing |
| T-4.1-06 | Scoring — character-level and field-level accuracy **per document class** | ML | 10 | A table, not an average: an average across classes hides the case that matters |
| T-4.1-07 | Table extraction check on the report documents | ML | 6 | Recorded per document: cells preserved, merged, or lost |
| T-4.1-08 | GPU — VRAM in use with BGE-M3 and the reranker both loaded | ML | 4 | `nvidia-smi --query-gpu=memory.used --format=csv` recorded with both models resident |
| T-4.1-09 | GPU — embedding throughput in chunks/second at batch 8 | ML | 6 | A number, with the corpus and chunk size it was measured on |
| T-4.1-10 | GPU — rerank latency for 60 candidates | ML | 4 | p50 and p95 over at least 100 runs |
| T-4.1-11 | `docs/ops/week-1-measurements.md` — five numbers, each with its method, plus the **R-01 recommendation** | ML | 6 | The document states plainly: proceed, or trigger the fallback |

**The number that can change the plan is T-4.1-06.** Below 90% triggers R-01 — commercial OCR at roughly $1.50 per 1,000 pages, or a narrower v1 format list stated plainly to the customer. That decision belongs to week 3.

---

## 7. G5 · Pre-agreed slack

Cut in package order — WP-5.1 first — if capacity runs short. Each package names where it lands instead (detail §6).

### WP-5.1 · ZIP expansion — 16 h · L

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-5.1-01 | ZIP expansion to 500 files, streamed rather than fully buffered | L | 5 | A 500-file archive expands without exhausting container memory |
| T-5.1-02 | Path-traversal and nested-archive refusal, entry-count and total-size limits | L | 4 | A `../` entry and a zip-in-zip are both refused with a named code |
| T-5.1-03 | Per-file result summary returned to the caller | L | 4 | The response lists every entry as accepted or rejected with its reason |
| T-5.1-04 | Tests — traversal, nesting, over-count, mixed valid and invalid entries | L | 3 | Four tests green |

### WP-5.2 · Allowlist generation from the database — 16 h

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-5.2-01 | Generator — `allowlist_entries` → `allowlist.conf`, written atomically | L | 5 | The file is replaced by rename, never partially written |
| T-5.2-02 | Generator tests, including the empty case | L | 3 | Zero entries produces a file that denies everything |
| T-5.2-03 | Reload mechanism — `squid -k parse` then `squid -k reconfigure` | DO | 4 | Adding an entry takes effect without dropping in-flight connections |
| T-5.2-04 | Rollback on invalid config — keep the previous file, surface the error | DO | 4 | A deliberately malformed entry leaves Squid running on the last good config |

### WP-5.3 · Document detail — 16 h

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-5.3-01 | `GET /documents/{id}` detail — version history, status reasons, chunk and page counts, grants | L | 8 | Every field the screen needs comes from one request |
| T-5.3-02 | Document detail screen — versions, ingestion state and reason, permissions | FE | 8 | A failed ingestion shows its reason on the screen, not only in the log |

### WP-5.4 · CI stages 7–9 — 16 h · DO

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-5.4-01 | Stage 7 — Testcontainers integration suite (Postgres 17.2 + pgvector, Redis) | DO | 6 | Migrations, permission matrix and leakage tests run in CI |
| T-5.4-02 | Stage 8 — red-team harness with **zero cases**, printing `0 cases — agent loop lands in 2B` | DO | 3 | The stage passes and says why it is empty |
| T-5.4-03 | Stage 9 — Trivy on images, `npm audit --audit-level=high`, versioned push to GHCR | DO | 7 | A tagged commit publishes three images with the version in the tag |

### WP-5.5 · Contract tests, wireframes, accessibility — 16 h

| ID | Task | Lane | h | Done when |
| --- | --- | --- | --- | --- |
| T-5.5-01 | Contract tests for every `501` route — `code`, `feature`, `plannedPhase` | B2 | 4 | Each stub is covered; a stub returning 404 fails the test |
| T-5.5-02 | `Wireframe` component and a layout sketch inside each of the 15 "Coming soon" panels | FE | 8 | Every unbuilt screen shows the shape of what is coming |
| T-5.5-03 | Accessibility pass on the four real screens — keyboard, focus order, contrast, labels | FE | 4 | axe reports no critical violations on those four |

---

## 8. Conventions

**One task, one commit, one verifiable change.** The commit message starts with the task id: `T-2.3-02: permitted CTE in hybrid search`. A task that cannot be finished in one sitting was estimated wrong — split it and give the halves `a`/`b` suffixes rather than letting it run for three days.

**A task is done when its "Done when" is demonstrable**, not when the code is written. Three consequences, and they are the point of the column:

- a task that changes behaviour carries the test that proves it, in the same commit;
- a task whose proof needs a running stack says so in its "Done when", and is not marked done from a unit test alone;
- the four **mutation checks** (T-2.3-10, T-3.2-08, T-2.5-07, and the S-5 check in T-2.1-06) are done only when the deliberate break has actually been made and reverted. A guard nobody has seen fail is a guard nobody knows works.

**Package closure** needs the detail document's proving command for that package, not just every task ticked.

**Which day each task lands on** depends on staffing, so it is not stamped on the ticket. §2 gives the order, which does not move; [detail §9](./ei-ai-phase-1-detail.md) gives one possible fifteen-day, five-lane layout, and [overview §6](./ei-ai-phase-1-overview.md) gives what the simulation says it actually costs.

---

## 9. Deliberately not tasks in Phase 1

Listed so nobody adds them by reflex, and so the absences read as decisions rather than oversights.

| Not now | Where it lives |
| --- | --- |
| The agent loop, step persistence, SSE step events | Milestone 2B |
| Draft generation, the verifier, claim filtering, citations, streaming | Milestone 2C |
| Wiring the Python parser and OCR into the pipeline | Milestone 2A |
| The cross-encoder reranker **in the retrieval path** (it is wired, not enabled) | Milestone 2A |
| Document versioning and purge (FR-07, FR-08) | Milestone 2A |
| OIDC login, group mapping | Milestone 2D |
| Audit chain **verification**, search and export | Milestone 2D |
| The eval harness and the golden set — though **the customer's 2 h/week must be asked for in week 3** | Milestone 2D · week 4 |
| The allowlist admin **UI** and egress reconciliation | Milestone 3C |
| MCP client, approval gate, external provider administration | Phase 3 |
| The health dashboard's 11 indicators, alerts, backup and restore | Phase 4 |
| Any line of generated text, anywhere | **Never in Phase 1** |

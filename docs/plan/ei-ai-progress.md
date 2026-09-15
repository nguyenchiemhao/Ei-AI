# Ei-AI — Progress tracker

> **The single place status is recorded.** The plan documents say *what* the work is and *when it is done*; this document says *where it stands*. Nothing here re-describes a task — every row points back to its authority, so a task edited there and not here shows up as a mismatched id rather than as silent drift.

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Updated | 2026-09-15 |
| Phase in flight | **Phase 1 · Foundation** — **G1 complete**, WP-2.1 · WP-2.2 closed, WP-2.5 🔎 |
| Blocking decisions | **none open** — D-1, D-2 closed; Q-07…Q-09 closed at the WP-1.1 gate; Q-10, Q-11 opened at the WP-1.2 gate |
| Code written | WP-1.1 the stack boots; WP-1.2 the schema migrates and seeds; T-2.1-01 and T-2.2-02/03 borrowed |
| Phase 1 progress | **45 / 154 tasks · 162 / 700 h** — all closed at their gates; `T-2.2-05` deferred |

**Authorities.** [Implementation plan](./ei-ai-implementation-plan.md) — phases, gates, dependencies · [Phase 1 · Overview](./ei-ai-phase-1-overview.md) — priority groups and the pre-agreed cut · [Phase 1 · Detail](./ei-ai-phase-1-detail.md) — 20 packages, one proving command each · [Phase 1 · Tasks](./ei-ai-phase-1-tasks.md) — the 149 tasks and their "Done when" · [Development environment](./ei-ai-dev-environment.md) — the machine and the stack.

---

## 1. How to use this file

| Mark | Means |
| --- | --- |
| ⬜ | Not started |
| 🟡 | In progress — someone is on it now |
| 🔎 | Awaiting review — the work is finished, the gate is open |
| ↩ | Sent back — the review rejected it, and it is being reworked |
| ✅ | Done, and its "Done when" was demonstrated |
| 🚫 | Blocked — the note says by what |
| ⏭ | Deferred or cut — the note says where it went |

**Five rules.**

1. **A row moves to ✅ only when the "Done when" in [Tasks](./ei-ai-phase-1-tasks.md) has actually been demonstrated** — not when the code is written. A task whose proof needs a running stack is not closed by a unit test.
2. **Nothing reaches ✅ by the hand that did the work.** Finished work moves to 🔎 and waits there; the review either closes it or sends it back to ↩ with the reason. 🟡 straight to ✅ is a review that did not happen, not a review that went quickly.
3. **A package closes only when its proving command in [Detail](./ei-ai-phase-1-detail.md) passes**, even if every task under it is ticked.
4. **Status changes travel in the same commit as the work.** The commit message starts with the task id (`T-2.3-02: permitted CTE in hybrid search`), so `git log --grep` reconstructs this file at any point in the past.
5. **Never widen scope here.** A task that turns out to be two tasks is split in the task document first, with `a`/`b` suffixes, and then appears here.

Only ⬜ needs no note. Every other mark carries one: a date for ✅, a name or a branch for 🟡, the date the gate opened for 🔎, the reason it came back for ↩, the blocker for 🚫, the destination for ⏭.

---

## 2. Where the project stands today

| Area | State | Evidence |
| --- | --- | --- |
| System design — 80 FRs, 22 NFRs, 11 ADRs | ✅ Written | [design](../design/ei-ai-agentic-knowledge-assistant.md), 1,674 lines |
| Implementation plan — 4 phases | ✅ Written, **still marked draft awaiting review** | [plan](./ei-ai-implementation-plan.md) §1 |
| Phase 1 — three planning layers | ✅ Written, **all three marked `0.1 draft for review`** | overview · detail · tasks |
| Development environment | ✅ Verified green except three manual steps | [dev env](./ei-ai-dev-environment.md) §4.4 |
| **Product code** | ✅ **WP-1.1 closed** — `package.json`, `apps/{api,web,parser}`, `packages/`, `infra/`, `.devcontainer/` exist and the stack boots. No `.github/` yet (WP-1.3) | WP-1.1 proving command, 2026-09-14 |
| `docs/ops/week-1-measurements.md` | ⬜ Expected output of WP-4.1 | directory does not exist yet |

### 2.1 Entry conditions — re-verified 2026-09-10, E-4 again on 2026-09-12

Overview §7 listed E-4 and E-5 as failing. Both are now closed, and both rows are corrected there too.

| # | Condition | State | Verified by |
| --- | --- | --- | --- |
| E-1 | Source on ext4 in WSL2, tree clean and pushed | ✅ | `df -T .` → `/dev/sdd ext4`; `git rev-list --count origin/main..HEAD` → `0` |
| E-2 | GPU visible from Ubuntu | ✅ | `nvidia-smi` → RTX 3050 Ti, 4096 MiB, driver 581.95 |
| E-3 | WSL memory capped at 18 GB | ✅ | dev env §4.4 B2 — 17.6 GB reported |
| E-4 | Docker usable from Ubuntu | ✅ **re-verified 2026-09-12** | `docker ps` → OK; Docker 29.4.3, Compose v5.1.3; `docker run --gpus all` sees the RTX 3050 Ti. **Conditional on Docker Desktop running** — with it stopped, `docker` is not found in the distro at all, and every WP-1.1 proof fails |
| E-5 | Repository visibility decided | ✅ **public**, decided 2026-09-10 | D-1 below — a personal research project, published deliberately |
| E-6 | Second backend available from day 1 | ⏭ **Moot** — D-2 decided option D, a single operator | §3.2 |

### 2.2 Development environment — the three manual steps

| Step | State | Note |
| --- | --- | --- |
| B4a · VS Code extensions | ✅ Effectively done | `~/.vscode-server/extensions` exists inside Ubuntu — the server runs in WSL |
| B4b · Open in Remote-WSL | ✅ Done | this session is rooted at `/home/howie/ei-ai` |
| B6 · Retire the Windows copy | ⬜ Not done | `/mnt/d/Data/Ei-AI` still exists; rename it to `.moved` when convenient |
| Step 8 · Dev Container verification | ⬜ Not yet possible | needs `T-1.1-12`; the checks are dev env §9.2–9.5 |

---

## 3. Decisions and dependencies that gate the work

Copied from [plan §10](./ei-ai-implementation-plan.md) and [overview §9](./ei-ai-phase-1-overview.md). A row here is not a reminder — it is a dated commitment or an open blocker.

| # | Question | Needed by | State |
| --- | --- | --- | --- |
| ~~D-1~~ | ~~Public or private repository?~~ | — | ✅ **Decided 2026-09-10: public** — see §3.1 |
| ~~D-2~~ | ~~Capacity — option A, B or C?~~ | — | ✅ **Decided 2026-09-12: option D** — single operator, wave order, no date commitment. See §3.2 |
| D-3 | Is the G5 list accepted as the pre-agreed cut? | before week 3 | ⬜ Open |
| D-4 · Q-05 | Who gives 2 hours per week from week 4 for the golden set? **The ask must be made in week 3** | week 3 | ⬜ Open |
| Q-04 | Anthropic API key. **Phase 1 makes no generation call — first needed in week 7**, not week 1 | week 7 | ⬜ Open |
| Q-01 | ~200 real customer documents, including scans, to close R-01 | week 8 | ⬜ Open |
| Q-02 | Real ERP tool catalogue with read/write classification. **Ask in week 10, not week 13** | week 10 | ⬜ Open |
| Q-06 | Identity provider confirmed, and whether OIDC is available | week 12 | ⬜ Open |
| Q-03 | Hardware budget and tier. **Do not buy before the trajectory numbers exist** | week 16 | ⬜ Open |
| ~~Q-07~~ | ~~The ingress service is scope no Phase 1 task names~~ | — | ✅ **Closed 2026-09-14: its own id, `T-1.1-13`** |
| ~~Q-08~~ | ~~`task-order.py` cited but never committed~~ | — | ✅ **Closed 2026-09-14: discarded.** The wave table is maintained by hand and Tasks §2 no longer cites it |
| **Q-12** | CI reports but does not **gate**: run #2 pushed a broken commit onto `dev` and nothing stopped it. Branch protection with required status checks is GitHub configuration rather than code, so no task can carry it — who turns it on, and when? | before the Phase 1 gate | ⬜ Open |
| ~~Q-10~~ | ~~The host tunnel to the database that no task names~~ | — | ✅ **Closed 2026-09-15: its own id, `T-1.1-15`** |
| **Q-11** | **Deferred to FR-54's design, 2026-09-15.** `write_snapshots` was given a shape — target system's own `target_kind`/`target_id`, `before_state` verbatim, one snapshot per step — from the undo feature's intent rather than from a design. Confirm or replace it when FR-54's undo path is actually designed | Phase 3 · milestone 3B | ⬜ Open |
| ~~Q-09~~ | ~~No task creates the `llamacpp` service the `dev-local` gate line needs~~ | — | ✅ **Closed 2026-09-14: `T-1.1-14`.** `compose.gpu.yml` stays removed — the GPU reservation belongs on the service |

### 3.1 What the public-repository decision commits us to

**Decided 2026-09-10: the repository stays public.** It is a personal research project, so the design, the effort figures and the hardware budgets are published on purpose.

The decision moves the risk rather than removing it: with a public tree, **the `.gitignore` is now a disclosure control, not housekeeping.** Three things must never be committed, and each has a name and a date already:

| What | When it arrives | Guard |
| --- | --- | --- |
| The WP-4.1 proxy corpus — scanned legal PDFs and report documents | week 1 · `T-4.1-01`, `T-4.1-02` | It has no home in the repository layout ([detail §7](./ei-ai-phase-1-detail.md)) and must not get one. Whatever directory it lands in gets a `.gitignore` entry in the same commit |
| The ~200 real customer documents of Q-01 | week 8 | Same, and `uploads/` and `storage/` are already ignored |
| Real customer names, in the design or in the golden set | week 4 onward, `eval/golden-set/` | The golden set is committed by design — it must carry questions, not identifiable business data |

`.gitignore` today already covers `uploads/`, `storage/`, `models/`, `.env*` and the weight files. **It does not cover a corpus directory, because no path is defined yet** — that is a condition on `T-4.1-01`, not a task of its own.

### 3.2 What the capacity decision commits us to

**Decided 2026-09-12: option D — a single operator, working the wave order, with no date commitment.** Options A, B and C in [overview §6](./ei-ai-phase-1-overview.md#6-capacity--the-one-thing-to-settle-before-day-1) each buy a calendar date with headcount that a personal research project does not have; the simulation there shows the date cannot be bought with sequencing. D buys no date and promises none. It keeps the plan and drops the schedule.

**What stays in force**

| What | Why it survives the decision |
| --- | --- |
| The wave order in [Tasks §2](./ei-ai-phase-1-tasks.md#2-execution-order) | A wave is a property of the dependency graph, not of staffing. The ranking is valid at any headcount, and it is now the only execution order |
| Every "Done when" and every proving command | These are what closes a task and a package. Nothing about them depends on how many people there are |
| The five priority groups, and G5 as the pre-agreed cut | G5 is still the first thing dropped — now for lack of time rather than lack of people |
| The five gate lines that may never be waived ([§4.4](#44-acceptance-gate), G2) | A solo project is exactly where invariants get quietly skipped. They do not move |

**What is no longer in force**

| What | State |
| --- | --- |
| The day-15 gate, and every day count in [overview §6](./ei-ai-phase-1-overview.md#6-capacity--the-one-thing-to-settle-before-day-1) | Kept in place as the record of why three weeks was never reachable. Not a commitment |
| The 15-day, five-lane schedule in [detail §9](./ei-ai-phase-1-detail.md) | Same — superseded by the wave order |
| E-6, a second backend from day 1 | Moot |
| Lane labels `L` · `B2` · `FE` · `ML` · `DO` | They now describe the **kind** of work, not a person. Read `DO 5.8 d` in the wave table as "this wave is mostly DevOps work", not as an idle colleague |

**The one thing option D weakens.** Rule 2 of §1 — *nothing reaches ✅ by the hand that did the work* — assumes two people. Under D the assistant writes and the operator reviews, so the rule holds for assistant-written work. Work the operator writes by hand has no second pair of eyes; the honest substitute is a re-read on a later day against the "Done when", never a same-sitting tick.

---

## 4. Phase 1 · Foundation — weeks 1–3

**Milestone:** `docker compose up` → log in → upload `.md` → search → cited passages, **and not one line of generated text**.

### 4.1 Roll-up by group

| Group | Name | Packages | Tasks | Hours | Done | Cuttable |
| --- | --- | --- | --- | --- | --- | --- |
| **G1** | Foundation that blocks everything | 3 | 33 | 124 h | 97 % closed — only `T-1.3-07` open | No — nothing else starts |
| **G2** | Safety invariants | 5 | 38 | 136 h | 29 % — WP-2.1 · WP-2.2 closed | No — scope may narrow, the invariant may not |
| **G3** | The product path | 6 | 56 | 280 h | 0 % | Partly — cut from G5 first |
| **G4** | Measurement | 1 | 11 | 80 h | 0 % | No, but it never blocks code |
| **G5** | Pre-agreed slack | 5 | 16 | 80 h | 0 % | Yes, first |
| | **Total** | **20** | **154** | **700 h** | **29 %** | |

### 4.2 Roll-up by package

`W` is the earliest dependency wave the package's first task sits in ([Tasks §2](./ei-ai-phase-1-tasks.md)) — the order to pull work in, independent of staffing.

| Package | Lane | Tasks | Hours | W | Status | Proving command passed |
| --- | --- | --- | --- | --- | --- | --- |
| [WP-1.1](./ei-ai-phase-1-tasks.md#wp-11--repo-toolchain-compose-stack-dev-container--53-h) · Repo, toolchain, Compose stack, Dev Container | DO · L | 15/15 | 53/53 h | 1 | ✅ 2026-09-15 | ✅ passed 2026-09-14 |
| [WP-1.2](./ei-ai-phase-1-tasks.md#wp-12--schema-migrations-seed--44-h) · Schema, migrations, seed | B2 · L | 11/11 | 44/44 h | 3 | ✅ 2026-09-15 | ✅ passed 2026-09-14 |
| [WP-1.3](./ei-ai-phase-1-tasks.md#wp-13--base-ci--stages-13-5-6--24-h) · Base CI — stages 1–3, 5, 6 | DO · L | 6/7 | 24/27 h | 1 | ✅ 2026-09-15 | ✅ run #3 green, #2 red on purpose |
| [WP-2.1](./ei-ai-phase-1-tasks.md#wp-21--invariant-database-constraints--16-h) · Invariant database constraints | L | 6/6 | 16/16 h | 4 | ✅ 2026-09-15 | ✅ passed 2026-09-15 · CI stage 6 green |
| [WP-2.2](./ei-ai-phase-1-tasks.md#wp-22--egress-default-deny--24-h) · Egress default-deny | DO · L | 5/6 | 19/24 h | 1 | ✅ 2026-09-15 | ✅ passed 2026-09-15 · CI stage 6b green |
| [WP-2.3](./ei-ai-phase-1-tasks.md#wp-23--retrieval-with-the-permission-predicate--48-h) · Retrieval with the permission predicate | L | 0/11 | 0/48 h | 3 | ⬜ | ⬜ |
| [WP-2.4](./ei-ai-phase-1-tasks.md#wp-24--audit-append-only--32-h) · Audit, append-only | B2 | 0/8 | 0/32 h | 6 | ⬜ | ⬜ |
| [WP-2.5](./ei-ai-phase-1-tasks.md#wp-25--architecture-rules-in-ci--16-h) · Architecture rules in CI | DO · L | 7/7 | 16/16 h | 3 | 🔎 2026-09-15 | 🟡 local half red by name; the GitHub half needs a push |
| [WP-3.1](./ei-ai-phase-1-tasks.md#wp-31--identity--56-h) · Identity | B2 | 0/12 | 0/56 h | 4 | ⬜ | ⬜ |
| [WP-3.2](./ei-ai-phase-1-tasks.md#wp-32--authorisation--40-h) · Authorisation | B2 | 0/8 | 0/40 h | 9 | ⬜ | ⬜ |
| [WP-3.3](./ei-ai-phase-1-tasks.md#wp-33--workspaces-upload-storage--40-h) · Workspaces, upload, storage | L | 0/9 | 0/40 h | 5 | ⬜ | ⬜ |
| [WP-3.4](./ei-ai-phase-1-tasks.md#wp-34--markdown-ingestion-pipeline--56-h) · Markdown ingestion pipeline | B2 · L | 0/11 | 0/56 h | 2 | ⬜ | ⬜ |
| [WP-3.5](./ei-ai-phase-1-tasks.md#wp-35--tool-registry-and-operating-mode--16-h) · Tool registry and operating mode | L | 0/4 | 0/16 h | 5 | ⬜ | ⬜ |
| [WP-3.6](./ei-ai-phase-1-tasks.md#wp-36--web--19-routes-four-of-them-real--72-h) · Web — 19 routes, four of them real | FE | 0/12 | 0/72 h | 1 | ⬜ | ⬜ |
| [WP-4.1](./ei-ai-phase-1-tasks.md#wp-41--corpus-ocr-spike-gpu-benchmark--80-h) · Corpus, OCR spike, GPU benchmark | ML | 0/11 | 0/80 h | 1 | ⬜ | ⬜ |
| [WP-5.1](./ei-ai-phase-1-tasks.md#wp-51--zip-expansion--16-h--l) · ZIP expansion | L | 0/4 | 0/16 h | 10 | ⬜ | ⬜ |
| [WP-5.2](./ei-ai-phase-1-tasks.md#wp-52--allowlist-generation-from-the-database--16-h) · Allowlist generation from the database | DO · L | 0/4 | 0/16 h | 2 | ⬜ | ⬜ |
| [WP-5.3](./ei-ai-phase-1-tasks.md#wp-53--document-detail--16-h) · Document detail | FE · L | 0/2 | 0/16 h | 12 | ⬜ | ⬜ |
| [WP-5.4](./ei-ai-phase-1-tasks.md#wp-54--ci-stages-79--16-h--do) · CI stages 7–9 | DO | 0/3 | 0/16 h | 2 | ⬜ | ⬜ |
| [WP-5.5](./ei-ai-phase-1-tasks.md#wp-55--contract-tests-wireframes-accessibility--16-h) · Contract tests, wireframes, accessibility | B2 · FE | 0/3 | 0/16 h | 5 | ⬜ | ⬜ |

### 4.3 Tasks

Task text is abbreviated — [Tasks](./ei-ai-phase-1-tasks.md) is the authority on wording and on every "Done when". `W` is the dependency wave; `h` is working hours.

#### G1 · Foundation that blocks everything

**WP-1.1 · Repo, toolchain, Compose stack, Dev Container — 15/15 · 53/53 h · ✅ closed 2026-09-14, T-1.1-15 added 2026-09-15**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-1.1-01 | pnpm 10 workspace root: package.json, pnpm-workspace.yaml… | L | 4 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · `pnpm install` resolves api, web and both packages |
| T-1.1-02 | packages/tsconfig and packages/eslint-config + Prettier config… | L | 4 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · `pnpm -r lint` and `pnpm -r typecheck` green |
| T-1.1-03 | apps/api NestJS 11 scaffold: main.ts, app.module.ts, worker.main.ts… | L | 4 | 2 | ✅ | reviewed 2026-09-14 · 2026-09-14 · `GET /health` → 200 `{"status":"ok"}` |
| T-1.1-04 | config/ — zod schema for every environment variable, fail-fast boot… | L | 4 | 3 | ✅ | reviewed 2026-09-14 · 2026-09-14 · boot without DATABASE_URL → named error, no stack trace |
| T-1.1-05 | apps/api/Dockerfile multi-stage dev/prod, Node 22.13 + pnpm 10 pinned… | DO | 5 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · `--target dev` builds; `node -v` → v22.13.1 |
| T-1.1-06 | apps/web/Dockerfile with a dev target running Vite bound to 0.0.0.0 | DO | 3 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · Vite 6.0.7 serves 200 on 5173 |
| T-1.1-07 | apps/parser/Dockerfile — Python 3.12, Docling and Tesseract installed… | DO | 3 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · Python 3.12.14; `tesseract --list-langs` → eng osd **vie** |
| T-1.1-08 | Compose: postgres 17.2 + pgvector 0.8.0 and redis 7.4, both pinned… | DO | 4 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · postgres healthy; `\dx` lists vector 0.8.0. **Image carries PG 17.6**, not 17.2 |
| T-1.1-09 | Compose: infinity 0.0.76 with the GPU reservation and the models… | DO | 4 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · `/embeddings` → 1024 dimensions; VRAM 3577 MiB with both models loaded |
| T-1.1-10 | Compose: two networks — backend (internal: true) for api, worker… | DO | 5 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · no default route in api, web, worker or parser; all three names resolve. Host access needed a new **ingress** service — scope no task named, confirm at the gate |
| T-1.1-11 | Compose: uploads volume (rw in api/worker, ro in parser) and… | DO | 4 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · one root `.env` via `--env-file`; node_modules are named volumes |
| T-1.1-12 | .devcontainer/devcontainer.json with in-container typescript.tsdk… | DO | 4 | 1 | ✅ | reviewed 2026-09-14 · autocomplete and breakpoint confirmed by hand in VS Code |
| T-1.1-13 | ingress — nginx, the only way in; added at the WP-1.1 gate | DO | 2 | 2 | ✅ | reviewed 2026-09-14 · 4173 and 4180 answer from the host, api still has no default route |
| T-1.1-15 | host tunnel to the database on loopback; added at the WP-1.2 gate (Q-10) | DO | 1 | 2 | ✅ | reviewed 2026-09-15 · a desktop client lists the schema on 127.0.0.1:5433; the bind is loopback, not 0.0.0.0 |
| T-1.1-14 | llamacpp under the dev-local profile; added at the WP-1.1 gate | DO | 2 | 2 | ✅ | reviewed 2026-09-14 · `--profile dev-local` starts it healthy, `/health` → 200 from inside; the default profile excludes it; no default route |

**WP-1.2 · Schema, migrations, seed — 11/11 · 44/44 h · ✅ closed 2026-09-15**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-1.2-01 | 001_extensions.sql — vector, unaccent, pg_trgm, pgcrypto… | L | 4 | 3 | ✅ | reviewed 2026-09-15 · 2026-09-14 · `\dx` lists 4 extensions, `\dT` lists all 5 enums |
| T-1.2-02 | 002_identity.sql — users, refresh_tokens (family, single-use… | L | 4 | 4 | ✅ | reviewed 2026-09-15 · 2026-09-14 · users, refresh_tokens, login_attempts, group_mappings with their FKs and uniques |
| T-1.2-03 | 003_workspaces.sql part A — workspaces, workspace_members, documents… | L | 4 | 4 | ✅ | reviewed 2026-09-15 · 2026-09-14 · part A present; `current_version_id` FK added in part B |
| T-1.2-04 | 003_workspaces.sql part B — document_versions, pages, chunks with… | L | 5 | 5 | ✅ | reviewed 2026-09-15 · 2026-09-14 · a real chunk row generates an unaccented tsvector from Vietnamese text |
| T-1.2-05 | 004_agent.sql — conversations, turns, agent_steps, answers, claims… | L | 4 | 4 | ✅ | reviewed 2026-09-15 · 2026-09-14 · present, `agent_steps` unique on (turn_id, seq) |
| T-1.2-06 | 005_tools_governance.sql — tools, mcp_servers, pre_authorisations… | L | 5 | 4 | ✅ | reviewed 2026-09-15 · 2026-09-14 · present incl. `write_snapshots`; constraints stay with WP-2.1 |
| T-1.2-07 | 006_audit_egress.sql — audit_events, allowlist_entries, egress_records… | L | 3 | 4 | ✅ | reviewed 2026-09-15 · 2026-09-14 · present |
| T-1.2-08 | 007_indexes.sql — HNSW on chunks.embedding halfvec_cosine_ops, GIN on… | L | 3 | 6 | ✅ | reviewed 2026-09-15 · 2026-09-14 · **nine** indexes, not ten — `agent_steps_turn_seq` dropped as a duplicate of the UNIQUE |
| T-1.2-09 | Migration runner — numbered, forward-only, applied-migrations ledger… | B2 | 4 | 3 | ✅ | reviewed 2026-09-15 · 2026-09-14 · empty → head with no manual step; 4 unit tests on the forward-only guard |
| T-1.2-11 | infra seed — 1 admin, 3 users, 2 workspaces, 20 documents, search_documents | B2 | 4 | 6 | ✅ | reviewed 2026-09-15 · 2026-09-14 · seeds 4 users, 2 workspaces, 20 documents, 1 tool; identical counts on a second run |
| T-1.2-10 | kysely-codegen wiring, database/db.ts, transaction.ts helper | B2 | 4 | 5 | ✅ | reviewed 2026-09-15 · 2026-09-14 · 28 tables introspected; a query on `emial` fails typecheck |

**WP-1.3 · Base CI — stages 1–3, 5, 6 — 6/6 · 24/24 h · ✅ closed 2026-09-15**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-1.3-01 | .github/workflows/ci.yml skeleton — the nine stages declared in order… | DO | 4 | 2 | ✅ | reviewed 2026-09-15 · 2026-09-15 · runs #1–#3 on `dev`: **9 jobs, 5 ran, 4 skipped**. Read on the Actions run, not a PR — `dev` is the trunk |
| T-1.3-02 | Stage 1 — ESLint + Prettier across the workspace | DO | 2 | 1 | ✅ | reviewed 2026-09-15 · 2026-09-15 · green on #1 and #3; **red on #2** with exit code 1 against a badly formatted file |
| T-1.3-03 | Stage 2 — tsc --noEmit in every package | DO | 2 | 1 | ✅ | reviewed 2026-09-15 · 2026-09-15 · green on #1 and #3; **red on #2** — `Type 'string' is not assignable to type 'number'` |
| T-1.3-04 | Stage 3 — Vitest with a coverage gate of 80% on domain modules | L | 4 | 3 | ✅ | reviewed 2026-09-15 · 2026-09-15 · green on #1–#3; gate proven able to fail locally with an untested domain file |
| T-1.3-05 | Stage 5 — build api, web and parser images | DO | 4 | 1 | ✅ | reviewed 2026-09-15 · 2026-09-15 · green on #1–#3, 1m12s. Now builds **both api targets**: #2 showed `dev` passing on code that does not compile. Clean cache locally: api 36s, web 21s, parser 344s |
| T-1.3-07 | Workflow hardening — SHA-pinned actions, needs, concurrency, paths-ignore… | DO | 3 | 4 | ⬜ | added at the WP-1.3 gate |
| T-1.3-06 | Stage 6 — empty → head, and previous release tag → head (§1.3 of the… | L 4 · DO 4 | 8 | 4 | ✅ | reviewed 2026-09-15 · 2026-09-15 · green on #1–#3 against a service-container postgres, **red on #2**. Notice records the release-tag half skipping, no tag exists |

#### G2 · Safety invariants

**WP-2.1 · Invariant database constraints — 6/6 · 16/16 h · ✅ closed 2026-09-15**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-2.1-01 | S-1 — immutable_unaccent(text) as IMMUTABLE PARALLEL SAFE, and the… | L | 3 | 4 | ✅ | reviewed 2026-09-15 · 2026-09-14 · run early inside WP-1.2 (deviation); `immutable_unaccent` in `001`, generated column proven on a real row |
| T-2.1-02 | S-2 — partial unique index pre_auth_one_active … WHERE revoked_at IS… | L | 2 | 5 | ✅ | reviewed 2026-09-15 · 2026-09-15 · `008` · two active pre-auths for one tool → duplicate key error; a revoked one plus a new one is accepted |
| T-2.1-03 | S-3 — approval_requests.decided_at, and the corrected partial index… | L | 2 | 5 | ✅ | reviewed 2026-09-15 · 2026-09-15 · **already done in WP-1.2** — `decided_at` and the subquery-free index were written with `005`/`007`; verified, no new SQL |
| T-2.1-04 | tools — UNIQUE (id, classification) and tools_no_write_in_v1… | L | 3 | 5 | ✅ | reviewed 2026-09-15 · 2026-09-15 · `008` · enabling a write tool → check violation; `UNIQUE (id, classification)` present as the composite FK's parent |
| T-2.1-05 | S-4 · FR-44 — pre_authorisations.classification + composite FK to… | L | 3 | 6 | ✅ | reviewed 2026-09-15 · 2026-09-15 · `008` · **FR-44 refused by the database** — both the CHECK and the composite FK proven separately, and reclassifying a pre-authorised tool is refused |
| T-2.1-06 | S-5 — reject_mutation() plus triggers on audit_events and… | L | 3 | 5 | ✅ | reviewed 2026-09-15 · 2026-09-15 · `008` · `UPDATE`/`DELETE audit_events` raise `append-only table: …`, not `UPDATE 0`. No v1 rule existed to remove |

**WP-2.2 · Egress default-deny — 5/6 · 19/24 h · ✅ closed 2026-09-15** — `T-2.2-05` deferred to after `T-3.2-02`

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-2.2-01 | squid.conf — custom log format name (C-3), include… | DO | 5 | 2 | ✅ | reviewed 2026-09-15 · 2026-09-15 · `squid -k parse` clean; logformat named `eiai` (C-3) live in the log, `%ssl::>sni` dropped |
| T-2.2-02 | Squid service on a pinned stable tag, joined to both networks, with a… | DO | 4 | 1 | ✅ | reviewed 2026-09-15 · 2026-09-15 · reworked after being sent back: `squid-logs` named volume, so the access log outlives `docker compose down` |
| T-2.2-03 | allowlist.conf ships empty, with a README stating that empty means deny… | DO | 2 | 1 | ✅ | reviewed 2026-09-14 · 2026-09-14 · run early inside WP-1.1 (deviation); `allowlist.conf` ships empty with its README |
| T-2.2-04 | Network verification script — no default route, service names resolve… | DO | 5 | 3 | ✅ | reviewed 2026-09-15 · 2026-09-15 · `verify-egress.sh` 5/5 ok; **proven able to fail** — allowing example.com made it exit 1 |
| T-2.2-05 | allowlist_entries repository and GET/POST /egress/allowlist… | L | 5 | 5 | ⏭ | **deferred to after `T-3.2-02`** — the Done when needs an authenticated principal, and no authentication exists until WP-3.1. Routes answer 501 |
| T-2.2-06 | Seed one destination, document the manual reload step, and wire the… | L | 3 | 6 | ✅ | reviewed 2026-09-15 · 2026-09-15 · stage **6b** in CI, seed writes one `allowlist_entries` row, README documents parse-then-reload |

**WP-2.3 · Retrieval with the permission predicate — 0/11 tasks · 0/48 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-2.3-01 | rank-fusion.ts — RRF as a pure function, with unit tests including ties… | L | 4 | 3 | ⬜ | |
| T-2.3-02 | hybrid-search.repository.ts — the permitted CTE: membership, workspace… | L | 6 | 7 | ⬜ | |
| T-2.3-03 | Dense branch — HNSW over halfvec, candidate limit from config | L | 5 | 8 | ⬜ | |
| T-2.3-04 | Lexical branch — GIN + plainto_tsquery('simple', unaccent($n)) | L | 5 | 8 | ⬜ | |
| T-2.3-05 | Full outer join, fusion, RETRIEVAL_KEEP_TOP, RETRIEVAL_RELEVANCE_FLOOR… | L | 5 | 9 | ⬜ | |
| T-2.3-06 | retrieval.service.ts, DTOs and POST /search — response carries file… | L | 6 | 11 | ⬜ | |
| T-2.3-07 | Question embedding through InfinityClient, cached in Redis for 1 hour | L | 4 | 12 | ⬜ | |
| T-2.3-08 | permission-predicate.spec.ts — asserts the compiled SQL text contains… | L | 4 | 10 | ⬜ | |
| T-2.3-09 | leakage.spec.ts — B's restricted chunk appears in no result, no… | L | 5 | 12 | ⬜ | |
| T-2.3-10 | Mutation check — remove the permitted join and confirm both tests fail… | L | 2 | 13 | ⬜ | |
| T-2.3-11 | Query-plan review of both branches at seeded volume, recorded in… | L | 2 | 12 | ⬜ | |

**WP-2.4 · Audit, append-only — 0/8 tasks · 0/32 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-2.4-01 | audit.repository.ts — canonical payload serialisation and prev_hash →… | B2 | 6 | 6 | ⬜ | |
| T-2.4-02 | audit-transaction.interceptor.ts — opens the transaction before the… | B2 | 6 | 7 | ⬜ | |
| T-2.4-03 | auditService.record() and the event-name taxonomy constants in… | B2 | 4 | 8 | ⬜ | |
| T-2.4-04 | Wire authentication events — success, failure, lockout | B2 | 3 | 10 | ⬜ | |
| T-2.4-05 | Wire workspace, membership and permission-change events | B2 | 3 | 9 | ⬜ | |
| T-2.4-06 | Wire upload and every ingestion state change | B2 | 4 | 10 | ⬜ | |
| T-2.4-07 | Wire search events with workspace scope — no document content in any log | B2 | 3 | 12 | ⬜ | |
| T-2.4-08 | Immutability and chain-integrity tests | B2 | 3 | 9 | ⬜ | |

**WP-2.5 · Architecture rules in CI — 7/7 tasks · 16/16 h · 🔎 opened and finished 2026-09-15**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-2.5-01 | dependency-cruiser installed, baseline config, CI stage 4 wired | DO | 4 | 3 | 🔎 | 2026-09-15 · `dependency-cruiser` 18.3.1 at the root; 27 modules, 38 dependencies cruised, zero violations. Baseline `no-circular` **proven able to fail** on a temporary cycle, exit 1. Stage 4 live in `ci.yml`; the run itself needs a push |
| T-2.5-02 | Rule 1 — only retrieval/hybrid-search.repository.ts may query chunks | L | 3 | 8 | 🔎 | 2026-09-15 · ESLint, not the cruiser — a table name is source text, not an edge. **16 files reached**; all three query shapes refused (builder incl. `chunks as c`, raw string, `sql` template), the permitted file accepted, and `` `indexed ${n} chunks` `` not flagged. Blocker `T-2.3-02` dropped |
| T-2.5-03 | Rule 2 — only governance/execution.gateway.ts may import… | L | 2 | 4 | 🔎 | 2026-09-15 · `connectors-only-via-governance`. **Both directions proven**: an importer in `modules/admin` is refused by name, exit 1; the same import from `governance/execution.gateway.ts` is accepted, exit 0 |
| T-2.5-04 | Rule 3 — no cross-module service imports; only through ports/ | L | 3 | 4 | 🔎 | 2026-09-15 · `no-cross-module-service`, read as "no module imports another module's `*.service.ts`" — the literal wording is unsatisfiable, see the note. **Both directions proven**: `admin` → `identity/users.service.ts` refused, exit 1; the same import from inside `identity` accepted, exit 0 |
| T-2.5-05 | Rule 4 — apps/web imports packages/shared-types only, never apps/api | DO | 2 | 4 | 🔎 | 2026-09-15 · `web-not-to-api`. An `import type` from web into `apps/api/src/database/schema.ts` is refused by name, exit 1. Negative half only — `packages/shared-types` does not exist, see the note. Blocker `T-3.6-04` dropped |
| T-2.5-06 | Rule 5 — a provider SDK may only be imported under… | DO | 2 | 4 | 🔎 | 2026-09-15 · `provider-sdk-only-in-adapter`. `@anthropic-ai/sdk` from a module refused by name, exit 1; from `adapters/model-provider/` accepted, exit 0; **a different unresolvable module from the same file accepted** — the rule reads the SDK name, not the failure to resolve |
| T-2.5-07 | Deliberate-violation test documented, and one violation committed then… | L 0 · DO 0 | 0 | — | 🔎 | 2026-09-15 · `docs/ops/architecture-rules.md` — a probe per rule, and the two that pass for the wrong reason. Local half of the proving command red by name, exit 1; **the committed-then-reverted half needs a push** |

#### G3 · The product path

**WP-3.1 · Identity — 0/12 tasks · 0/56 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-3.1-01 | common/ — problem-json.filter.ts, zod-validation.pipe.ts… | B2 | 5 | 4 | ⬜ | |
| T-3.1-02 | users repository, Argon2id hashing, configurable password policy | B2 | 4 | 6 | ⬜ | |
| T-3.1-03 | POST /auth/login with AUTH_INVALID_CREDENTIALS, timing-safe on unknown… | B2 | 4 | 7 | ⬜ | |
| T-3.1-04 | Access token — 15 minutes, issue and verify, JwtAuthGuard | B2 | 6 | 8 | ⬜ | |
| T-3.1-05 | refresh_tokens — family_id, single use, rotation on every refresh | B2 | 7 | 9 | ⬜ | |
| T-3.1-06 | POST /auth/refresh with the HttpOnly, SameSite=Strict cookie | B2 | 4 | 10 | ⬜ | |
| T-3.1-07 | Reuse detection — a used refresh token revokes the whole family… | B2 | 6 | 11 | ⬜ | |
| T-3.1-08 | login_attempts and the rate limit — 10 per account per 15 minutes | B2 | 4 | 8 | ⬜ | |
| T-3.1-09 | Lockout after 10 consecutive failures → AUTH_ACCOUNT_LOCKED (423); a… | B2 | 4 | 9 | ⬜ | |
| T-3.1-10 | Redis revocation list, checked in the guard — a disabled account loses… | B2 | 5 | 9 | ⬜ | |
| T-3.1-11 | POST /auth/logout — clears the cookie, revokes the family | B2 | 3 | 12 | ⬜ | |
| T-3.1-12 | Integration tests — the two gate scenarios: replay-revokes-family, and… | B2 | 4 | 12 | ⬜ | |

**WP-3.2 · Authorisation — 0/8 tasks · 0/40 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-3.2-01 | The permission matrix as data in shared-types — 5 system roles × 13… | B2 | 5 | 9 | ⬜ | |
| T-3.2-02 | RolesGuard + @Roles() decorator, driven by that table | B2 | 5 | 10 | ⬜ | |
| T-3.2-03 | Workspace role resolution from workspace_members — Owner, Editor, Reader | B2 | 5 | 9 | ⬜ | |
| T-3.2-04 | WorkspaceRoleGuard + @WorkspaceRole() decorator | B2 | 5 | 11 | ⬜ | |
| T-3.2-05 | Matrix test generator — one case per role/action pair, 77 in total | B2 | 8 | 12 | ⬜ | |
| T-3.2-06 | Guards applied to every implemented endpoint, with the documented 403… | B2 | 6 | 13 | ⬜ | |
| T-3.2-07 | Negative tests — Reader cannot upload, Editor cannot change membership | B2 | 3 | 14 | ⬜ | |
| T-3.2-08 | Deliberate-loosening check — remove one guard, confirm the matrix test… | B2 | 3 | 13 | ⬜ | |

**WP-3.3 · Workspaces, upload, storage — 0/9 tasks · 0/40 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-3.3-01 | Workspaces repository and CRUD, with archive semantics (retained, out… | L | 6 | 5 | ⬜ | |
| T-3.3-02 | Membership endpoints — add, remove, change role | L | 5 | 6 | ⬜ | |
| T-3.3-03 | StoragePort + LocalFsAdapter, sha256 keying under the uploads volume | L | 5 | 6 | ⬜ | |
| T-3.3-04 | Multipart upload endpoint, 200 MB limit → DOC_TOO_LARGE | L | 6 | 7 | ⬜ | |
| T-3.3-05 | Content-type sniffing by file signature vs extension →… | L | 6 | 8 | ⬜ | |
| T-3.3-06 | Format allowlist — the 10 supported formats → DOC_UNSUPPORTED_FORMAT | L | 3 | 9 | ⬜ | |
| T-3.3-07 | documents + document_versions creation, dv_content_unique dedupe… | L | 5 | 8 | ⬜ | |
| T-3.3-08 | Download endpoint — Content-Disposition: attachment… | L | 2 | 9 | ⬜ | |
| T-3.3-09 | Tests — ELF-in-pdf, oversize, duplicate, unsupported format | L | 2 | 10 | ⬜ | |

**WP-3.4 · Markdown ingestion pipeline — 0/11 tasks · 0/56 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-3.4-01 | BullMQ setup, queue definitions, worker.main.ts consumer entrypoint | B2 | 6 | 6 | ⬜ | |
| T-3.4-02 | Job lifecycle — retry with back-off, failure reason persisted on the… | B2 | 6 | 7 | ⬜ | |
| T-3.4-03 | Ingestion state machine — uploaded → parsing → parsed → chunking →… | B2 | 4 | 9 | ⬜ | |
| T-3.4-04 | Markdown pass-through "parsing" — one pages row, extraction_method =… | L | 4 | 9 | ⬜ | |
| T-3.4-05 | D-5 decision — measure the XLM-RoBERTa tokenizer against a… | L | 6 | 2 | ⬜ | |
| T-3.4-06 | Chunker — 200–400 tokens with 15% overlap | L | 8 | 3 | ⬜ | |
| T-3.4-07 | Chunker — character offsets and heading_path preserved through the split | L | 6 | 4 | ⬜ | |
| T-3.4-08 | Offset round-trip test — slicing the source by the offsets reproduces… | L | 3 | 5 | ⬜ | |
| T-3.4-09 | InfinityClient — /embeddings at batch 8, timeout, retry and back-off | L | 6 | 2 | ⬜ | |
| T-3.4-10 | Persist embeddings as halfvec, with the completeness check | L | 4 | 10 | ⬜ | |
| T-3.4-11 | End-to-end — upload a folder, reach indexed, expose ingestion status… | L | 3 | 11 | ⬜ | |

**WP-3.5 · Tool registry and operating mode — 0/4 tasks · 0/16 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-3.5-01 | tools repository and seed of the three internal tools; only… | L | 4 | 5 | ⬜ | |
| T-3.5-02 | Role filtering inside the query by min_system_role | L | 4 | 10 | ⬜ | |
| T-3.5-03 | Operating-mode computation per request from enabled and reachable tools | L | 4 | 11 | ⬜ | |
| T-3.5-04 | GET /me — user, roles, memberships, operatingMode, FEATURE_STATUS | L | 4 | 12 | ⬜ | |

**WP-3.6 · Web — 19 routes, four of them real — 0/12 tasks · 0/72 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-3.6-01 | Vite 6 + React 19 + TypeScript + Tailwind 4 + shadcn/ui initialised | FE | 5 | 2 | ⬜ | |
| T-3.6-02 | providers.tsx — TanStack Query, Zustand auth store, theme | FE | 5 | 1 | ⬜ | |
| T-3.6-03 | apiClient.ts — problem+json parsing, transparent refresh on 401… | FE | 8 | 2 | ⬜ | |
| T-3.6-04 | router.tsx — all 19 routes declared, including the unbuilt ones | FE | 6 | 3 | ⬜ | |
| T-3.6-05 | AppShell + Sidebar, badges driven by FEATURE_STATUS | FE | 6 | 13 | ⬜ | |
| T-3.6-06 | ComingSoon component — purpose, planned phase, and what it will do | FE | 4 | 4 | ⬜ | |
| T-3.6-07 | Login screen, including the lockout message | FE | 6 | 8 | ⬜ | |
| T-3.6-08 | Auth flow — guarded routes, token storage, 401 → refresh → retry, logout | FE | 6 | 11 | ⬜ | |
| T-3.6-09 | Workspace list — cards with document count and index status | FE | 6 | 12 | ⬜ | |
| T-3.6-10 | Workspace documents table — status, pages, uploader, date, per-row… | FE | 6 | 12 | ⬜ | |
| T-3.6-11 | Upload screen — drag and drop, per-file progress, per-file result with… | FE | 6 | 12 | ⬜ | |
| T-3.6-12 | Search screen — query box, workspace scope, results with file name and… | FE | 8 | 12 | ⬜ | |

#### G4 · Measurement

**WP-4.1 · Corpus, OCR spike, GPU benchmark — 0/11 tasks · 0/80 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-4.1-01 | Collect 30–50 scanned legal PDFs — Vietnamese diacritics, stamps… | ML | 10 | 1 | ⬜ | |
| T-4.1-02 | Collect 10–20 report documents with real tabular layout, plus the .md… | ML | 6 | 1 | ⬜ | |
| T-4.1-03 | Hand-transcribe ~20 reference pages spread across the document classes | ML | 12 | 1 | ⬜ | |
| T-4.1-04 | Docling + Tesseract spike harness — a standalone script, deliberately… | ML | 8 | 1 | ⬜ | |
| T-4.1-05 | OCR run 1 over the whole corpus, with failure triage | ML | 8 | 2 | ⬜ | |
| T-4.1-06 | Scoring — character-level and field-level accuracy per document class | ML | 10 | 3 | ⬜ | |
| T-4.1-07 | Table extraction check on the report documents | ML | 6 | 4 | ⬜ | |
| T-4.1-08 | GPU — VRAM in use with BGE-M3 and the reranker both loaded | ML | 4 | 2 | ⬜ | |
| T-4.1-09 | GPU — embedding throughput in chunks/second at batch 8 | ML | 6 | 2 | ⬜ | |
| T-4.1-10 | GPU — rerank latency for 60 candidates | ML | 4 | 2 | ⬜ | |
| T-4.1-11 | docs/ops/week-1-measurements.md — five numbers, each with its method… | ML | 6 | 4 | ⬜ | |

#### G5 · Pre-agreed slack

**WP-5.1 · ZIP expansion — 0/4 tasks · 0/16 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-5.1-01 | ZIP expansion to 500 files, streamed rather than fully buffered | L | 5 | 10 | ⬜ | |
| T-5.1-02 | Path-traversal and nested-archive refusal, entry-count and total-size… | L | 4 | 11 | ⬜ | |
| T-5.1-03 | Per-file result summary returned to the caller | L | 4 | 11 | ⬜ | |
| T-5.1-04 | Tests — traversal, nesting, over-count, mixed valid and invalid entries | L | 3 | 12 | ⬜ | |

**WP-5.2 · Allowlist generation from the database — 0/4 tasks · 0/16 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-5.2-01 | Generator — allowlist_entries → allowlist.conf, written atomically | L | 5 | 6 | ⬜ | |
| T-5.2-02 | Generator tests, including the empty case | L | 3 | 7 | ⬜ | |
| T-5.2-03 | Reload mechanism — squid -k parse then squid -k reconfigure | DO | 4 | 2 | ⬜ | |
| T-5.2-04 | Rollback on invalid config — keep the previous file, surface the error | DO | 4 | 3 | ⬜ | |

**WP-5.3 · Document detail — 0/2 tasks · 0/16 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-5.3-01 | GET /documents/{id} detail — version history, status reasons, chunk and… | L | 8 | 12 | ⬜ | |
| T-5.3-02 | Document detail screen — versions, ingestion state and reason… | FE | 8 | 13 | ⬜ | |

**WP-5.4 · CI stages 7–9 — 0/3 tasks · 0/16 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-5.4-01 | Stage 7 — Testcontainers integration suite (Postgres 17.2 + pgvector… | DO | 6 | 13 | ⬜ | |
| T-5.4-02 | Stage 8 — red-team harness with zero cases, printing 0 cases — agent… | DO | 3 | 3 | ⬜ | |
| T-5.4-03 | Stage 9 — Trivy on images, npm audit --audit-level=high, versioned push… | DO | 7 | 2 | ⬜ | |

**WP-5.5 · Contract tests, wireframes, accessibility — 0/3 tasks · 0/16 h**

| ID | Task | Lane | h | W | Status | Note |
| --- | --- | --- | --- | --- | --- | --- |
| T-5.5-01 | Contract tests for every 501 route — code, feature, plannedPhase | B2 | 4 | 13 | ⬜ | |
| T-5.5-02 | Wireframe component and a layout sketch inside each of the 15 "Coming… | FE | 8 | 5 | ⬜ | |
| T-5.5-03 | Accessibility pass on the four real screens — keyboard, focus order… | FE | 4 | 13 | ⬜ | |

### 4.4 Acceptance gate

Quoted from [Detail §10](./ei-ai-phase-1-detail.md), where each line carries the command that proves it. **A line without a passing command is not done.**

**G1 — foundation**

- [ ] `git clean -xdf && cp .env.example .env && docker compose up -d` on a clean machine — all services up, no manual step
- [ ] `psql -c "\dt"` lists every table, including `write_snapshots`
- [ ] Both profiles start — default, and `--profile dev-local`
- [ ] CI green on stages 1, 2, 3, 5, 6

**G2 — invariants · none of these may be waived**

- [ ] `ip route | grep -c default` inside `api` → `0`
- [ ] Empty allowlist, proxy env removed → the request fails at the network; Squid logs `TCP_DENIED`
- [ ] After seeding one destination → the same request succeeds, byte counts logged
- [ ] `permission-predicate.spec.ts` asserts the compiled SQL contains the `permitted` CTE
- [ ] `leakage.spec.ts` — user A receives none of B's restricted chunks in results, logs or intermediate structures
- [ ] Deleting the `permitted` join turns both tests red
- [ ] `UPDATE audit_events …` raises rather than silently doing nothing
- [ ] Pre-authorising a write tool is refused **by the database**
- [ ] CI stage 4 red on a deliberate architecture violation
- [ ] **No generated text anywhere in the execution path**

**G3 — the product path**

- [ ] 11 consecutive failed logins → `AUTH_ACCOUNT_LOCKED`; replaying a used refresh token revokes the family
- [ ] Permission matrix 77/77; Reader cannot upload, Editor cannot change membership
- [ ] A Member requesting an admin route receives 403 from the API, not a blank page from the router
- [ ] Upload a `.md` folder → `indexed`; `count(*) FROM chunks WHERE embedding IS NULL` → `0`
- [ ] A chunk's `char_start`/`char_end` slice out of the source file matches `chunks.text` exactly
- [ ] A `.pdf` containing an executable → `DOC_CONTENT_MISMATCH`; a 201 MB file → `DOC_TOO_LARGE`
- [ ] The search screen returns relevant passages with file name and position
- [ ] `GET /me` reports `document-only` with `mcp_servers` empty
- [ ] All 19 screens open; the 15 unbuilt ones name what they will do and the phase they arrive in

**G4 — measurement**

- [ ] `docs/ops/week-1-measurements.md` holds all five numbers, each with its method
- [ ] The OCR number carries an explicit R-01 recommendation — proceed, or trigger the fallback

### 4.5 The five numbers that can change the plan

| # | Number | Value | Changes what |
| --- | --- | --- | --- |
| 1 | VRAM with both models loaded | — | Over ~3.6 GB → reranker to int8 or CPU |
| 2 | Embedding throughput, chunks/second | — | Realistic ingest time, and whether NFR-04 is reachable |
| 3 | **OCR accuracy on the proxy corpus** | — | **Below 90% → R-01 fallback, decided in week 3** |
| 4 | HMR latency | — | Over 3 seconds → the source is on the wrong filesystem |
| 5 | Empty-allowlist denial confirmed | — | If it does not deny, Phase 1 does not close |

---

## 5. Phase 2 · Document assistant — weeks 4–12 · 41 pw

**At the end of this phase `document-only` is a complete product that could be handed to a customer.** Tracked at work-item level; a task breakdown like Phase 1's does not exist yet and is written at the start of the phase.

### 5.1 Milestone 2A · Full ingestion — weeks 4–6 · 11 pw

| Work | FRs | Status | Note |
| --- | --- | --- | --- |
| Parser worker — text, page boundaries, tables, reading order via Docling | FR-03 | ⬜ | |
| OCR for pages with no text layer, Vietnamese + English | FR-03 | ⬜ | |
| Full 8-state ingestion state machine with failure reasons and retry | FR-06 | ⬜ | |
| Document versioning — superseded versions leave retrieval, stay resolvable | FR-07 | ⬜ | |
| Permanent purge of a document and all derived data, audited | FR-08 | ⬜ | |
| Cross-encoder reranker in the retrieval path | FR-12, 13 | ⬜ | wired in Phase 1, enabled here |
| Document-level read restriction | FR-14 | ⬜ | |

### 5.2 Milestone 2B · The agent loop — weeks 7–9 · 12 pw

| Work | FRs | Status | Note |
| --- | --- | --- | --- |
| `agent_steps` state machine — every step written before it executes | **FR-15**, BR-03 | ⬜ | |
| Loop — state + permitted tools + remaining budget → exactly one action | FR-16 | ⬜ | |
| Action validated against the tool schema; 2 retries then a clean stop | FR-17 | ⬜ | |
| Turn budget — 120 s and 12 steps, then synthesise from what was gathered | FR-18 | ⬜ | |
| Loop detection — same tool, same arguments, third time stops the turn | FR-19 | ⬜ | |
| SSE step events reaching the client within 1 second | FR-20 | ⬜ | |
| Three internal tools — `search_documents`, `read_document_page`, `list_workspace_documents` | FR-27 | ⬜ | plan §2 change 1 |
| Retrieved text in delimited, explicitly untrusted blocks | **FR-24** | ⬜ | |
| User cancellation, honoured at the end of the current step | FR-26 | ⬜ | |
| Tool call logging — name, arguments, summarised result, latency, error | FR-23 | ⬜ | |
| Operating mode per turn; graceful with zero MCP servers | FR-75, 79, 80 | ⬜ | |
| **Pause-capable test** — a step halted in the database resumes after an API restart | — | ⬜ | plan §2 change 3 · **gate line** |

### 5.3 Milestone 2C · Verified answering — weeks 9–11 · 11 pw

| Work | FRs | Status | Note |
| --- | --- | --- | --- |
| Question intake scoped to permitted workspaces | FR-29 | ⬜ | |
| Draft generation, every sentence annotated with source span ids | FR-30 | ⬜ | |
| **Verifier as a separate call** — one claim, one span, structured verdict | **FR-31** | ⬜ | |
| Filtering — nothing unsupported reaches the user | **FR-32** | ⬜ | |
| Explicit refusal naming what was searched and not found | FR-33 | ⬜ | |
| Citations resolving to document, version, page and character span | FR-34 | ⬜ | |
| Streaming that emits only verified claims | FR-35 | ⬜ | |
| Follow-up questions carrying prior turns and their citations | FR-36 | ⬜ | |
| Partial answers when the budget runs out, stating what is missing | FR-25 | ⬜ | |
| Answer rating and comments joined to the turn trace | FR-37 | ⬜ | |
| Source viewer with the cited span highlighted | FR-34, NFR-15 | ⬜ | |
| Degradation when a tool fails mid-turn | FR-76 | ⬜ | |

### 5.4 Milestone 2D · Measurement and governance — weeks 10–12 · 7 pw

| Work | FRs | Status | Note |
| --- | --- | --- | --- |
| **Eval harness including trajectory scoring**, nightly from week 10 | **FR-71**, NFR-09–11 | ⬜ | |
| Golden set — **starts week 4**, 2 h/week from the business | — | ⬜ | depends on D-4 · Q-05 |
| Audit hash chaining, search, CSV / JSON Lines export | FR-67, 68 | ⬜ | |
| Full OIDC login | FR-59 | ⬜ | depends on Q-06 |
| Immediate access revocation on account disable | FR-63 | ⬜ | |
| Health endpoint — DB, Redis, disk, embeddings, `not_configured` for MCP | FR-78 | ⬜ | |

### 5.5 Acceptance gate

⬜ **Not started** — 14 lines in [plan §5.5](./ei-ai-implementation-plan.md). The four that most often slip: all 30 unanswerable questions refused with no invention; the `document-only` scenario green in CI; the pause-capable test; and the internal team using it daily for the last two weeks.

---

## 6. Phase 3 · Tools and ERP — weeks 13–19 · 28 pw

### 6.1 Milestone 3A · MCP client — weeks 13–15 · 9 pw

| Work | FRs | Status | Note |
| --- | --- | --- | --- |
| MCP server registry — transport, endpoint, credential encrypted at rest | FR-51 | ⬜ | |
| Tool discovery, input schemas stored verbatim | FR-52 | ⬜ | |
| Read/write classification, **defaulting to `write` when ambiguous** | **FR-53** | ⬜ | |
| Write tools rejected at both service and database layers | FR-54 | ⬜ | |
| Outbound payload validated **before** an approval request is created | FR-55 | ⬜ | |
| Scheduled health checks, status in the admin area | FR-56 | ⬜ | |
| Per-server timeout and rate limit; degrade rather than hang | FR-57 | ⬜ | |
| Tool catalogue filtered by the asker's role | FR-21, **FR-22** | ⬜ | |
| **Blocking dependency — the real ERP tool catalogue** | — | 🚫 | Q-02, needed by **week 10** |

### 6.2 Milestone 3B · Approval gate — weeks 15–17 · 9 pw

| Work | FRs | Status | Note |
| --- | --- | --- | --- |
| Halt the turn and create an approval request before any outward step | **FR-38** | ⬜ | |
| Six fields displayed, payload verbatim, escaped, never summarised | FR-39 | ⬜ | |
| Immutable decision records — triggers reject UPDATE and DELETE | FR-40 | ⬜ | |
| Denial carries a reason, returned to the agent | FR-41 | ⬜ | |
| Expiry after a configurable interval, treated as denial | FR-42 | ⬜ | |
| Pre-authorisation for `read` tools, every use audited | FR-43 | ⬜ | |
| **Write tools can never be pre-authorised** — database constraint | **FR-44** | ⬜ | constraint lands in Phase 1 (T-2.1-05) |
| Approver notification in-app and by email | FR-39 | ⬜ | |

### 6.3 Milestone 3C · Egress and web search — weeks 17–18 · 5 pw

| Work | FRs | Status | Note |
| --- | --- | --- | --- |
| Allowlist admin UI on the Phase 1 foundation | FR-45 | ⬜ | |
| Egress recording and daily reconciliation against approvals | FR-46 | ⬜ | |
| `web_search` as an egress tool, **shipped disabled** | **FR-28, 77** | ⬜ | |

### 6.4 Milestone 3D · Model providers — weeks 18–19 · 5 pw

| Work | FRs | Status | Note |
| --- | --- | --- | --- |
| External provider configuration by key and model, disabled by default | FR-47 | ⬜ | |
| Typed acknowledgement recorded before activation | FR-48 | ⬜ | |
| Persistent non-dismissible banner while active | FR-49 | ⬜ | |
| Per-workspace provider pinning | FR-50 | ⬜ | |
| Answer quality metrics per provider | FR-60 | ⬜ | |

### 6.5 Acceptance gate

⬜ **Not started** — 15 lines in [plan §6.5](./ei-ai-implementation-plan.md). The two structural ones: an architecture test proving no code path bypasses the approval gate, and the chaos test where killing the MCP server mid-turn fails zero turns outright.

---

## 7. Phase 4 · Hardening and handover — weeks 20–26 · 30 pw

| Milestone | Weeks | Contents | FRs | Status |
| --- | --- | --- | --- | --- |
| **4A · Operations** | 20–21 | 11 health indicators, alerts, a documented response for each | FR-69, 70 | ⬜ |
| **4B · Backup and recovery** | 21–22 | Scheduled backup, **automated weekly verified test restore**, PITR, offline licence | FR-72, 73, 74 | ⬜ |
| **4C · Testing and security** | 22–24 | 10 concurrent turns, 72-hour soak, chaos, WCAG 2.1 AA, all 15 threats with a red-team pass on T-01 | — | ⬜ |
| **4D · Handover** | 24–26 | Documentation, offline `docker save` bundle, UAT, handover | NFR-17 | ⬜ |
| Quality loop | 22–26 | Tune chunking, floor, verifier prompt, budgets — **each change measured against the golden set** | — | ⬜ |

### 7.1 Acceptance gate

⬜ **Not started** — 12 lines in [plan §7.2](./ei-ai-implementation-plan.md). The one that decides handover: **someone outside the build team installs the system from scratch, from the documentation alone, timed, in under 4 hours.**

---

## 8. Change log

| Date | Change |
| --- | --- |
| 2026-09-15 | **WP-2.1 closed at its gate.** FR-44 is refused by the database, not by code that remembers to check; `UPDATE audit_events` raises rather than reporting `UPDATE 0`. Two of the package's own checks first passed without reaching what they claimed to test. |
| 2026-09-15 | **WP-2.2 closed at its gate.** The egress boundary denies with an empty allowlist, opens for one destination with byte counts logged, and closes again; CI stage 6b proves it on every push. Two defects found on the way: the plan's own proving command could not run, and a single-file bind mount let the boundary fail open while a reload reported success. |
| 2026-09-15 | **WP-1.3 closed at its gate — G1 is complete.** Runs #1 and #3 green, #2 deliberately red to prove stages 1 and 2 can fail; that test found the `prod` image had never been built and did not work. `T-1.3-07` opened for workflow hardening, Q-12 for branch protection. |
| 2026-09-15 | **WP-1.2 closed at its gate.** 12 rows reviewed and moved to ✅, the schema inspected by hand through a desktop client. Diary promoted: three rules added to CLAUDE.md, Q-10 and Q-11 opened here. |
| 2026-09-14 | **WP-1.2 executed and proved.** 27 tables migrate from empty to head and seed with no manual step; the eleven tables that had no DDL anywhere were written into design §6.1.1 first. `T-1.2-11` added for the seed no task owned; `T-2.1-01` borrowed. |
| 2026-09-14 | **WP-1.1 closed at its gate.** 14 rows reviewed and moved to ✅; Dev Container confirmed by hand; ingress accepted provisionally. Diary promoted: four rules added to CLAUDE.md, Q-07…Q-09 opened here. |
| 2026-09-14 | **WP-1.1 executed and proved**, with T-2.2-02/03 borrowed from WP-2.2. Rows sit at 🔎. Findings: the images contradict their tags (PG 17.6 under a `pg17` tag, Squid 6.13 under a `6.6` tag), and the C-1 check was a false green until `iproute2` was installed. |
| 2026-09-12 | **D-2 decided: option D** — single operator, wave order, no date commitment. §3.2 records what stays in force and what does not. E-4 re-verified; E-6 moot. |
| 2026-09-10 | **D-1 decided: public repository** — a personal research project. §3.1 records what that commits us to. |
| 2026-09-10 | File created. Phase 1 seeded with 149 tasks from the task document; entry conditions re-verified against the machine — E-4 now passes. |


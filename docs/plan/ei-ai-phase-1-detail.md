# Ei-AI — Phase 1 · Detail

> The middle layer of the Phase 1 plan. Each package here is opened into individual tasks in [Phase 1 · Tasks](./ei-ai-phase-1-tasks.md), whose hours sum back to the person-day figures below. [The overview](./ei-ai-phase-1-overview.md) decides the five priority groups and what gets cut; this document opens each group into work packages, and gives every one of them **the command that proves it is done**. A package with no runnable proof is not finished, however finished it looks.

| Field | Value |
| --- | --- |
| Version | 1.0 — **approved 2026-09-12** |
| Date | 2026-09-10 · approved 2026-09-12 |
| Pairs with | [Phase 1 · Overview](./ei-ai-phase-1-overview.md) |
| Work packages | 20, across 5 groups, 87 person-days |

**Reading key.** Lanes: `L` tech lead / backend · `B2` second backend · `FE` frontend · `ML` Python/ML · `DO` DevOps. Package ids are `WP-<group>.<n>`, stable across revisions of this draft — if a package is dropped, its id is retired rather than reused.

---

## 1. Corrections carried in before any package starts

These are defects found while planning, not new scope. They belong at the top because six work packages implement them, and because the reasoning should not be re-litigated in week 2.

### 1.1 Five SQL defects in the design's schema — they fail on first run

| # | Where | What happens | Fix |
| --- | --- | --- | --- |
| **S-1** | `chunks.text_search GENERATED ALWAYS AS (to_tsvector('simple', unaccent(text))) STORED` | **Migration fails.** Postgres requires generated-column expressions to be `IMMUTABLE`; `unaccent()` is `STABLE` because it depends on a dictionary | Wrap it: `CREATE FUNCTION immutable_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT unaccent('unaccent', $1) $$;` and generate from that. The query side keeps calling `unaccent()` normally |
| **S-2** | `pre_authorisations … UNIQUE (tool_id) WHERE revoked_at IS NULL` | **Migration fails.** A table constraint cannot carry a `WHERE` clause | A partial unique index: `CREATE UNIQUE INDEX pre_auth_one_active ON pre_authorisations (tool_id) WHERE revoked_at IS NULL;` |
| **S-3** | Index `approval_requests_open` — `(expires_at) WHERE id NOT IN (SELECT …)` | **Migration fails.** Index predicates cannot contain subqueries | Add `decided_at TIMESTAMPTZ` to `approval_requests`, written by the decision path, and index `(expires_at) WHERE decided_at IS NULL` |
| **S-4** | FR-44 — "write tools can never be pre-authorised, enforced by a database constraint" | **Not actually enforced.** A `CHECK` cannot reference `tools.classification` from another table, and no trigger is specified | Declarative composite FK: `UNIQUE (id, classification)` on `tools`; `pre_authorisations` carries a `classification` column with `FOREIGN KEY (tool_id, classification) REFERENCES tools(id, classification)` and `CHECK (classification = 'read')`. The database then refuses, with no trigger to maintain |
| **S-5** | `audit_events` — v1 uses `RULE … DO INSTEAD NOTHING`, the agentic design uses a `TRIGGER` that raises | Two contradictory mechanisms; the rule version **silently discards** an UPDATE, the worst possible behaviour on an audit table | Keep the trigger, drop the rules. An attempt to modify an audit row must fail loudly and land in the caller's error path |

Two smaller reconciliations while writing the migrations: the design indexes `audit_events (seq)` but the table has no `seq` column — use the `BIGSERIAL id` as the chain order and name the index for it; and `documents.current_version_id` gets its FK added after `document_versions` exists.

### 1.2 Five stack defects in the environment document

| # | What | Why it matters now | Fixed in |
| --- | --- | --- | --- |
| **C-1** | The `api` container has a default route; only `HTTP_PROXY` env points at Squid | ADR-09 puts the constraint at the Docker network layer. Node 22's `fetch`/undici **ignores** `HTTP_PROXY` unless a `ProxyAgent` is set, so the product could bypass Squid while the `curl`-based check passes | WP-1.1, WP-2.2 |
| **C-2** | Floating and beta image tags (`pgvector:pg17`, `squid:6.6-24.04_beta`, `llama.cpp:server`) | ADR-13's whole argument is that versions are guaranteed by the image. Squid especially must not be on a beta tag — it enforces FR-45 | WP-1.1 |
| **C-3** | `logformat squid …` redefines a built-in format name | Squid 6 refuses to start. Use a distinct name; drop `%ssl::>sni`, which is empty without `ssl_bump` — take the destination from the CONNECT target instead | WP-2.2 |
| **C-4** | Two `.env` files — Compose interpolates from `infra/compose/.env`, services read `../../.env` | The Postgres password in one and `DATABASE_URL` in the other drift silently | WP-1.1 |
| **C-5** | No volume for uploaded files | `api`, `ingest-worker` and `parser` all need the bytes; without a shared volume the upload path cannot work at all | WP-1.1 |

### 1.3 One CI contradiction

Design §6.3 says migrations are **forward-only**; §11.2 stage 6 says "test migration up and down". Writing `down` files to satisfy a CI stage would undo the forward-only decision. **Resolution:** stage 6 becomes *"migrate an empty database to head, then migrate the previous release tag's database to head"* — which is what actually happens at a customer site, and a stronger test than a `down` script nobody will run at 2 a.m.

---

## 2. G1 · Foundation that blocks everything — 15 pd

### WP-1.1 · Repo, toolchain, Compose stack, Dev Container · 6.5 pd · DO 4.5 · L 2

**Contents**

- pnpm 10 workspace: `apps/{api,web,parser}`, `packages/{shared-types,eslint-config,tsconfig}`, `infra/`, `eval/`, `docs/` — the tree in §7.
- Dockerfiles with **pinned** versions, every image by digest **(C-2)**: Node 22.13, pnpm 10, Python 3.12, `pgvector/pgvector:0.8.0-pg17` (the tag names the Postgres **major**; there is no `pg17.2` tag, so the digest is the pin and the real patch is recorded from `SELECT version()`), Infinity 0.0.76, and `ubuntu/squid:6.6-24.04_beta` (Canonical publishes squid only on `_beta` and `_edge`; the suffix is the image's channel, not the state of Squid 6.6, and the digest is what makes C-2 true). `api` is multi-stage with `dev` and `prod` targets; `api` and `ingest-worker` share one image and differ only by entrypoint.
- Compose stack **with C-1 fixed**: a `backend` network marked `internal: true` carrying api, ingest-worker, parser, postgres, redis, infinity; an `egress` network carrying only Squid; Squid joined to both.
- **C-4**: one `.env` at the repo root, `.env.example` committed, and a `pnpm dev` script wrapping `docker compose --env-file` so nobody has to remember the flag.
- **C-5**: an `uploads` named volume, read-write in api and ingest-worker, read-only in parser.
- `node_modules` as named volumes, never bind-mounted.
- `.devcontainer/devcontainer.json` with `typescript.tsdk` pointing inside the container, `runServices` limited to api/postgres/redis so opening the IDE does not demand the GPU, port 9229 exposed, and a `launch.json` with `remoteRoot: /workspace`.
- `config/` in the API: every environment variable parsed by a zod schema at boot; **a missing required variable stops the process** — no silent defaults (design §9.4).
- An `ingress` service (nginx) on `backend` and a new `ingress` network — **T-1.1-13, added at the gate**. Docker silently drops published ports for a container on an `internal: true` network, so without it `web` and `api` are unreachable from the host. It is the mirror of Squid: the only way in, as Squid is the only way out.
- A `llamacpp` service behind the `dev-local` profile — **T-1.1-14, added at the gate**, because §10 requires both profiles to start and no task created it.

**Done when**

```bash
docker compose config --quiet                                # parses, no interpolation warnings
docker compose up -d postgres redis infinity squid && docker compose ps
docker compose exec api sh -c 'ip route | grep -c default'   # → 0   (C-1 holds)
docker compose exec api sh -c 'getent hosts postgres redis infinity | wc -l'   # → 3
```

**Watch for.** The `internal: true` network is the easy thing to get subtly wrong: api must still reach `postgres`, `redis` and `infinity` and nothing else. Prove both directions on the day it is written, not at the gate. Infinity downloads its model weights on first boot — do that **before** the network is locked, or allowlist `huggingface.co` deliberately and record why.

### WP-1.2 · Schema, migrations, seed · 5.5 pd · L 4 · B2 1.5

**Every table from every phase**, plain numbered forward-only SQL.

| File | Contents |
| --- | --- |
| `001_extensions.sql` | `vector`, `unaccent`, `pg_trgm`, `pgcrypto`; **`immutable_unaccent()` (S-1)**; every ENUM: `version_status`, `turn_status`, `step_type`, `step_status`, `tool_classification` |
| `002_identity.sql` | `users`, `refresh_tokens` (family id, single-use, revocation), `login_attempts`, `group_mappings` |
| `003_workspaces.sql` | `workspaces`, `workspace_members`, `documents`, `document_grants`, `document_versions`, `pages`, `chunks` |
| `004_agent.sql` | `conversations`, `turns`, `agent_steps`, `answers`, `claims`, `citations` |
| `005_tools_governance.sql` | `tools`, `mcp_servers`, `pre_authorisations`, `approval_requests`, `approval_decisions`, `write_snapshots` |
| `006_audit_egress.sql` | `audit_events`, `allowlist_entries`, `egress_records`, `model_provider_settings` |
| `007_indexes.sql` | HNSW on `chunks.embedding halfvec_cosine_ops`, GIN on `chunks.text_search`, and the eight others from design §6.2 |

The invariant-bearing constraints inside these files are WP-2.1's work, listed separately because they are the part that must not be quietly skipped under time pressure.

Kysely types are generated from the live schema (`kysely-codegen`), so the SQL is the single source of truth and no hand-maintained parallel model can drift.

**Seed** (`infra/scripts/seed.ts`): 1 administrator, 3 sample users covering the other roles, 2 workspaces, 20 sample `.md` documents, and the `search_documents` tool row, enabled and classified `read`.

**Done when**

```bash
docker compose exec postgres psql -U postgres -d eiai -c "\dx"   # vector, unaccent present
docker compose exec postgres psql -U postgres -d eiai -c "\dt"   # every table, incl. write_snapshots
pnpm --filter api migrate:fresh && pnpm --filter api seed        # empty → head → seeded, no manual step
```

### WP-1.3 · Base CI — stages 1–3, 5, 6 · 3 pd · DO 2 · L 1

| Stage | Contents |
| --- | --- |
| 1 · Lint and format | ESLint + Prettier across the workspace |
| 2 · Typecheck | `tsc --noEmit` in every package |
| 3 · Unit tests | Vitest, coverage gate ≥80% on domain modules |
| 5 · Build | API, web and parser images |
| 6 · Migrations | Empty → head, and previous release tag → head **(§1.3)** |

Stage 4 (architecture) is WP-2.5; stages 7–9 are WP-5.4. The numbering follows design §11.2 so the pipeline reads the same as the document that specifies it, with the stages that are not yet implemented visibly skipped rather than silently absent.

**Done when** a pull request runs stages 1, 2, 3, 5 and 6, and a deliberately broken type turns stage 2 red.

---

## 3. G2 · Safety invariants — 17 pd

### WP-2.1 · Invariant database constraints · 2 pd · L

The five fixes of §1.1, written as part of the migrations and tested on their own — because the difference between "the constraint exists" and "the constraint refuses" is the whole point.

- S-1 `immutable_unaccent()` and the generated column built on it.
- S-2 partial unique index for one active pre-authorisation per tool.
- S-3 `decided_at` plus the corrected partial index.
- **S-4 the composite foreign key that makes FR-44 real**, and `tools_no_write_in_v1` (`classification = 'read' OR enabled = FALSE`).
- S-5 `reject_mutation()` and its triggers on `audit_events` and `approval_decisions`; no rules.

**Done when**

```bash
# FR-44 — the database refuses, not the service
docker compose exec postgres psql -U postgres -d eiai -c \
 "INSERT INTO pre_authorisations (tool_id, classification, created_by, justification)
  SELECT id,'write',(SELECT id FROM users LIMIT 1),'test' FROM tools WHERE classification='write' LIMIT 1;"
# expect: ERROR (foreign key / check violation)

# FR-66 — audit rows are immutable, loudly
docker compose exec postgres psql -U postgres -d eiai -c "UPDATE audit_events SET action='x';"
# expect: ERROR, not "UPDATE 0"
```

### WP-2.2 · Egress default-deny · 3 pd · DO 2 · L 1

- Squid on a pinned stable tag, the only service joined to the `egress` network.
- `squid.conf` with a **custom log format name (C-3)**, `include /etc/squid/allowlist.conf`, and `http_access deny all` as the last rule.
- `allowlist.conf` **ships empty**, and empty means nothing gets out. That is the default posture, not a misconfiguration.
- `allowlist_entries` table and `GET/POST /egress/allowlist`, Administrator only.
- Generating the file from the database and reloading Squid is **WP-5.2** — in week 3 the file is written by hand or by seed, which changes nothing about the invariant.

**Done when — the single most important check in Phase 1**

```bash
# empty allowlist, proxy env deliberately removed: we are testing the network, not a convention
docker compose exec -e HTTP_PROXY= -e HTTPS_PROXY= api \
  sh -c 'curl -s -m 5 -o /dev/null -w "%{http_code}\n" https://api.anthropic.com/v1/messages || echo BLOCKED'
# expect: BLOCKED — never a 2xx
docker compose exec api sh -c 'curl -s -o /dev/null -w "%{http_code}\n" https://example.com'   # expect 403 via Squid
docker compose exec squid tail -5 /var/log/squid/access.log                                    # expect TCP_DENIED
```

Then add one destination, reload, and watch the same request succeed with byte counts logged. **If the first request ever succeeds, Phase 1 cannot close.**

### WP-2.3 · Retrieval with the permission predicate · 6 pd · L

The security-critical package, and simultaneously the milestone's payoff.

- `hybrid-search.repository.ts` is **the only file in the codebase permitted to query `chunks`** — enforced by architecture rule 1 (WP-2.5), not by convention.
- The query keeps design §6.1's shape exactly: `permitted` CTE → `dense` (HNSW, 60 candidates) → `lexical` (GIN, `plainto_tsquery` over `immutable_unaccent`) → RRF fusion at k=60.
- `rank-fusion.ts` is a pure function with its own unit tests.
- The reranker is wired behind the same interface but **is not in the Phase 1 path** — FR-12/13 land in milestone 2A. Phase 1 returns the fused top-N.
- `RETRIEVAL_CANDIDATE_LIMIT`, `RETRIEVAL_KEEP_TOP`, `RETRIEVAL_RELEVANCE_FLOOR` come from config, never from constants.

**Two tests carry the invariant, and both exist before the gate:**

1. `permission-predicate.spec.ts` — compiles the query and asserts the generated SQL **contains** the `permitted` CTE and the `workspace_members` join. It asserts on the SQL, not on results, because results can be right by accident.
2. `leakage.spec.ts` — user A asks something that would match user B's restricted document; asserts B's chunk id appears in **no** result, **no** intermediate structure and **no** log line.

**Done when** both are green and deleting the `permitted` join turns both red.

### WP-2.4 · Audit, append-only · 4 pd · B2

- `audit_events` written **inside the caller's transaction** via `audit-transaction.interceptor.ts` — an action cannot succeed while its audit record fails.
- Phase 1 events: authentication (success, failure, lockout), workspace create and archive, membership change, upload, every ingestion state change, purge, permission change, configuration change, and every search with its workspace scope.
- `prev_hash`/`hash` written from the first event. **Chain verification, search and export are FR-67/68 and land in milestone 2D** — writing the chain now costs nothing and makes the later work a read-side feature instead of a retrofit.

**Done when** an upload produces exactly one audit event with a correct `prev_hash` link, and the S-5 check above raises.

### WP-2.5 · Architecture rules in CI — stage 4 · 2 pd · L 1 · DO 1

| # | Rule | Guards |
| --- | --- | --- |
| 1 | Only `modules/retrieval/hybrid-search.repository.ts` may query `chunks` | T-02 · the predicate is only reliable if there is exactly one query |
| 2 | Only `modules/governance/execution.gateway.ts` may import `modules/connectors` | T-01 · the approval gate cannot be bypassed |
| 3 | Modules do not import each other's services; only through `ports/` | the monolith's boundaries are real |
| 4 | `apps/web` imports from `packages/shared-types` only, never from `apps/api` | backend detail does not leak into the client |
| 5 | Only `adapters/model-provider/` may import a provider SDK | `ModelProviderPort` stays a seam, not a label |

Rules 2 and 5 guard code that does not exist yet. **Write them anyway** — a rule added before the code it constrains is a constraint; added afterwards it is a negotiation.

**Done when** stage 4 goes red on a deliberate violation: import `modules/connectors` from outside `governance` and watch the build fail.

---

## 4. G3 · The product path — 35 pd

### WP-3.1 · Identity · 7 pd · B2

Local accounts only. OIDC is FR-59 and lands in milestone 2D — do not start it here.

- Argon2id (`argon2` 0.41), per-user salt, configurable password policy.
- Access token 15 minutes; refresh token 8 hours, **single use**, rotating, carrying a `family_id`.
- **Reuse detection revokes the whole family** and forces a fresh login (`AUTH_TOKEN_REUSE`).
- Rate limit 10 attempts per account per 15 minutes; lockout after 10 consecutive failures, the 11th returning `AUTH_ACCOUNT_LOCKED` (423).
- A revocation list in Redis so a disabled account loses its sessions within 60 seconds; the admin surface for disabling is Phase 2, the mechanism is here.
- Refresh token in an HttpOnly cookie, access token in the `Authorization` header.

**Done when** one integration test walks log in → refresh → replay the *first* refresh token → family revoked, both tokens dead; and a second makes 11 failed logins and asserts the 11th returns `AUTH_ACCOUNT_LOCKED`.

### WP-3.2 · Authorisation · 5 pd · B2

- Five system roles with the permission matrix exactly as design §9.1; three workspace roles — Owner, Editor, Reader.
- `JwtAuthGuard`, `RolesGuard`, `WorkspaceRoleGuard`, and the decorators that drive them.
- **The matrix test is generated from a table, not hand-written**: one case per role × action pair, so adding an action to the matrix without implementing it fails the build. 5 system roles × 13 actions + 3 workspace roles × 4 actions = **77 cases, 100% required**.

**Done when** the matrix reports 77/77 and a deliberately loosened guard turns it red.

### WP-3.3 · Workspaces, upload, storage · 5 pd · L

- Workspace CRUD, archive (archived workspaces leave retrieval but are retained), membership management.
- Upload of the 10 formats — PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, PNG, JPG, TIFF — to 200 MB and 2,000 pages. **ZIP expansion is WP-5.1.**
- **Content-type sniffing against the extension** by file signature; a mismatch is `DOC_CONTENT_MISMATCH` (415). Uploads are never rendered or executed server-side: downloads leave as `Content-Disposition: attachment` with `X-Content-Type-Options: nosniff`.
- `StoragePort` + `LocalFsAdapter` writing under the `uploads` volume, keyed by sha256; `document_versions.storage_key` points at it.
- Duplicate content within a document is rejected by `dv_content_unique`, not by application code.

Non-Markdown formats are **accepted and stored** in Phase 1 and stop at `uploaded` — the parser attaches in milestone 2A. The documents list shows that state honestly rather than pretending to index them.

**Done when** a `.pdf` whose bytes are an ELF executable is rejected with `DOC_CONTENT_MISMATCH`, and a 201 MB file with `DOC_TOO_LARGE`.

### WP-3.4 · Markdown ingestion pipeline · 7 pd · L 5 · B2 2

The first end-to-end path: bytes → chunks → vectors → index.

- BullMQ queue and the `ingest-worker` entrypoint (same image as the API).
- State machine subset: `uploaded → parsing → parsed → chunking → embedding → indexed`, plus `failed` with a reason. Markdown and text need no parser, so `parsing` is a pass-through writing one `pages` row with `extraction_method = 'text_layer'`. This keeps the state machine honest and means milestone 2A adds a worker rather than a new shape.
- Chunker: 200–400 tokens, 15% overlap, **character offsets preserved** and resolvable back to the source, `heading_path` taken from the Markdown structure.
- Embedding through `InfinityClient` (BGE-M3, 1024 dims → `halfvec`), batched at 8 to respect the VRAM budget, with retry and back-off.
- `chunker_version` and `parser_version` recorded on every version, so a re-index after a chunker change is identifiable.

**Decision D-5 — how tokens are counted.** The chunk size must mean the same thing to the chunker as to BGE-M3, or "200–400 tokens" is fiction. Recommended: run the XLM-RoBERTa tokenizer in the worker (`@huggingface/transformers`, WASM, no GPU) so counts match the embedding model exactly. Fallback if it proves slow: a character-ratio approximation calibrated against the tokenizer on the proxy corpus, with the ratio recorded in `chunker_version`. Decide in week 2 with a measurement, not an opinion.

**Done when** uploading a `.md` folder reaches `indexed`, `SELECT count(*) FROM chunks WHERE embedding IS NULL` returns `0`, and a randomly chosen chunk's `char_start`/`char_end` slice out of the original file matches `chunks.text` exactly.

### WP-3.5 · Tool registry skeleton and operating mode · 2 pd · L

- `tools` rows for the three internal tools; only `search_documents` is enabled in Phase 1 (the other two are implemented in 2B).
- Role filtering by `min_system_role` **in the query**, so a tool the caller's role cannot use never appears in any catalogue, anywhere.
- **Operating mode is computed, never configured.** The registry derives it per request from the tools that are enabled and reachable. With zero MCP servers and `web_search` off the mode is `document-only` — the default install and the default CI scenario.
- `GET /me` returns the user, roles, workspace memberships, operating mode and the `FEATURE_STATUS` map that drives the web app's "Coming soon" panels.

**Done when** `GET /me` reports `"operatingMode": "document-only"` on a clean install with `mcp_servers` empty, and no health indicator reads `unreachable` because of it.

### WP-3.6 · Web — 19 routes, four of them real · 9 pd · FE

**All 19 routes exist from day one.** Four are real; fifteen show `ComingSoon` with a description and the phase they are planned for. A dead link teaches people the product is unfinished; a described placeholder teaches them what is coming.

| Real in Phase 1 | Coming soon |
| --- | --- |
| Login (local accounts) | Ask, Running, Answer, Refusal, Partial answer, Source viewer |
| Workspace list | Approval inbox, Approval detail |
| Workspace documents + Upload | Tool admin, Connector admin, Egress admin, User admin |
| **Search documents** — passages with file name and position, no generated text | Audit log, Health, Evaluation, Restore |

- `apiClient.ts` parses `problem+json`, refreshes tokens transparently, propagates `X-Correlation-Id`.
- `features.ts` reads `FEATURE_STATUS` from `GET /me`; sidebar badges follow it, so flipping a flag changes the UI with no code change.
- **The web app makes no security decision.** Hiding an admin item is tidiness; a Member who types `/admin/users` must receive a 403 from the server, not a blank screen from the router.

The static wireframes inside the "Coming soon" panels and the accessibility pass are **WP-5.5** — in week 3 the panel is a description and a phase label, which is already better than a dead link.

**Done when** all 19 routes render with no console error, a Member's direct navigation to an admin route yields a server 403, and the search screen returns passages for a seeded query.

---

## 5. G4 · Measurement — 10 pd, parallel lane

### WP-4.1 · Corpus, OCR spike, GPU benchmark · 10 pd · ML

Runs from day 1, touches no product code, blocks nobody.

1. **Proxy corpus** — 30–50 scanned legal PDFs with Vietnamese diacritics, stamps and multi-column layout; 10–20 report documents with real tables; a set of `.md` files. Hand-transcribe a reference sample large enough to measure against — roughly 20 pages spread across document classes.
2. **OCR spike** — Docling + Tesseract (Vietnamese + English) over the corpus, out-of-band. Report character-level and field-level accuracy against the reference, **per document class** — an average across classes hides the case that matters.
3. **GPU benchmark** — VRAM with BGE-M3 and the reranker both loaded; embedding throughput in chunks/second at batch 8; rerank latency for 60 candidates.

**Done when** `docs/ops/week-1-measurements.md` holds the five numbers of §12, each with the command or method that produced it, and an explicit R-01 recommendation: proceed, or trigger the fallback.

**The number that can change the plan is OCR accuracy.** Below 90% triggers R-01: commercial OCR at roughly $1.50 per 1,000 pages, or a narrower v1 format list stated plainly to the customer. **That decision belongs to week 3, not week 12.**

---

## 6. G5 · Pre-agreed slack — 10 pd

Cut in this order if capacity runs short. Each entry names where it lands instead.

| # | Package | pd | Lane | Deferred to | Cost of deferring |
| --- | --- | --- | --- | --- | --- |
| **WP-5.1** | ZIP expansion on upload, to 500 files | 2 | L | Week 4, inside 2A | Bulk loading the proxy corpus is manual for two weeks |
| **WP-5.2** | Generate `allowlist.conf` from the database, reload Squid | 2 | DO 1 · L 1 | Week 4 | The allowlist is edited by hand in week 3 — **the invariant is unaffected**, only the convenience |
| **WP-5.3** | Document detail API and screen — versions, per-page extraction, grants | 2 | L 1 · FE 1 | Week 4, with the parser's per-page data | Nothing in Phase 1 needs it; it is genuinely more useful once OCR fills it in |
| **WP-5.4** | CI stages 7–9 — Testcontainers integration, empty red-team harness, security scan + GHCR push | 2 | DO | Week 4 | Integration tests run locally in the meantime; **do not defer past week 4** |
| **WP-5.5** | Contract tests for the `501` routes, "coming soon" wireframes, accessibility pass on 4 screens | 2 | FE 1.5 · B2 0.5 | Weeks 4–5 | The accessibility pass is cheaper now than after fifteen more screens exist |

**Stage 8 is an empty harness, and says so.** With no agent loop in Phase 1 there are zero red-team cases; the stage prints `0 cases — agent loop lands in milestone 2B`. A stage that silently passes on nothing is worse than one that announces it.

---

## 7. Repository layout created in Phase 1

```
ei-ai/
├─ apps/
│  ├─ api/                     # NestJS 11 — modular monolith; API and worker share one image
│  │  └─ src/
│  │     ├─ main.ts            # HTTP bootstrap
│  │     ├─ worker.main.ts     # BullMQ consumer — same image, different entrypoint
│  │     ├─ common/            # guards, filters, interceptors, pipes, error codes
│  │     ├─ config/            # zod-validated environment; boot fails on a missing variable
│  │     ├─ database/          # Kysely instance, generated types, migrations/*.sql
│  │     ├─ ports/             # model-provider · vector-store · storage — only three seams
│  │     ├─ adapters/          # storage/local-fs, embedding/infinity.client, model-provider/*
│  │     └─ modules/           # 14 modules, six of them real (§7.1)
│  ├─ web/                     # React 19 + Vite 6 + Tailwind 4 + shadcn/ui
│  └─ parser/                  # Python 3.12 — skeleton only; used out-of-band for the OCR spike
├─ packages/
│  ├─ shared-types/            # DTOs, error codes, feature flags — one source of truth, both ends
│  ├─ eslint-config/
│  └─ tsconfig/
├─ infra/
│  ├─ compose/                 # docker-compose.yml — the GPU reservation sits on the service
│  ├─ postgres/init/           # CREATE EXTENSION on first boot
│  ├─ squid/                   # squid.conf + allowlist.conf (ships empty) — the only way out
│  ├─ ingress/                 # nginx.conf — the only way in
│  └─ scripts/                 # seed, backup, bundle
├─ eval/
│  ├─ golden-set/              # empty in Phase 1; the customer's 2h/week starts week 4
│  └─ runner/                  # directory + README only
├─ docs/{design,plan,ops}/
├─ .devcontainer/
└─ .github/workflows/          # ci.yml — 9 stages
```

### 7.1 Fourteen modules, six of them real

| Module | Phase 1 state | Completed in |
| --- | --- | --- |
| `identity` | **Full** — local auth, tokens, lockout | 1 |
| `workspaces` | **Full** — CRUD, membership, workspace roles | 1 |
| `ingestion` | **Full for Markdown**; every other format stored at `uploaded` | 2A |
| `retrieval` | **Full** — hybrid + RRF + permission predicate; rerank wired, not enabled | 2A |
| `audit` | **Full write side**; verification and export later | 2D |
| `egress` | **Full default-deny + allowlist API**; admin UI later | 3C |
| `tools` | Registry skeleton, one enabled tool, operating mode computed | 3A |
| `agent` | Module file + `501` controller | 2B |
| `answering` | Module file + `501` controller | 2C |
| `evaluation` | Module file + `501` controller | 2D |
| `governance` | Module file + `501` controller | 3B |
| `connectors` | Module file + `501` controller | 3A |
| `model-provider` | Port and adapters compile; admin surface `501` | 3D |
| `admin` | Health endpoint only (DB, Redis, disk); the rest `501` | 4A |

`workspaces` as a module of its own is a deliberate deviation from design §5.4, which gives FR-01/61/62 no home. Putting it inside `identity` would grow an already large module; putting it inside `ingestion` mixes two responsibilities. Recorded here so nobody reads it as a mistake.

**An unbuilt module is a `501` with a body**, not a 404: `{ "code": "NOT_IMPLEMENTED", "feature": "agent-loop", "plannedPhase": "2B" }`. Contract tests for Phase 2 and 3 endpoints can then be written now and go green as each lands.

---

## 8. API surface in Phase 1

**Implemented**

| Method | Path | Role | FR |
| --- | --- | --- | --- |
| POST | `/auth/login` | — | FR-58, 65 |
| POST | `/auth/refresh` | cookie | FR-64 |
| POST | `/auth/logout` | Bearer | FR-64 |
| GET | `/me` | Bearer | FR-21, 75 skeleton |
| GET/POST | `/workspaces` | Member / Knowledge Manager | FR-01 |
| GET/PATCH | `/workspaces/{id}` | workspace roles | FR-01, 62 |
| GET/POST/DELETE | `/workspaces/{id}/members` | Owner | FR-62 |
| POST | `/workspaces/{id}/documents` | Editor+ | FR-02, 09 |
| GET | `/workspaces/{id}/documents` | Reader+ | FR-02 |
| GET | `/documents/{id}` | Reader+ | FR-06 partial |
| GET | `/documents/{id}/download` | Reader+ | FR-09 |
| POST | `/search` | Member | **FR-10, 11** |
| GET/POST | `/egress/allowlist` | Administrator | FR-45 |
| GET | `/health` | Administrator | FR-78 partial |

`POST /search` is the Phase 1 stand-in for the agent's `search_documents` tool: same repository, same permission predicate, no model anywhere in the path. When 2B arrives the tool wraps this call rather than replacing it.

**Stubs returning `501`** — `/turns/*`, `/conversations/*`, `/answers/*/feedback`, `/tools`, `/pre-authorisations`, `/approvals/*`, `/mcp-servers/*`, `/egress/records`, `/model-providers/*`, `/admin/audit/*`, `/admin/users`, `/evaluations/*`, `/admin/backups/*`.

---

## 9. Day-level schedule — 15 working days · **not in force**

> **Superseded on 2026-09-12 by D-2, option D** — one operator, no date commitment ([progress §3.2](./ei-ai-progress.md)). Five parallel lanes describe a team that does not exist, so no day in this table is a commitment and no lane is a person. **The execution order is the wave table in [tasks §2](./ei-ai-phase-1-tasks.md#2-execution-order)**, which is a property of the dependency graph and therefore valid at any headcount. The schedule below is kept because it records which packages interleave and where the lane conflicts are — read it as a dependency sketch, not a calendar.

Assumes the second backend is available from day 1 (overview §6). Lanes run in parallel; a package appears on the day its lane starts it.

> **This layout is optimistic and is kept as a shape, not a commitment.** Running the 149 tasks through their dependency graph puts this staffing at day 32, not day 15 — see [overview §6](./ei-ai-phase-1-overview.md) for what each staffing option actually costs, and [tasks §2](./ei-ai-phase-1-tasks.md) for the order that does not depend on staffing.

| Day | Lead | Backend 2 | Frontend | ML | DevOps |
| --- | --- | --- | --- | --- | --- |
| 1 | WP-1.1 tree, pnpm workspace | `shared-types`, error codes, `problem+json` | Vite, Tailwind, shadcn | WP-4.1 corpus | WP-1.1 Dockerfiles |
| 2 | WP-1.1 config + zod boot | `common/` guards, pipes, interceptors | AppShell, sidebar, `ComingSoon` | corpus + reference transcription | WP-1.1 Compose, two networks **(C-1)** |
| 3 | WP-1.2 migrations 001–003 | `common/` finish, `apiClient` | router — all 19 routes | OCR harness | WP-1.1 Dev Container, `.env` **(C-4)** |
| 4 | WP-1.2 004–006 · **WP-2.1** | WP-3.1 users, Argon2id | login screen | OCR run 1 | WP-1.3 CI stages 1–3, 5 |
| 5 | WP-1.2 007 indexes + seed | WP-3.1 access/refresh tokens | auth flow, token refresh | **GPU benchmark** | **WP-2.5** arch rules — stage 4 |
| — | **End of week 1 — G1 complete: stack up, every table in, 19 routes render, measurements started** | | | | |
| 6 | WP-3.3 workspaces CRUD | WP-3.1 rotation, family revocation | workspace list | OCR run 2, per-class accuracy | **WP-2.2** Squid, egress network |
| 7 | WP-3.3 upload, sniffing | WP-3.1 lockout, rate limit | documents table | table extraction check | WP-2.2 allowlist table + API |
| 8 | WP-3.3 storage adapter | WP-3.2 guards | upload UI, progress | accuracy report draft | WP-1.3 stage 6 migrations |
| 9 | WP-3.4 chunker + offsets | WP-3.2 matrix test (77) | ingestion status | embedding throughput | egress verification run |
| 10 | WP-3.4 embed, BullMQ worker | WP-3.2 workspace roles | documents polish | rerank latency, VRAM | WP-5.4 stages 7–9 |
| — | **End of week 2 — G3 core + G2 egress: log in, upload, index, empty allowlist denies** | | | | |
| 11 | **WP-2.3** hybrid query | **WP-2.4** audit interceptor | search screen | measurement write-up | CI hardening |
| 12 | WP-2.3 RRF, candidate limits | WP-2.4 events + hash chain | search results, positions | **R-01 recommendation** | image publish to GHCR |
| 13 | WP-2.3 predicate + leakage tests | integration tests, Testcontainers | search polish | handover to 2A parser work | WP-5.2 allowlist generation *(if room)* |
| 14 | WP-3.5 registry, operating mode | contract tests for `501` routes | WP-5.5 wireframes, a11y | spare | **clean-machine install rehearsal** |
| 15 | **Gate run — §10, all lanes** | | | | |

**The clean-machine install rehearsal on day 14 is not optional.** NFR-17 requires an outsider to install the system from documentation in under four hours, and the only way that is true in week 26 is if it has been true since week 3, when the stack is small enough to fix cheaply.

---

## 10. Acceptance gate, by group

Every line carries the command that proves it. A line without a passing command is not done.

**G1 — foundation**

- [ ] `git clean -xdf && cp .env.example .env && docker compose up -d && docker compose ps` on a clean machine — all services up, postgres healthy, no manual step
- [ ] `docker compose exec postgres psql -U postgres -d eiai -c "\dt"` lists every table, including `write_snapshots`
- [ ] Both profiles start — default, and `docker compose --profile dev-local up -d llamacpp`
- [ ] CI green on stages 1, 2, 3, 5, 6

**G2 — invariants (none of these may be waived)**

- [ ] `docker compose exec api sh -c 'ip route | grep -c default'` → `0`
- [ ] Empty allowlist, proxy env removed → the request fails at the network; Squid logs `TCP_DENIED`
- [ ] After seeding one destination → the same request succeeds, byte counts logged
- [ ] `permission-predicate.spec.ts` asserts the generated SQL contains the `permitted` CTE
- [ ] `leakage.spec.ts` — user A receives none of B's restricted chunks in results, logs or intermediate structures
- [ ] Deleting the `permitted` join turns both tests red
- [ ] `UPDATE audit_events …` raises an exception rather than silently doing nothing
- [ ] Pre-authorising a write tool is refused **by the database**
- [ ] CI stage 4 red on a deliberate architecture violation
- [ ] **No generated text anywhere in the execution path** — `grep -rniE "anthropic|completion|prompt" apps/api/src/modules --include=*.ts` returns nothing outside `adapters/model-provider/`, which Phase 1 never calls

**G3 — the product path**

- [ ] 11 consecutive failed logins → `AUTH_ACCOUNT_LOCKED`; replaying a used refresh token revokes the family
- [ ] Permission matrix 77/77; Reader cannot upload, Editor cannot change membership
- [ ] A Member requesting an admin route receives 403 from the API, not a blank page from the router
- [ ] Upload a `.md` folder → `indexed`; `SELECT count(*) FROM chunks WHERE embedding IS NULL` → `0`
- [ ] A chunk's `char_start`/`char_end` slice out of the source file matches `chunks.text` exactly
- [ ] A `.pdf` containing an executable → `DOC_CONTENT_MISMATCH`; a 201 MB file → `DOC_TOO_LARGE`
- [ ] The search screen returns relevant passages with file name and position
- [ ] `GET /me` reports `document-only` with `mcp_servers` empty, and nothing reads `unreachable`
- [ ] All 19 screens open; the 15 unbuilt ones name what they will do and the phase they arrive in

**G4 — measurement**

- [ ] `docs/ops/week-1-measurements.md` holds all five numbers of §12, each with its method
- [ ] The OCR number carries an explicit R-01 recommendation — proceed, or trigger the fallback

---

## 11. Test plan for Phase 1

| Type | What it covers here | Target |
| --- | --- | --- |
| Unit | RRF fusion, chunk boundary maths, token counting, content sniffing, password policy | ≥80% lines in domain modules |
| Integration (Testcontainers) | Every migration, token lifecycle, permission matrix, ingestion state machine | 77/77 role-action pairs |
| **Leakage** | User A never sees B's chunks in results, logs or intermediate structures | 0 leaks |
| **Architecture** | The five rules of WP-2.5 | 5 rules, no exceptions |
| **Network** | Default-deny egress **with the proxy environment removed** | 1 test, in CI |
| Contract | Every `501` route returns the documented shape with `feature` and `plannedPhase` | all stubs *(WP-5.5)* |
| E2E (Playwright) | Log in → create workspace → upload → `indexed` → search → passages | 1 flow |

The agent-loop, red-team, chaos, load, soak and quality suites belong to later phases. Their directories and harness entry points exist now so nobody has to invent a home for them under time pressure.

---

## 12. Traceability — requirement to package

| FR | Requirement | Package |
| --- | --- | --- |
| FR-01 | Workspace create, rename, archive | WP-3.3 |
| FR-02 | Upload 10 formats, 200 MB, 2,000 pages · ZIP | WP-3.3 · WP-5.1 |
| FR-04 | Chunk 200–400 tokens, 15% overlap, offsets kept | WP-3.4 |
| FR-05 | Embedding and full-text vector for every chunk | WP-3.4 |
| FR-09 | Content-type sniffing; never render or execute uploads | WP-3.3 |
| FR-10 | Hybrid dense + lexical with RRF | WP-2.3 |
| **FR-11** | **Permission predicate inside the query** | **WP-2.3** |
| FR-21 | Tool registry *(skeleton)* | WP-3.5 |
| **FR-45** | **Default-deny egress, enforced by a network component** | **WP-2.2** |
| FR-58 | Local auth, Argon2id, password policy | WP-3.1 |
| FR-61 | Five system roles, matrix enforced by test | WP-3.2 |
| FR-62 | Three workspace roles | WP-3.2 |
| FR-64 | 15-minute access, rotating single-use refresh, family revocation | WP-3.1 |
| FR-65 | Auth rate limit and lockout | WP-3.1 |
| FR-66 | Append-only audit in the caller's transaction | WP-2.4 |
| FR-75 | Works with zero MCP servers *(skeleton)* | WP-3.5 |
| FR-44 | Write tools can never be pre-authorised *(constraint in place before the capability)* | WP-2.1 |
| FR-03 | Parser and OCR — **spike only**, no product code | WP-4.1 |

**Five numbers out** (overview §7): VRAM in use · embedding throughput · **OCR accuracy** · HMR latency · empty-allowlist denial.

---

## 13. Risks specific to Phase 1

| Risk | Probability | Handling |
| --- | --- | --- |
| **Capacity — 86 pd of work against 52.5 pd staffed** | **Certain unless decided** | Overview §6. Decide before day 1; G5 exists so the cut is pre-agreed rather than improvised in week 3 |
| Vietnamese OCR misses the 90% bar (R-01) | Medium | The reason the spike is in week 1. Fallback: commercial OCR (~$1.50/1,000 pages) or a narrower v1 format list |
| No real customer documents, so R-01 cannot close | **High — already true** | The proxy corpus moves this from blind to estimated. Hard milestone: real documents before week 8 |
| The two models do not fit in 4 GB VRAM | Low | ~2.4 GB at fp16 leaves headroom. If tight: reranker at int8, or on CPU — acceptable at development corpus size |
| Token counting mismatch makes "200–400 tokens" meaningless | Medium | D-5 in WP-3.4 — settle it in week 2 with a measurement |
| `internal: true` breaks a service that legitimately needs egress | Medium | Only Squid needs it. Infinity downloads weights **once** on first boot — do that before the network is locked, or allowlist `huggingface.co` deliberately and record why |
| Docker WSL integration breaks again mid-phase | Medium — it broke once already | `docker ps` in the start-of-day check. Five seconds, and it has already cost an afternoon once |
| The "no generated text" rule erodes under demo pressure | Medium | The grep in the G2 gate list makes it mechanical rather than a matter of willpower |

---

## 14. What Phase 1 hands to Phase 2

A foundation with four properties that later phases assume without re-checking:

1. **Every table exists**, so no migration between here and week 26 is a schema change on a live corpus.
2. **The permission predicate lives in one reviewed query**, in the one file allowed to touch `chunks`.
3. **Nothing reaches the network without an allowlist entry** — enforced by the network, not by a convention in code.
4. **The audit chain has been written since the first event**, so verification in milestone 2D is a read-side feature rather than a retrofit.

Milestone 2A then starts by attaching the Python parser to the front of a pipeline that is already running — not by building one. Milestone 2B wraps `POST /search` as the agent's `search_documents` tool rather than writing retrieval again.

# Ei-AI — Implementation Plan

> Turns the [system design](../design/ei-ai-agentic-knowledge-assistant.md) (80 FRs, 22 NFRs, 11 ADRs) into four build phases. Each phase has one runnable milestone, a closed set of requirements, and an acceptance gate that must be green before the next phase starts.

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Date | 2026-09-09 |
| Status | Draft — awaiting review |
| Total effort | ~114 person-weeks |
| Timeline | 26 weeks |
| Team | 5 people (1 part-time) |
| Supersedes | [v1 plan](../archive/v1-non-agentic/) — deterministic pipeline, 100 pw / 23 weeks |

**Companion documents**

- [Development environment](./ei-ai-dev-environment.md) — ADR-12, ADR-13, machine inventory, Compose stack, and the **setup runbook with per-step verification** (§9.1)
- [Phase 1 · Overview](./ei-ai-phase-1-overview.md) — week 1–3 work grouped by priority, with the cut decided in advance
- [Phase 1 · Detail](./ei-ai-phase-1-detail.md) — 20 work packages, a day-level schedule, and a gate where every item is proved by a command
- [Phase 1 · Tasks](./ei-ai-phase-1-tasks.md) — 149 tasks with hours, dependencies and an acceptance test each
- [Progress tracker](./ei-ai-progress.md) — **the single place status is recorded**, for every phase
- [System design](../design/ei-ai-agentic-knowledge-assistant.md) — the authority on requirements, architecture and ADRs *(in Vietnamese)*

---

## 1. Overview

### 1.1 Four phases

Phase boundaries are drawn by one test: **if we stopped here, what of value would exist?**

| Phase | Weeks | Effort | Stop here and you have |
| --- | --- | --- | --- |
| **1 · Foundation** | 1–3 | 15 pw | Semantic search over uploaded documents. Better than file search, not yet a product |
| **2 · Document assistant** | 4–12 | 41 pw | **A complete product you could hand a customer** — the `document-only` operating mode |
| **3 · Tools & ERP** | 13–19 | 28 pw | Live figures cross-checked from the ERP, behind a human approval gate |
| **4 · Hardening & handover** | 20–26 | 30 pw | A system the customer's own IT can run without us |

**The most important consequence of ADR-10:** the end of Phase 2 is no longer "internally usable" — it is **commercially deliverable**. `document-only` is a complete product, so week 12 is a business milestone, not just an engineering one. If the ERP integration slips or the customer changes their mind, there is still something to sell.

### 1.2 Requirement coverage per phase

| Phase | FRs closed | Count |
| --- | --- | --- |
| 1 | 01, 02, 04, 05, 09, 10, 11, 45, 58, 61, 62, 64, 65, 66 · skeleton of 21 | **14** |
| 2 | 03, 06, 07, 08, 12–20, 23–27, 29–37, 59, 63, 67, 68, 71, 75, 76, 78, 79, 80 | **37** |
| 3 | 21, 22, 28, 38–44, 46–57, 60, 77 | **24** |
| 4 | 69, 70, 72, 73, 74 | **5** |
| — | **Total** | **80 of 80** |

Two entries need explaining. **FR-75** (the system works with zero MCP servers) closes in Phase 2 because that is when `document-only` becomes a complete product — but the guarantee is designed into Phase 1 and re-verified in Phase 3 once MCP exists to be absent. **FR-21** (tool registry) has its skeleton in Phase 1 so `search_documents` can be registered, and closes in Phase 3 when MCP-discovered tools and role filtering arrive.

FR-44 (write tools can never be pre-authorised) is enforced by a database constraint in Phase 1 and tested in Phase 3, even though no write tool ships in v1. That is deliberate — the rule is in place before the capability it governs.

### 1.3 Boundary principles

1. **Phase 1 builds the whole skeleton, not half of it.** Every table, every route, every container exists from the start — including tables for post-v1 features. Changing the schema in week 20 costs many days; an empty table costs nothing.
2. **Phase 2 delivers a whole product, not a demo.** `verified-or-refused` and `visible` are both complete at week 12. Nothing about the answer quality guarantee is deferred.
3. **Phase 3 opens the network.** No byte leaves for a business purpose until the approval gate, the egress allowlist and the audit trail are all working together.
4. **Phase 4 adds no user-facing capability** beyond the operational FRs. It exists to make the system survivable in someone else's hands.

---

## 2. Three changes from the design's roadmap

The design's section 13.2 sketched a roadmap before the operating-mode decision (ADR-10) was fully worked through. Three changes follow from it, recorded here with reasoning.

### Change 1 — The agent gets **three internal tools** in Phase 2, not one

This is the most consequential change, and it corrects a real flaw.

**With a single tool, NFR-11 (trajectory accuracy) cannot be measured.** The agent can only choose between "search again" and "done" — that is not tool selection. Yet tool selection is precisely the largest new risk (R-02: is a local model reliable enough at multi-turn tool calling?).

The old roadmap put the eval harness at week 10 to measure trajectory, but at that point only one tool would exist, making the metric meaningless.

| Tool | What it does | Why it earns its place |
| --- | --- | --- |
| `search_documents` | Hybrid search + rerank | Already required |
| `read_document_page` | Full page around a span | The agent finds a passage and wants surrounding context — a genuinely common need |
| `list_workspace_documents` | What documents a workspace holds | Gives the agent a way to decide it **should refuse** rather than search forever |

All three are thin wrappers over queries the UI already needs. **About 3 days of work**, and it buys: real tool selection, trajectory measurable from week 10, and R-02 surfacing in Phase 2 instead of Phase 3.

The third tool has a valuable side effect — it gives the agent a way to **know what it does not know**, which directly serves NFR-10 (refusal accuracy ≥ 95%).

### Change 2 — Squid moves to Phase 1

The development environment calls the Anthropic API from day one (ADR-12). That means **an outbound path exists from week 1**, while the old roadmap placed Squid at week 18.

Left alone, we would hand over an egress control that **had never run under real load** — switched on in week 19 and tested for a few days.

**Decision:** the Squid container, the `allowlist_entries` table and the config generation land in Phase 1 (~1 week, already inside the total). The allowlist admin UI stays in Phase 3 with the other admin screens; Phase 1 configures it through seed data and environment variables.

The benefit is that "nothing leaves without permission" is true from week 1 rather than week 19, and by the time `web_search` and the ERP arrive, the allowlist mechanism is already proven.

### Change 3 — The loop must be **pause-capable** in Phase 2, before anything pauses

Every Phase 2 tool is internal, so nothing needs approval. But if the loop is written as a straight-through run, adding the approval gate in Phase 3 means rewriting it.

The design already avoids this (steps are persisted, the loop reads from the database), but that must be **an acceptance criterion of Phase 2**, not something we hope holds:

> **Phase 2 test:** artificially halt a step by setting `status = 'awaiting_approval'` directly in the database → restart the API → the turn resumes from exactly that step once the status changes.

If that test is green at week 12, the Phase 3 approval gate is just one more step type.

---

## 3. Development environment

Two decisions carry over from before the design rewrite. They concern how the team works, not what the product does, so the rewrite left them untouched. Full detail in [the environment document](./ei-ai-dev-environment.md).

| | |
| --- | --- |
| **ADR-12 · `dev-hybrid` profile** | Embedding and rerank run locally on the demo machine's GPU; generation goes to the Anthropic API via `ModelProviderPort`. The demo laptop has **4 GB VRAM** — enough for retrieval, not for generation |
| **ADR-13 · Everything in Docker** | The host needs only Docker Desktop, VS Code and Git. Source lives in an Ubuntu WSL2 distro at `~/ei-ai`; the toolchain lives in the image, so versions are guaranteed by the Dockerfile rather than by reminders |

**Three model profiles**

| Profile | Embedding + rerank | Generation | Used for |
| --- | --- | --- | --- |
| `dev-hybrid` | BGE-M3 + BGE-reranker on the 4 GB GPU | Anthropic API, `claude-haiku-4-5` by default | Daily development. Phases 1–2 default |
| `dev-local` | Same | Qwen3-4B 4-bit on CPU (llama.cpp) | Proving the local path is not rotting. **Run at every phase gate** |
| `prod` | BGE-M3 + BGE-reranker on the customer's GPU | vLLM with a model sized to the hardware tier | The customer's machine, from Phase 4 |

**Why `claude-haiku-4-5` rather than the strongest available model:** the production target is a local ~32B model. Developing against the strongest model would produce prompts that lean on capability production will not have, turning the Phase 4 swap into a cliff. A closer capability tier makes it a step. `claude-sonnet-5` is reserved for **ceiling measurement** — run the golden set against it when you need to know whether a weak result is the prompt or the model.

**Three mandatory controls on that risk**

1. Run the golden set on **both** `dev-hybrid` and `dev-local` at every phase gate. The gap between them is a tracked metric, not a week-20 surprise.
2. Never write a prompt that depends on one provider's proprietary feature. The verifier returns JSON against our own schema.
3. Freeze real hardware before week 16 so Phases 3 and 4 can measure on `prod`.

**Latency figures measured on the demo machine are not evidence about production.** Do not use them to conclude anything about NFR-01 or NFR-02, to promise ingest times, or to size the customer's GPU.

### Setup progress

| Step | Status | Notes |
| --- | --- | --- |
| B0 · git init, remote, push | ✅ Done | Pushed through `11de8fd`; check with `git rev-list --count origin/main..HEAD` |
| B1 · Free ≥45 GB on C: | ✅ Done | 50 GB free |
| B2 · `.wslconfig` applied | ✅ Done | WSL reports 17.6 GB — the 18 GB cap is active |
| B3 · Ubuntu, tooling, Docker, git identity | ✅ Done | User `howie`; git 2.53, curl 8.18; `docker ps` works from Ubuntu |
| B3f · **Source cloned to `~/ei-ai` on ext4** | ✅ Done | `df -T` reports `ext4` — ADR-13's condition holds. Case sensitivity confirmed |
| B5 · GPU passthrough from Ubuntu | ✅ Done | RTX 3050 Ti, 4096 MiB, driver 581.95 |
| B4 · VS Code extensions + Remote-WSL | 🔴 Manual | GUI steps — see environment doc §9.1 steps 4–5 |
| B6 · Retire the Windows copy | 🔴 Manual, last | Restart Claude Code at `~/ei-ai` first |

---

## 4. Phase 1 — Foundation

**Weeks 1–3 · 15 pw · Goal: it runs, it searches, it does not answer**

> Broken down in three layers: [Phase 1 · Overview](./ei-ai-phase-1-overview.md) groups the work by priority and records the capacity gap between this 15 pw / 3-week budget and the staffing in §9.1; [Phase 1 · Detail](./ei-ai-phase-1-detail.md) opens each group into work packages with a proving command each, and [Phase 1 · Tasks](./ei-ai-phase-1-tasks.md) opens those into 149 individual tasks.

### 4.1 What ships

| Work package | Contents | FRs |
| --- | --- | --- |
| Repo & CI | pnpm monorepo, devcontainer, Compose stack, 9-stage CI including **architecture tests** | — |
| Schema | Every table, including Phase 3–4 tables and `write_snapshots` for the post-v1 write path. Plain numbered forward-only SQL migrations | — |
| Identity | Local auth with Argon2id, 15-minute access tokens, single-use rotating refresh tokens with family revocation, auth rate limiting and lockout | FR-58, 64, 65 |
| Authorisation | 5 system roles, 3 workspace roles, guards, permission matrix test covering every role/action pair | FR-61, 62 |
| Workspaces & upload | CRUD, membership, upload of all 10 formats, ZIP expansion, content-type sniffing against the extension | FR-01, 02, 09 |
| Markdown pipeline | Chunk 200–400 tokens with 15% overlap preserving character offsets, embed via Infinity, index | FR-04, 05 |
| **Retrieval** | Hybrid dense + lexical with RRF fusion, **permission predicate inside the SQL from the very first query** | FR-10, **FR-11** |
| **Egress** | Squid container, `allowlist_entries` table, config generation from the database *(moved from Phase 3)* | **FR-45** |
| Tool registry | Skeleton, with `search_documents` registered. Operating mode computation | FR-21, 75 skeleton |
| Audit | Append-only event writing inside the caller's transaction | FR-66 |
| Week-1 measurement | Build the proxy corpus, run the OCR spike, benchmark the GPU | FR-03 spike |

### 4.2 Non-negotiable discipline

**Phase 1 generates no text at all.** It displays retrieved passages, nothing more. This is not a technical limitation — it is the "never show an unverified claim" principle applied from the first line of code. The Ask screen is labelled **"Search documents"**, not "Ask a question", and becomes a real question-answering surface at milestone 2C.

A rough question-answering demo in week 3 would create the wrong expectation and a habit that is very hard to break.

### 4.3 Acceptance gate

- [ ] `docker compose up` on a clean machine — no manual step beyond `.env`
- [ ] Log in; 11 consecutive failures return `AUTH_ACCOUNT_LOCKED`
- [ ] Replay a used refresh token → the whole token family is revoked
- [ ] Three workspace roles enforced: Reader cannot upload, Editor cannot change membership
- [ ] Upload a `.md` folder → status reaches `indexed`, chunk count matches
- [ ] Type a question on the Search screen → the most relevant passages come back with file name and position
- [ ] **Not one line of generated text exists anywhere in Phase 1**
- [ ] A test asserts the generated retrieval SQL **contains** the permission predicate
- [ ] User A receives no chunk belonging to a document granted only to user B — checked in results, logs and any intermediate structure
- [ ] A `.pdf` containing an executable is rejected with `DOC_CONTENT_MISMATCH`
- [ ] **Empty allowlist → an outbound request from the `api` container fails at the proxy, and the proxy logs the denial**
- [ ] All 19 screens open; unbuilt ones show a "Coming soon" panel with a description and a static wireframe
- [ ] CI green on all 9 stages; permission-matrix coverage at 100% of role/action pairs
- [ ] **OCR report on the proxy corpus, with real numbers against a hand-transcribed reference**
- [ ] **Demo-machine benchmark: measured VRAM with both models loaded, and embedding throughput in chunks/second**
- [ ] Both `dev-hybrid` and `dev-local` start with a single command

### 4.4 Phase 1 risks

| Risk | Probability | Handling |
| --- | --- | --- |
| Vietnamese OCR on scanned pages misses the 90% bar (R-01) | Medium | This is exactly why the test is in week 1. Fallback: commercial OCR (~$1.50/1,000 pages), or narrow the v1 format list and say so plainly |
| **No real customer documents to close R-01** | **High — already the case** | The proxy corpus (scanned legal texts, report tables, `.md` samples) lowers the risk from "blind" to "estimated". It does not close it. **Hard milestone: real documents before week 8** |
| BGE-M3 + reranker do not fit in 4 GB VRAM | Low | ~2.4 GB at fp16 leaves headroom. If tight: load the reranker at int8, or move it to CPU |
| Squid complicates the developer loop | Low | It sits between containers, not in the developer's path. But it must be in place before anyone builds a habit of calling out directly |

---

## 5. Phase 2 — Document assistant

**Weeks 4–12 · 41 pw · Goal: a product that can be handed to a customer in `document-only` mode**

This is the phase that decides whether the product is trusted. Four internal milestones, each with its own demo.

### 5.1 Milestone 2A — Full ingestion · weeks 4–6 · 11 pw

Attach the Python parser and OCR to the pipeline built in Phase 1, extending it from Markdown to every supported format.

| Work | FRs |
| --- | --- |
| Parser worker: text, page boundaries, tables, reading order via Docling | FR-03 |
| OCR for pages with no text layer, Vietnamese + English | FR-03 |
| Full 8-state ingestion state machine with failure reasons and retry | FR-06 |
| Document versioning; superseded versions leave retrieval but stay resolvable for historical citations | FR-07 |
| Permanent purge of a document and all derived data, audited | FR-08 |
| Cross-encoder reranker in the retrieval path | FR-12, 13 |
| Document-level read restriction | FR-14 |

FR-04 and FR-05 are already complete from Phase 1 and are reused unchanged — this milestone only adds a parser at the front of the pipeline.

**Demo:** upload a 400-page scanned PDF → `indexed` within 10 minutes → inspect chunk count and the extraction method used per page.

### 5.2 Milestone 2B — The agent loop · weeks 7–9 · 12 pw

| Work | FRs |
| --- | --- |
| `agent_steps` state machine; **every step written to the database before it executes** | **FR-15**, BR-03 |
| Loop: assemble state + permitted tool catalogue + remaining budget → exactly one action back | FR-16 |
| Action validated against the tool's schema; 2 retries then a clean stop | FR-17 |
| **Turn budget** — 120 s wall clock and 12 steps, then synthesise from what was gathered | FR-18 |
| Loop detection — the same tool with the same arguments a third time stops the turn | FR-19 |
| SSE step events reaching the client within 1 second of the server writing them | FR-20 |
| **Three internal tools:** `search_documents`, `read_document_page`, `list_workspace_documents` | FR-27 |
| Retrieved document text placed in delimited, explicitly untrusted blocks | **FR-24** |
| User cancellation, honoured at the end of the current step | FR-26 |
| Tool call logging: name, full arguments, summarised result, latency, error | FR-23 |
| Operating mode computed per turn; graceful behaviour with zero MCP servers | FR-75, 79, 80 |

**Demo:** ask a question needing two passes → watch three steps appear live, each showing the agent's stated reason for choosing it → see the budget bar drain → cancel mid-run and watch it stop cleanly.

**This milestone must produce the pause-capable test** described in section 2, Change 3.

### 5.3 Milestone 2C — Verified answering · weeks 9–11 · 11 pw

| Work | FRs |
| --- | --- |
| Question intake scoped to permitted workspaces | FR-29 |
| Draft generation with every sentence annotated with its source span IDs | FR-30 |
| **Verifier as a separate call** receiving only one claim and one span, returning a structured verdict | **FR-31** |
| Filtering — anything not `supported` or `partially_supported` never reaches the user | **FR-32** |
| Explicit refusal naming what was searched and not found | FR-33 |
| Citations resolving to document, version, page and character span | FR-34 |
| Streaming that emits only verified claims | FR-35 |
| Follow-up questions carrying prior turns and their citations | FR-36 |
| Partial answers when the budget runs out, stating what is missing | FR-25 |
| Answer rating and comments joined to the turn trace | FR-37 |
| Source viewer with the cited span highlighted | FR-34, NFR-15 |
| Degradation when a tool fails mid-turn | FR-76 |

**Demo:** the product's main flow, end to end. Ask → watch → read a cited answer → click a citation → see the highlighted passage in the original page.

### 5.4 Milestone 2D — Measurement & governance · weeks 10–12 · 7 pw

| Work | FRs |
| --- | --- |
| **Eval harness including trajectory scoring**, in the nightly pipeline from week 10 | **FR-71**, NFR-09–11 |
| Audit hash chaining, search and CSV / JSON Lines export | FR-67, 68 |
| Full OIDC login | FR-59 |
| Immediate access revocation on account disable | FR-63 |
| Health endpoint reporting DB, Redis, disk, embedding service, and `not_configured` for MCP | FR-78 |

**The golden set starts in week 4, not week 10.** It needs the customer's time in small weekly amounts over months, not one large request at the end. It lives in version control and is the only asset that makes future model changes measurable rather than a matter of opinion.

### 5.5 Acceptance gate

- [ ] Upload a 400-page scanned PDF → `indexed` in ≤10 minutes, extraction method visible per page
- [ ] 150-question golden set produces a stored report with all five metrics **including trajectory accuracy**
- [ ] **All 30 unanswerable questions produce a refusal, none produces an invention**
- [ ] Every sentence in every delivered answer carries ≥1 citation resolving to a real page
- [ ] Clicking a citation opens the right page with the right passage highlighted, in ≤2 seconds
- [ ] First agent step visible in ≤1 second, p95 (NFR-01)
- [ ] No turn exceeds 120 seconds; over-budget turns end with a partial answer stating what is missing
- [ ] **Pause-capable test green** — a step halted in the database resumes correctly after an API restart
- [ ] Loop detection stops a repeated call on the third attempt
- [ ] A malformed model action retries twice then ends the turn as `failed_invalid_action`, never hanging
- [ ] **`document-only` scenario green in CI** — clean install, no MCP server, `web_search` off: log in, upload, ask, answer, all 19 screens open, **zero false alarms**
- [ ] Tampering with one `audit_events` row makes the chain verification job report a break at that row
- [ ] Golden set run on **both** `dev-hybrid` and `dev-local`; the gap recorded
- [ ] **The internal team uses it daily for the last two weeks of the phase**

### 5.6 Phase 2 risks

| Risk | Probability | Handling |
| --- | --- | --- |
| **Local model unreliable at multi-turn tool calling (R-02)** | **Medium–high** | The risk unique to the agentic direction. Three internal tools make it measurable from week 10 rather than week 19. If the gap is large: raise the hardware tier, or enable the external provider for non-sensitive workspaces |
| Verifier pushes latency past budget | Medium | Verify claims in parallel; consider a smaller model for the verifier; measure from week 9 rather than at the end |
| Budget exhaustion becomes common enough to feel useless | Medium | Track the exhaustion rate as an operational metric, alert above 20%. The root cause is usually weak retrieval, not a low ceiling — **rising average steps per turn is the early warning** |
| Golden set does not get the customer's time | **High** | Needs a committed schedule from week 3: 2 hours per week starting week 4 |
| Refusal rate high enough that people stop using it | Medium | Measure refusal *accuracy* separately from refusal *rate*. A correct refusal is a feature; a needless one is a retrieval bug |

---

## 6. Phase 3 — Tools & ERP

**Weeks 13–19 · 28 pw · Goal: live figures cross-checked, behind a human gate**

### 6.1 Milestone 3A — MCP client · weeks 13–15 · 9 pw

| Work | FRs |
| --- | --- |
| MCP server registry: name, transport, endpoint, credential encrypted at rest | FR-51 |
| Tool discovery, input schemas stored verbatim | FR-52 |
| Read/write classification, **defaulting to `write` when absent or ambiguous** | **FR-53** |
| Write tools rejected with `MCP_WRITE_DISABLED` at both service and database layers | FR-54 |
| Outbound payload validated against the declared schema **before** an approval request is created | FR-55 |
| Scheduled health checks, status surfaced in the admin area | FR-56 |
| Per-server timeout and rate limit; degrade the answer rather than hang | FR-57 |
| Tool catalogue filtered by the asker's role | FR-21, **FR-22** |

**Blocking dependency:** the real ERP tool catalogue (Q-02, needed by week 10). If the MCP server does not declare read/write annotations, FR-53's fail-safe classifies everything as `write` and disables it all — the track completes technically and delivers nothing. Ask in week 10, not week 13.

### 6.2 Milestone 3B — Approval gate · weeks 15–17 · 9 pw

| Work | FRs |
| --- | --- |
| **Halt the turn and create an approval request before any un-pre-authorised outward step** | **FR-38** |
| Six fields displayed, payload **verbatim, escaped, never summarised** | FR-39 |
| Immutable decision records; database triggers reject UPDATE and DELETE | FR-40 |
| Denial carries a reason, returned to the agent so it can adjust | FR-41 |
| Expiry after a configurable interval (default 15 minutes), treated as denial | FR-42 |
| Pre-authorisation for `read` tools, every use audited | FR-43 |
| **Write tools can never be pre-authorised — enforced by a database constraint** | **FR-44** |
| Approver notification in-app and by email | FR-39 |

### 6.3 Milestone 3C — Egress & web search · weeks 17–18 · 5 pw

| Work | FRs |
| --- | --- |
| Allowlist admin UI on the Phase 1 foundation | FR-45 |
| Egress recording and daily reconciliation against approvals | FR-46 |
| `web_search` as an egress tool, **shipped disabled**, requiring both an allowlist entry and explicit activation | **FR-28, FR-77** |

### 6.4 Milestone 3D — Model providers · weeks 18–19 · 5 pw

| Work | FRs |
| --- | --- |
| External provider configuration by key and model, disabled by default | FR-47 |
| Typed acknowledgement recorded before activation | FR-48 |
| Persistent non-dismissible banner while active | FR-49 |
| Per-workspace provider pinning | FR-50 |
| Answer quality metrics per provider | FR-60 |

**Note on ordering:** `ModelProviderPort` has been in real use since Phase 1 via `dev-hybrid`. This milestone adds the administration, the acknowledgement and the banner — not the abstraction, which is already proven.

### 6.5 Acceptance gate

- [ ] Ask a question needing an ERP figure → the agent creates an ERP step, halts, and an approval request appears
- [ ] Approval screen shows all six fields, payload verbatim in a monospace block
- [ ] Approve → the step runs, the data enters the answer, and the answer states it came from the ERP at a given time
- [ ] Deny with a reason → the agent continues without it, and the answer says what is missing
- [ ] Leave it 15 minutes → expired, cannot be decided, turn records `denied_expired`
- [ ] **An architecture test proves no code path bypasses the approval gate**
- [ ] **Attempting to pre-authorise a write tool is rejected by the database, not only by the service**
- [ ] A tool with no read/write annotation is stored as `write` and cannot be enabled
- [ ] **Chaos test: kill the MCP server mid-turn → the turn degrades and states what is missing; zero turns fail outright** (NFR-22)
- [ ] Empty allowlist → every outbound request fails at the proxy with a logged denial
- [ ] 1:1 reconciliation between Squid logs, `egress_records` and approval records
- [ ] Enabling `web_search` without an allowlist entry is rejected with `EGRESS_NOT_ALLOWLISTED`
- [ ] Activate the external provider → banner on every screen for every user; a workspace pinned to `local` still uses local inference
- [ ] **All five configuration-matrix cells green** (design §11.1)
- [ ] Golden set run on `dev-local` again; the gap versus `dev-hybrid` has not widened

### 6.6 Phase 3 risks

| Risk | Probability | Handling |
| --- | --- | --- |
| **ERP MCP server does not declare read/write** | **High** | Impact is now medium rather than high, because the system still runs in `document-only` (ADR-10). Preferred fix: the ERP team adds annotations. Fallback: administrator override with audit and typed confirmation (+3 days) |
| Prompt injection gets past the defences (T-01) | Low, very high impact | Nine layers in the design's threat model. The strongest one in v1 is that **no write tool exists**. Red-team suite runs in CI |
| No ERP staging environment | Medium | Read-only calls make this lower risk, but it still needs a written agreement with the ERP team before testing against production |
| Halting an HTTP stream to wait for approval is harder than expected | Low | The pause-capable test at the Phase 2 gate is what de-risks this. If that test was green, this is a new step type, not new machinery |
| Approvers get fatigued and rubber-stamp | Medium | Pre-authorisation for frequently used safe read tools; track the approve/deny ratio |

---

## 7. Phase 4 — Hardening & handover

**Weeks 20–26 · 30 pw · Goal: the customer's own IT can run it**

This phase adds no user-facing capability. It answers one question: when the build team leaves, does the system keep working?

| Milestone | Weeks | Contents | FRs |
| --- | --- | --- | --- |
| **4A · Operations** | 20–21 | Health dashboard with all 11 indicators; alerts for queue age, disk, model service, backup failure, restore-verification failure; a documented response for each alert | FR-69, 70 |
| **4B · Backup & recovery** | 21–22 | Scheduled database and object-storage backup; **automated weekly verified test restore**; point-in-time restore; offline licence validation | FR-72, 73, 74 |
| **4C · Testing & security** | 22–24 | Load test at 10 concurrent turns; 72-hour soak; chaos test per NFR-22; accessibility to WCAG 2.1 AA; **review of all 15 threats with a dedicated red-team pass on T-01** | — |
| **4D · Handover** | 24–26 | Installation and operations documentation; offline `docker save` bundle; UAT with the pilot customer; handover | NFR-17 |

### 7.1 Quality loop

Not a requirement, but most of Phase 4's value. Using the harness built in Phase 2, tune chunk size, relevance floor, verifier prompt, span count and step budget — **each change measured against the golden set, never guessed**.

### 7.2 Acceptance gate

- [ ] All 11 health indicators show data no older than 60 seconds
- [ ] Trigger each alert condition individually → each produces the right alert and email
- [ ] **Timed restore drill from a real backup meets the 4-hour RTO, with a written record**
- [ ] Deliberately corrupt a backup → verification fails visibly, not silently
- [ ] Expired licence blocks answering but not login, export or backup
- [ ] Load test at 10 concurrent turns meets NFR-01 and NFR-02
- [ ] 72-hour soak: no memory leak, no connection leak
- [ ] **All 15 threats reviewed and closed, with a written record**
- [ ] **Red-team injection suite green** — no document steers the agent
- [ ] **Someone outside the build team installs the system from scratch using only the documentation, timed, in under 4 hours**
- [ ] UAT passes the criteria agreed in advance with the pilot customer
- [ ] Final eval run ≥ the Phase 2 baseline on all five metrics

### 7.3 Phase 4 risks

| Risk | Probability | Handling |
| --- | --- | --- |
| Security review surfaces something serious in week 23 | Medium | Do not wait for Phase 4. Review T-01 and T-02 as each part of Phases 2 and 3 completes |
| Operations documentation written in a hurry and unusable | **High** | The timed outsider install is the only way to find out before handover |
| Answer quality falls short at UAT | Medium | Low if the eval has been green since Phase 2. Finding out in Phase 4 would already be too late — which is why the harness is in Phase 2 |

---

## 8. After v1

| Phase | Contents | Effort | Precondition |
| --- | --- | --- | --- |
| **Phase 5 · Write path** | Enable write tools one at a time, each with its own review. **Mandatory dry-run showing a before → after diff, undo based on `write_snapshots`, blast-radius cap, independent approval (no self-approval), and the red-team suite re-run under write conditions.** An explicit gate must be passed before writes are enabled against a production ERP | 14–18 pw | v1 in production for at least one quarter; an ERP staging environment |
| **Phase 6 · New sources** | Source-code indexing with syntax-aware chunking; email and file-server ingestion with permission mirroring; automatic classification and tagging | 12–16 pw | Real customer demand |

The write path's machinery is already partly built: the `tools` table carries the classification, `write_snapshots` exists, and the database constraint blocking pre-authorisation of write tools is in place from Phase 1. What Phase 5 adds is the safety surface, not the foundation.

---

## 9. Team & dependencies

### 9.1 Roles

| Role | Engaged | Heaviest in |
| --- | --- | --- |
| Tech lead / backend | Whole project | Phase 2 (agent loop, retrieval), Phase 3 (governance) |
| Second backend | From week 4 | Phases 2 and 3 |
| Frontend (React) | From week 1 | Phase 1 (19-screen shell), Phase 2 (live step view, streaming, source viewer) |
| Python / ML engineer | Weeks 1–3, 4–12 | OCR spike, parser worker, retrieval tuning, trajectory scoring |
| DevOps (part-time) | Weeks 1–3, 18–26 | Compose stack, CI, Squid, backup, offline bundle |

### 9.2 External dependencies

Each is a hard milestone, not a reminder.

| # | Needed | By week | If late |
| --- | --- | --- | --- |
| Q-04 | **Anthropic API key** for the development environment | **1** | The team falls back to `dev-local` — workable but slow, and harder to tell a code bug from a model weakness |
| Q-05 | **2 hours per week** from someone who knows the business, from week 4, to build the golden set | **3** | No quality yardstick; every later change becomes a matter of opinion |
| Q-01 | **~200 real customer documents**, including scans, to close R-01 | **8** | Handover with nobody knowing how accurately the system reads the customer's actual documents |
| Q-02 | **Real ERP tool catalogue** with read/write classification | **10** | Phase 3 delivers machinery with nothing usable behind it. Not project-blocking thanks to ADR-10, but capability-blocking |
| Q-06 | Confirmation of the identity provider and whether OIDC is available | **12** | FR-59 and FR-60 slip; a direct AD bind may be needed (+1 week) |
| Q-03 | **Hardware budget and tier** for the customer's server | **16** | No time to order and install before handover. **Do not buy before the trajectory numbers exist** |

### 9.3 The one dependency that is also a decision

**Hardware tier (Q-03)** is deliberately placed at week 16, after the eval harness has produced trajectory numbers on three model sizes. The design's §11.5 gives three reference tiers — roughly $4,000–6,500, $9,000–14,000, and $28,000–38,000 for a complete server.

What decides between them is not prose quality but **multi-turn tool-calling reliability**, and nobody can know that until the golden set exists. Waiting costs almost nothing; buying the wrong tier costs thousands.

---

## 10. Still needed from you

| # | Question | By week |
| --- | --- | --- |
| — | ~~Is the GitHub repository public or private?~~ | **Decided: public** — personal research project · 2026-09-10 |
| 2 | Who provides the Anthropic API key, and when? | 1 |
| 3 | Who at the pilot company commits 2 hours per week from week 4 for the golden set? | 3 |
| 4 | When can we borrow ~200 real documents, including scans? | 8 |
| 5 | Who obtains the ERP tool catalogue, and does the MCP server declare `readOnlyHint`? | 10 |
| 6 | Hardware budget range — under $6,500, around $9,000–14,000, or above $28,000? | 16 |

Question 1 is now decided, which leaves question 2 as the only one blocking work that could otherwise start today — and even that is first needed in week 7, since Phase 1 makes no generation call.

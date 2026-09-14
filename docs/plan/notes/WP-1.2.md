# WP-1.2 · Schema, migrations, seed

Opened 2026-09-14. Authorities: [Detail §2](../ei-ai-phase-1-detail.md) · [Tasks §3](../ei-ai-phase-1-tasks.md) · [Design §6](../../design/ei-ai-agentic-knowledge-assistant.md) · [Progress §4.3](../ei-ai-progress.md).

## Contradictions found on opening

- 2026-09-14 — **Ten of the twenty-seven tables this package must create have no DDL in any document.** Design §6.1 states plainly that it shows only what is new or changed against v1 and that identity, ingestion and audit "keep their verified shape", but the shape it defers to is not written down either: `users`, `refresh_tokens`, `login_attempts`, `group_mappings`, `workspace_members`, `document_grants`, `conversations`, `mcp_servers`, `allowlist_entries`, `model_provider_settings`. Two of them are load-bearing — `workspace_members` and `document_grants` are joined by the permission predicate in design §6.1 itself, and `users` sits at the head of the critical path.
- 2026-09-14 — `write_snapshots` has no DDL anywhere, against [detail §10](../ei-ai-phase-1-detail.md), where `\dt` listing it **is a gate line**.
- 2026-09-14 — the archived v1 document holds DDL for 14 tables, but [its README](../../archive/v1-non-agentic/README.md) marks the whole document superseded. Whether an archived, superseded design is an authority for this package is unresolved; §6.1's "verified shape" points at it without naming it.
- 2026-09-14 — `turns`, `approval_requests` and `approval_decisions` are defined **twice**, in the agentic design and in the v1 archive, and the two versions differ (the agentic `turns` carries `status`, `budget_ms`, `budget_steps`, `steps_used`). Nothing states that the agentic definition wins, though it plainly must.
- 2026-09-14 — `immutable_unaccent()` is claimed by two tasks — `T-1.2-01` lists it in `001_extensions.sql`, `T-2.1-01` owns it as defect S-1 — and so is the `chunks.text_search` generated column, claimed by both `T-1.2-04` and `T-2.1-01`. WP-2.1's header meanwhile says `chunks` cannot be created before `T-2.1-01` exists, so the ownership has to be settled before the first migration file is numbered, not after.
- 2026-09-14 — `T-1.2-01` requires "all five ENUM types" and [detail §2](../ei-ai-phase-1-detail.md) names them, but only four are defined in design §6.1. The fifth, `version_status`, exists only in the v1 archive, so its values are governed by a superseded document.
- 2026-09-14 — design §6.2 asks for an index `agent_steps_turn_seq (turn_id, seq)` while the table already declares `UNIQUE (turn_id, seq)`, which creates that index. As written `T-1.2-08` builds the same index twice.
- 2026-09-14 — design §6.2 indexes `audit_events (seq)`, but the table has no `seq` column; [detail §1.1](../ei-ai-phase-1-detail.md) already resolves this to the `BIGSERIAL id`. Carried here so the migration does not reintroduce it.

## Open questions

- 2026-09-14 — for the ten tables with no DDL: is the v1 archive promoted to an authority for this package, or is the missing DDL written into design §6.1 first? The second keeps one source of truth; the first is faster and leaves the design incomplete. · **blocks `T-1.2-02` and `T-1.2-03`**
- 2026-09-14 — `write_snapshots` is named by a gate line and by no design. What columns does an undo snapshot carry, when the feature it serves lands in Phase 3? · **blocks `T-1.2-06`**
- 2026-09-14 — does `immutable_unaccent()` belong to `T-1.2-01` or to `T-2.1-01`? Whichever loses the function, its task text needs correcting. · **blocks `T-1.2-01`**
- 2026-09-14 — `tools.min_system_role` is free `TEXT` defaulting to `'Administrator'` while the permission matrix in `T-3.2-01` has exactly five system roles. Enum or check constraint, or left as text? · needed by `T-1.2-06`
- 2026-09-14 — `turns.workspace_ids UUID[]` carries no referential integrity to `workspaces`. Deliberate, or a junction table? · needed by `T-1.2-05`

## Interpretations

- 2026-09-14 — the eleven missing tables were written into **design §6.1.1** rather than promoting the archive, so migrations have one source of truth. The fourteen tables the v1 document does define stay there, and §6.1.1 declares that block a **normative annex**; where both documents define a table — `turns`, `approval_requests`, `approval_decisions` — the agentic definition wins, because it carries loop state and budgets the v1 version has no notion of.
- 2026-09-14 — `write_snapshots` captures the target system's own object: `target_kind` and `target_id` are that system's identifiers, `before_state` is the payload verbatim, and `UNIQUE (agent_step_id)` makes one write step produce at most one snapshot. Undo lands in Phase 3; the table is created empty now because §6.3 says a schema change in week 20 costs days and an empty table costs nothing. **Provisional** — revisit when FR-54's undo path is designed.
- 2026-09-14 — `immutable_unaccent()` belongs to **`T-2.1-01`**, which owns defect S-1; `T-1.2-01` keeps only the extensions and the five enums. But forward-only migrations run in file order and `chunks` in `003` needs the function, so **`T-2.1-01` writes into `001_extensions.sql`** — a numbered migration is a file, and a file may be authored by more than one task. `T-1.2-04` then creates `chunks` with the generated column that uses it.
- 2026-09-14 — `T-2.1-01`'s "Done when" — Vietnamese text with diacritics produces an unaccented `tsvector` — cannot be demonstrated until `T-1.2-04` has created `chunks`. Its proof therefore runs after the task that depends on it; the order of work and the order of proof do not coincide here.
- 2026-09-14 — system and workspace roles are `TEXT` with a `CHECK`, not `ENUM`. The permission matrix in §9.1 changes more often than the schema, `ALTER TYPE` locks the table, and `tools.min_system_role` is already `TEXT` in the agentic design — an enum there and text here would be two spellings of one idea. It also keeps the count at the five enums the plan names.
- 2026-09-14 — `turns.workspace_ids UUID[]` stays an array with no referential integrity: it records the scope a question was asked under, which must not change when a workspace is later archived or deleted. A junction table would either cascade that history away or need a rule to keep it.

## Deviations

- none yet

## Tradeoffs

- none yet

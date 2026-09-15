# WP-2.1 · Invariant database constraints

Opened 2026-09-15. Authorities: [Detail §1.1](../ei-ai-phase-1-detail.md) — the five SQL defects · [Detail §3](../ei-ai-phase-1-detail.md) · [Tasks §4](../ei-ai-phase-1-tasks.md) · [Progress §4.3](../ei-ai-progress.md).

`T-2.1-01` (S-1) was executed early inside WP-1.2 and closed at its gate.

## Contradictions found on opening

- 2026-09-15 — **the package cannot do its work the way the plan describes it.** [Detail §2](../ei-ai-phase-1-detail.md) says of WP-1.2's migration files: *"The invariant-bearing constraints inside these files are WP-2.1's work, listed separately because they are the part that must not be quietly skipped under time pressure."* But migrations are forward-only and `001`–`007` are applied and checksummed; `migrate.ts` refuses a file whose contents changed since it was applied, by design and with a test. The constraints therefore cannot live *inside* those files — they need `008`, and the plan never says so.
- 2026-09-15 — **`T-2.1-03` is already done and was never credited.** `approval_requests.decided_at` and the corrected index `(expires_at) WHERE decided_at IS NULL` were both written in WP-1.2, because `005` and `007` could not be authored sensibly without them. The task sits at ⬜ while its "Done when" has held since 2026-09-14.
- 2026-09-15 — **`T-2.1-06` asks for something that does not exist.** Its text ends "*and the v1 rules removed*", but no `RULE` was ever created: `pg_rules` in `public` returns 0. The v1 document used `RULE … DO INSTEAD NOTHING`; the migrations written here never carried it. Half the task is a no-op against this codebase.
- 2026-09-15 — `T-2.1-04` asks for `UNIQUE (id, classification)` on `tools`, where `id` is already the primary key. It is not redundant — it is the only way to make the composite foreign key of S-4 declarable — but it reads as a mistake and should carry a comment saying why.

## Open questions

- 2026-09-15 — one migration `008_invariants.sql` for all four remaining defects, or one file per defect (`008`–`011`)? One file keeps the invariants legible as a set; four make a partial failure easier to place. · **blocks every task**
- 2026-09-15 — the composite FK of S-4 means a tool that has a pre-authorisation **cannot be reclassified** from `read` to `write` while that row exists, because `ON UPDATE NO ACTION` refuses it. Is that the intended behaviour — reclassification requires revoking first — or should it cascade? · needed by `T-2.1-05`
- 2026-09-15 — does `T-2.1-03` close as already-done, and does `T-2.1-06`'s text lose the clause about removing rules that were never written? · needed before the package closes

## Interpretations

- none yet

## Deviations

- none yet

## Tradeoffs

- none yet

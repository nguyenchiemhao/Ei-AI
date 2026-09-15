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

- 2026-09-15 — the four remaining defects land in a single `008_invariants.sql`. They are one set — S-2, BR-05, S-4 and S-5 are the promises the product is sold on — and they go in together or not at all. Migrations being forward-only, this is also the only place they *can* go: `001`–`007` are applied and checksummed.
- 2026-09-15 — the composite foreign key keeps `ON UPDATE NO ACTION`, so a tool holding a pre-authorisation cannot be reclassified to `write` until that row is revoked. Cascading would silently convert a valid pre-authorisation into one for a write tool, which is the exact state FR-44 exists to make impossible.
- 2026-09-15 — the invariants are checked in CI's **stage 6**, which already has a migrated Postgres service container. Testcontainers would pull `T-5.4-01` forward out of G5 and buy nothing.
- 2026-09-15 — `T-2.1-03` closes as already done: `decided_at` and the subquery-free index were written with `005` and `007` in WP-1.2, because those files could not be authored sensibly without them.

## Deviations

- 2026-09-15 — `T-2.1-06`'s clause "and the v1 rules removed" is struck from the task text rather than implemented. `pg_rules` in `public` returns 0: no rule was ever created in this schema, and the clause describes the v1 codebase.

## Tradeoffs

- 2026-09-15 — each check builds its own fixtures inside its transaction rather than selecting from seeded rows. The seeded version was shorter and read better, and it failed on CI: stage 6 migrates but never seeds, so the inserts matched nothing, touched no constraint, and reported that four invariants had stopped holding. The same mechanism could as easily have reported that a missing constraint still held.
- 2026-09-15 — two probes exercise S-4 separately, one for the CHECK and one for the foreign key, instead of one covering both. The single check passed while never consulting the key: `tools_no_write_in_v1` fired first on an enabled tool, so the foreign key could have been absent entirely and the suite would still have been green.

---

## Gate · closed 2026-09-15

Reviewed and accepted: all six tasks, `T-2.1-01` having been borrowed into WP-1.2 and
`T-2.1-03` closing as already done. CI stage 6 green, nine invariant checks running on
every push against a migrated-but-unseeded database.

The package's lasting lesson is about its own checks rather than its constraints. Twice a
check reported success without reaching what it claimed to test — once because
`tools_no_write_in_v1` refused before the foreign key was consulted, once because empty
fixtures meant the offending statement affected no rows at all. The constraints were right
both times; the evidence was not.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — two rules, in force from the next package:
make the check reach its subject; forward-only means a new file, never an edit.

**Promoted to [Progress §3](../ei-ai-progress.md)** — nothing. All three opening questions
were answered inside the package. Nothing else moved.

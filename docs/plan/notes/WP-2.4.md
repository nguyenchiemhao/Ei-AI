# WP-2.4 · Audit, append-only

Opened 2026-09-21. Authorities: [Detail §WP-2.4](../ei-ai-phase-1-detail.md) · [Tasks §4](../ei-ai-phase-1-tasks.md) · FR-66 – FR-68, BR-07 · [Design §5.4, §6.1](../../design/ei-ai-agentic-knowledge-assistant.md) · [Progress §4.3](../ei-ai-progress.md).

`audit_events` exists with the shape the package assumes — `actor_user_id`, `actor_ip`, `action`,
`object_kind`, `object_id`, `workspace_id`, `correlation_id`, `detail jsonb`, `prev_hash`, `hash`,
a `BIGSERIAL id` as the chain order, and the GIN index FR-67 will want in 2D. The immutability
trigger from `T-2.1-06` is in place and **refuses both verbs**, confirmed by running them:
`append-only table: audit_events does not allow UPDATE` and `… does not allow DELETE`.

This package also carries two debts named at earlier gates: `T-2.4-05` is what the WP-3.3 gate
deferred its "every change is audited" clause to, and `T-2.4-06` is what the WP-3.4 gate deferred
`T-3.4-03`'s.

## Contradictions found on opening

- 2026-09-21 — **`T-2.4-03` writes into a package that does not exist.** The task puts the event-name
  taxonomy in `shared-types`, and `packages/` holds only `eslint-config` and `tsconfig`. This is
  **`Q-13`**, open since the WP-2.5 gate, where rule 4 could only be written as its negative half for
  the same reason. The task cannot start until it is answered.
- 2026-09-21 — **nothing can carry the interceptor's transaction into the services.** `T-2.4-02` has
  `audit-transaction.interceptor.ts` open a transaction before the controller and commit after, so
  the action and its audit row commit together (BR-07). But every service opens its own:
  `withTransaction(this.db, …)` in `workspaces`, `memberships`, `upload`. There is no
  `AsyncLocalStorage`, no request-scoped provider and no `Scope.REQUEST` anywhere in `apps/api`, so
  an interceptor's transaction has no way to reach the repository calls that must join it. The
  interceptor as described would open a transaction that the action never uses.
- 2026-09-21 — **`correlation_id` is `NOT NULL` and the correlation id exists only on the response.**
  `CorrelationIdMiddleware` calls `response.setHeader(…)` and attaches nothing to the request;
  `problem-json.filter.ts` reads it back off the response, which is the only reader in the codebase.
  A service writing an audit row has no access to it and no way to obtain it.
- 2026-09-21 — **the hash chain forks under concurrency, and this is measured rather than feared.**
  Two transactions were opened at once, both read the tip of the chain, both inserted with
  `prev_hash` pointing at it, and both committed: `both sessions read the same tip: true`,
  `distinct prev_hash among them: 1`. Nothing serialises audit writes. FR-68 asks that editing any
  event *"makes the verification job report a broken chain at exactly that event"* — a verifier
  cannot distinguish tampering from a fork if the undisturbed chain already branches.
- 2026-09-21 — **auditing a failure contradicts BR-07.** `T-2.4-04` closes on *"eleven failed logins
  produce eleven events and one lockout event"*, and BR-07 puts the audit row in the caller's
  transaction. A failed action's transaction rolls back, and it takes the audit row with it. The
  events that matter most to an auditor are exactly the ones this arrangement discards.
- 2026-09-21 — **the worker has no request, so no interceptor can cover it.** `T-2.4-06` wants one
  event per ingestion state change, and those are written by `ingest-worker` from a BullMQ job:
  no HTTP request, no interceptor, no correlation id, and a different process from the API.
- 2026-09-21 — **`T-2.4-08` asks for a tampered row that the database will not let it make.**
  *"Breaking one row's hash is detectable by recomputation"* — `UPDATE` raises, as just shown. A test
  can only produce a broken chain by writing a wrong row at insert time, which is a different thing
  from an edit and proves a weaker claim.
- 2026-09-21 — **`T-2.4-07` records the question, and the question is user content.** The task's own
  guard is *"no document content in any log"*, which the WP-2.3 leakage suite already asserts for
  passages. Where the line falls — the question stored and indexed, the retrieved text never — is
  implied by FR-67 and written down nowhere.

## Open questions

- ~~2026-09-21 — **`Q-13`**~~ · **Answered 2026-09-21: `packages/shared-types` is created here.**
- ~~2026-09-21 — **how the audit row joins the action's transaction**~~ · **Answered 2026-09-21: the
  interceptor is dropped and the transaction is passed explicitly.**
- ~~2026-09-21 — **failure events**~~ · **Answered 2026-09-21: written on their own transaction,
  after the action's has rolled back.**
- ~~2026-09-21 — **the chain under concurrency**~~ · **Answered 2026-09-21:
  `pg_advisory_xact_lock` before the tip is read.**
- ~~2026-09-21 — **worker-side events**~~ · **Answered 2026-09-21: inside the transaction the worker
  already has, correlation id carried on the job payload.**
- ~~2026-09-21 — **the correlation id**~~ · **Answered 2026-09-21: attached to the request by
  `CorrelationIdMiddleware`.**

## Answered before the first edit

- 2026-09-21 — **`audit-transaction.interceptor.ts` is not written.** Each service calls
  `auditService.record(…, tx)` inside the `withTransaction` it already opens, so the action and its
  record share one transaction object and BR-07 holds by construction rather than by arrangement.
  The interceptor could never have been automatic in the first place: `T-2.4-03` gives every action
  its own event name, so the call site has to name the event whatever opens the transaction. What
  the interceptor would have added is a transaction the services already have — and a mechanism that
  lives only in a request, which the promoted rule about entrypoints argues against while
  `ingest-worker` shares the same module graph.
- 2026-09-21 — **the chain is serialised by `pg_advisory_xact_lock` on a fixed key**, taken before
  the tip is read and released when the transaction ends. One chain, so FR-68's "at exactly that
  event" means something. The cost is that audit writes no longer overlap; it will be measured
  rather than assumed.
- 2026-09-21 — **failure events are written on their own transaction**, after the action's has
  rolled back. BR-07 pairs a record with *the action it describes*, and a failed action has no
  successful action to be atomic with. A rolled-back login attempt that leaves no trace would empty
  the audit log of precisely what an auditor looks for.
- 2026-09-21 — **`packages/shared-types` is created**, with the event-name taxonomy as its first
  content. That closes `Q-13`, lets WP-2.5's rule 4 be written as more than its negative half, and
  `T-3.2-01` in the next package needs the package anyway.
- 2026-09-21 — **the worker records its own events** inside the transaction it already uses for the
  state change, with the correlation id carried on the BullMQ job payload from the upload that
  queued it — so an ingestion trail leads back to the request that caused it.
- 2026-09-21 — **`CorrelationIdMiddleware` attaches the id to the request** as well as to the
  response header. Additive, no call site changes, and it touches WP-3.1's file — recorded as a
  deviation.

## Deviations

- 2026-09-21 — **two probe rows are now permanent in `audit_events` on the development database.**
  The concurrency probe above inserted them, and the append-only trigger refused the cleanup —
  correctly, and I should have expected it. They carry `object_kind = 'probe'` and can only be
  removed by `migrate:fresh`. The table held nothing before, so it now holds exactly these two.

## Contradictions found while running

- 2026-09-21 — **an append-only table with foreign keys makes the rows it points at undeletable.**
  `audit_events` references `users` and `workspaces`, and once an action is audited neither can be
  deleted: `ON DELETE CASCADE` would delete audit rows and `ON DELETE SET NULL` would update them,
  and the immutability trigger refuses both. It surfaced as a test teardown failing —
  `update or delete on table "workspaces" violates foreign key constraint
  audit_events_workspace_id_fkey` — the first time a suite created a workspace through the API after
  the events were wired. For the product this may be right: FR-61 archives a workspace and never
  deletes one. It is written down because nothing said it, and the first person to try to delete a
  user will meet it.

## Deviations

- 2026-09-21 — `documents.integration.spec.ts` now **archives** the workspaces it creates instead of
  deleting them, and leaves its users in place. Both are consequences of the line above rather than
  a choice about tests.
- 2026-09-21 — `WorkspacesService.update` now runs inside a transaction. It did not need one before;
  it does now, because the audit row has to commit with the change it describes.
- 2026-09-21 — four service signatures changed: `WorkspacesService.create`/`update` and
  `MembershipsService.put`/`remove` take an `ActorContext` where they took a caller id. Every call
  site was read and changed — `workspaces.controller.ts` at four handlers, and the two service
  specs. The caller id is not passed alongside it: the actor of the audit row and the caller of the
  action are one field, so they cannot disagree.

## Interpretations

- 2026-09-21 — **adding a member and changing their role are different actions.** One grants access
  that did not exist, the other changes what an existing member may do, and an auditor reading
  `membership.added` should not have to open the detail to find out which happened.
- 2026-09-21 — `correlationIdOf` **throws** when the middleware has not run rather than inventing a
  uuid. An id that links to nothing looks like data and is worse than an error.

## What running it taught

- 2026-09-21 — **the worker died instead of failing a job, and an audit row is what killed it.** A
  job left in Redis by an earlier build carried no `correlationId`; `audit_events.correlation_id` is
  `NOT NULL`; the insert raised; and `void this.onFailed(job, error)` turned the rejection into an
  unhandled one, which ends the process. One job that could not be recorded stopped every later job
  from running at all. The failure handler now catches its own failures, and `correlationOf` gives a
  legacy job an id of its own rather than a null — an id that links to no request, which is the
  truth about such a job.
- 2026-09-21 — **a queue outlives a deploy.** Changing the shape of a job payload is a compatibility
  break, and nothing said so. `migrate:fresh` made it worse by emptying the database while Redis
  kept 93 keys pointing into it.
- 2026-09-21 — **rule 3 of WP-2.5 forbade every module from writing an audit event.** Twelve
  violations, one per module that records: `no-cross-module-service` reads a filename, and
  `AuditService` is the audit module's exported surface rather than an internal of it — a
  distinction a path pattern cannot make. The same shape as rule 1 at WP-3.4: a rule written before
  the code it constrains, now refusing the work the plan asks for. Exempted by decision, with the
  reason written into the rule, and the exemption checked against its near miss — a different
  module's service from the same file is still refused, `retrieval.service.ts → upload.service.ts`,
  one violation where the audit import produced none.
- 2026-09-21 — the audit trail of one upload on a clean database is exactly what `T-2.4-06` asks
  for: `document.uploaded` once, then one event per state transition, five of them, `uploaded →
  parsing → parsed → chunking → embedding → indexed`. Seven events, `prev_hash` correct 7/7, every
  hash recomputing from its own row, and the first event alone without a predecessor.
- 2026-09-21 — the search event keeps the question and the scope and **no passage text**: a grep of
  the whole table for the text that was returned finds nothing.

## Interpretations

- 2026-09-21 — **the audit module is cross-cutting, like configuration and the database pool.**
  `AuditModule` is `@Global` for the same reason: every module that acts has something to record,
  and none of them should have to import the audit module to do it.
- 2026-09-21 — a failed login records **the email and never the password**, not even hashed. A hash
  of a guessed password is still a guess at a password, written where an auditor can read it.
- 2026-09-21 — a search records **how many passages and which documents**, never their text. The
  audit log is read by an Auditor who may not belong to the workspace the answer came from, and
  FR-11 does not stop applying because the text left by a different door.

## Deviations

- 2026-09-21 — **rule 3 of WP-2.5 now exempts `modules/audit/`.** The reason is written into the
  rule's own comment rather than left to this note.
- 2026-09-21 — `IngestJob.correlationId` is **optional** in the type. A required field would have
  been a lie about what is in the queue at the moment a deploy lands.

---

## Gate · closed 2026-09-21

Reviewed and accepted: all eight tasks. **G2 is complete.** The proving command ran on a database
reset for it: one upload left `document.uploaded` once and five state-change events,
`uploaded → parsing → parsed → chunking → embedding → indexed`; `prev_hash` correct 7 of 7, every
hash recomputing from its own row, the first event alone without a predecessor; and S-5 raised on
both `UPDATE` and `DELETE`. 841 unit tests at 100 % on every metric, 34 integration tests,
`arch:chunks` and `depcruise` clean over 163 modules.

What this package kept teaching is that the failure paths are the ones nobody has run. The worker
died rather than failing a job, because the handler for failures could itself fail. The chain forked
under concurrency until a probe went looking. An append-only table turned out to freeze rows in two
other tables, and that surfaced as a teardown error rather than as a design review. None of it was
visible from the happy path, which was green throughout.

**Not proved here:** no CI run number is recorded against this package's commits, as with WP-3.3,
WP-3.4 and WP-2.3 — every check was run locally. FR-67's search and export and FR-68's verification
job are milestone 2D's, as Detail says; what exists here is the chain they will read. The agent,
tool, approval and configuration events FR-66 also lists arrive with the features that raise them,
in 2B, 2C and 3B. `T-2.4-08`'s second half proves a weaker claim than the task asks: the database
refuses an edit, so the broken row is one planted with a wrong hash at insert time rather than one
altered afterwards.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — three rules, in force from the next package: a
handler for failures that can itself fail stops everything; a queue outlives the code that filled
it; an append-only table's foreign keys freeze the rows they point at. Not promoted, because
existing rules carry them: the rule-3 exemption and its near-miss control are what "a rule that
fires is not yet a rule that discriminates" was written for — though this is the **second** WP-2.5
rule to forbid work the plan requires, after rule 1 at WP-3.4, and a third would be a pattern rather
than a coincidence. The default-parameter trap caught me a third time and is already a rule.

**Promoted to [Progress §3](../ei-ai-progress.md)** — `Q-23`, whether `audit_events` keeps the
foreign keys that freeze `users` and `workspaces`; `Q-24`, what discipline covers a job payload
whose shape changes across a deploy. `Q-13` is closed: `packages/shared-types` exists.

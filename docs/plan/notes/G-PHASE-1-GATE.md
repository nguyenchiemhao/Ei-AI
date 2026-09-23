# Phase 1 acceptance gate — the run

Opened 2026-09-23. Authority: [Detail §10](../ei-ai-phase-1-detail.md), quoted in
[Progress §4.4](../ei-ai-progress.md). Twenty-five lines across G1–G4, every one carrying the command
that proves it. **A line without a passing command is not done**, and today not one is ticked.

Every package of G1, G2, G3 and G4 is closed except `T-4.1-03` and `T-4.1-06`. What has never
happened is the lines being run **together, on one tree, at one time** — which is the only thing the
gate is.

## Contradictions found on opening

- 2026-09-23 — **the repository does not contain the only implementation of `StoragePort`.**
  `.gitignore` line 27 is a bare `storage/`, which git matches at any depth, so
  `apps/api/src/adapters/storage/` has never been committed: `local-fs.adapter.ts`,
  `local-fs.adapter.spec.ts` and `storage.module.ts` are all untracked. A worktree checked out from
  `HEAD` has no such directory. `app.module.ts` imports `StorageModule` and ten files import
  `StoragePort` or the adapter, so **a fresh clone cannot typecheck and cannot build**. CI stages 2
  and 5 must have been failing since WP-3.3 wrote those files; `gh` is not installed on this machine
  and no run has been read.
- 2026-09-23 — **three more bare directory patterns can swallow source the same way.** `build/`,
  `models/` and `coverage/` match at any depth exactly as `storage/` did. Nothing is hidden by them
  today; `src/models/` is an ordinary name for a directory somebody will create.
- 2026-09-23 — **G2's "no generated text" line fails on a comment that asserts the invariant.**
  `grep -rniE "anthropic|completion|prompt" apps/api/src/modules --include=*.ts` matches
  `hybrid-search.repository.ts:9` — *"it never reaches application memory, a log or a prompt"*. The
  check is case-insensitive and reads comments, so the sentence explaining the rule breaks it.
- 2026-09-23 — **that line's exemption points at a directory that does not exist.** It excuses
  `adapters/model-provider/`, and `apps/api/src/adapters/` holds only `cache`, `embedding` and
  `storage`. Architecture rule 5 names the same path. §7.1 says the model-provider port and adapters
  compile in Phase 1; only `ports/model-provider` is absent too — `ports/` holds `storage.port.ts`
  alone, against design §5.4's "three outbound seams".
- 2026-09-23 — **G1's first line would destroy this machine's work.** `git clean -xdf` removes 20
  paths here, including `.env`, the 204 MB corpus fetched for WP-4.1, its 9 MB reference set, and
  the two untracked documents written today — `docs/ops/week-1-measurements.md` and
  `docs/plan/notes/WP-4.1.md`. The line says "on a clean machine" and this is not one.
- 2026-09-23 — **G3's screen line counts 19 and the router declares 22.** Recorded at the WP-3.6
  gate: design §8.1 lists twenty-one screens, four of which Phase 1 builds, plus `Search documents`,
  which §8.1 does not list. The gate text was not updated with it.
- 2026-09-23 — **G2's "after seeding one destination the request succeeds" has no generator.**
  `T-2.2-05` was deferred when WP-2.2 closed and `WP-5.2` — which turns `allowlist_entries` into
  `allowlist.conf` — is unbuilt. The allowlist is a file edited by hand, so the line can be made to
  pass in a way that proves nothing about the mechanism it is about.
- 2026-09-23 — **G4's second line cannot pass.** *"The OCR number carries an explicit R-01
  recommendation"* needs `T-4.1-03`, the ~20 hand-transcribed pages, which is open by decision.

## Open questions

- 2026-09-23 — **is the missing storage adapter fixed before the run or recorded by it?** Fixing it
  is one line of `.gitignore` and three files force-added; running the gate first produces a red G1
  line that says what the gate is for. · **blocks the run either way, decide first**
- 2026-09-23 — **where does the clean-machine line run?** Not here, unless the corpus, `.env` and
  today's untracked documents are moved first. A second clone under `/tmp` is the cheap answer and
  it is not "a clean machine" in the sense NFR-17 means. · **blocks G1 line 1**
- 2026-09-23 — **does the "no generated text" grep get narrowed, or the comment reworded?** The
  invariant is about code, the check reads comments, and the comment is correct. · **blocks G2's
  last line**

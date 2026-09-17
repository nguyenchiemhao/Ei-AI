# WP-3.3 · Workspaces, upload, storage

Opened 2026-09-16. Authorities: [Detail §WP-3.3](../ei-ai-phase-1-detail.md) · [Tasks §5](../ei-ai-phase-1-tasks.md) · [Tasks §2.1](../ei-ai-phase-1-tasks.md) the loosened dependencies · FR-02, FR-01, FR-09, FR-61, FR-62 · [Progress §4.3](../ei-ai-progress.md).

`003_workspaces.sql` is applied and carries `workspaces`, `workspace_members`, `documents` and `document_versions` with `dv_content_unique`, the 200 MB `byte_size` CHECK and the `uploads` volume already mounted rw in api and ro in parser.

## Contradictions found on opening

- 2026-09-16 — **`T-3.3-09` closes on "four tests green in CI stage 7", and stage 7 does not exist.** It sits in [ci.yml](../../../.github/workflows/ci.yml) as `if: false`, implemented by `T-5.4-01` in WP-5.4 — G5, the pre-agreed cut. `T-3.1-12` met the same wording and was answered with a job of its own, `6c`, beside stage 6.
- 2026-09-16 — **`T-3.3-08` asks to upload a file `T-3.3-06` must refuse.** Its "Done when" is *"An HTML file uploaded and downloaded is not executed by the browser"*, and HTML is not among the ten formats design §2 and FR-02 name — PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, PNG, JPG, TIFF. Two tasks of the same package disagree about whether that upload is possible.
- 2026-09-16 — **`T-3.3-02` needs a guard this package was deliberately freed from.** Its "Done when" is *"Only an Owner can change membership"*, which is `WorkspaceRoleGuard`, `T-3.2-04` — and [Tasks §2.1](../ei-ai-phase-1-tasks.md) loosened WP-3.3's dependency on exactly that task, on the grounds that "guards are wired on by `T-3.2-06`". The loosening and the acceptance test contradict each other.
- 2026-09-16 — **the same task's "every change is audited" is owned by a package that waits for this one.** Audit is WP-2.4 at 0/8, and `T-2.4-05` — wire workspace, membership and permission-change events — is itself blocked by `T-3.3-02`. Read literally, neither can close first.
- 2026-09-16 — **`T-3.3-01` closes on a search that cannot run.** *"An archived workspace still lists but returns no candidates in search"* needs `POST /search`, which is `T-2.3-06`, which waits on `T-3.4-10` for persisted embeddings. Nothing in this package can demonstrate the second half.
- 2026-09-16 — **half of FR-02's limit is unenforceable here.** "200 MB and 2,000 pages" — `document_versions.page_count` is filled by the parser, and the parser attaches in milestone 2A; Detail says so itself. Only the byte limit can be applied, and the schema's CHECK already applies it.
- 2026-09-16 — **`file-type`, the obvious library for signature sniffing, cannot be required.** It has been ESM-only since v17 (`"type": "module"` at 22.1.0) and `apps/api` compiles to CommonJS; the newest CommonJS release is **16.5.4**, from 2021. This is the shape that already bit once in WP-3.1, where `zod-to-json-schema@3.25.2` resolved a zod 4 layout and the application died at boot after `tsc` reported no errors.
- 2026-09-16 — **`@types/multer` is not installed**, so an uploaded file has no type to declare. `FileInterceptor` and `FilesInterceptor` exist — `@nestjs/platform-express` brings multer as its own dependency — but `require('multer')` from `apps/api` fails, so the types have to be added deliberately rather than assumed.
- 2026-09-16 — **workspace names are globally unique** (`workspaces_name_unique`), so a second workspace with a name already taken raises a constraint violation, and design §7.4 names no code for that kind of conflict. `Q-14` already asks whether the taxonomy adopts the five codes WP-3.1 had to add; this is a sixth.

## Open questions

- ~~2026-09-16 — where do `T-3.3-09`'s four tests run, given stage 7 is in the pre-agreed cut: inside the existing `6c` job, or a job of their own beside it? ~~ · **Answered 2026-09-16:** inside the existing `6c` job.
- ~~2026-09-16 — content-type sniffing: hand-rolled signatures for the ten formats, which is roughly ten magic-byte checks and no dependency at all, or `file-type` pinned at 16.5.4, the last CommonJS release, from 2021? ~~ · **Answered 2026-09-16:** hand-rolled signatures, no dependency.
- ~~2026-09-16 — does `T-3.3-08` test its "never rendered server-side" clause with a format from the allowlist, or is HTML a deliberate exception that the allowlist must admit for this purpose? ~~ · **Answered 2026-09-16:** a format from the allowlist; the allowlist does not open.
- ~~2026-09-16 — `T-3.3-02`'s Owner-only rule: pull `T-3.2-03` and `T-3.2-04` forward out of WP-3.2, or enforce the rule inside the service now and let `T-3.2-06` replace that with the guard later? ~~ · **Answered 2026-09-16:** in the service now, replaced by the guard at `T-3.2-06`.
- ~~2026-09-16 — do the "every change is audited" and "no candidates in search" clauses become deferrals naming `T-2.4-05` and `T-2.3-06`, so the package can close without them? ~~ · **Answered 2026-09-16:** deferrals naming `T-2.4-05` and `T-2.3-06`.

## Contradictions found while running

- 2026-09-16 — **busboy decodes a multipart filename as latin-1**, so `hợp đồng.csv` reached the handler as `há»£p Äá»ng.csv` and was written to `documents.source_filename` that way. For a product whose documents are Vietnamese that is every filename, and nothing in the upload path would ever have complained. The bytes are reinterpreted as UTF-8 at the boundary, which leaves a pure-ASCII name untouched because the two encodings agree there.
- 2026-09-16 — **architecture rule 3 caught a test of this package's own**, exactly as it was written to. `documents.integration.spec.ts` imported identity's `PasswordService` to build a fixture, and WP-2.5's gate had already settled that `*.spec.ts` gets no exemption — "a test that imports another module's service is the loophole that turns the rule into a negotiation". The fixture needed a hash rather than that service, so it now calls `@node-rs/argon2` directly. The rule stayed; the test improved.

## Interpretations

- 2026-09-16 — **TXT, MD and CSV have no signature to check.** They are whatever a person typed, and demanding a magic number would refuse every valid text file. They are tested for *being text* instead — no NUL, no control characters outside tab and the line endings — which is what actually catches an executable wearing a `.txt`.
- 2026-09-16 — DOCX, XLSX and PPTX share one signature, `PK`, because all three are ZIP containers and what separates them lies inside the archive. The extension decides which of the three a file claims to be; the signature decides only that it is an OOXML container at all. Opening the archive to check further is parser work, and the parser arrives in milestone 2A.

- 2026-09-16 — the 200 MB limit is a **constant, not configuration**. `document_versions.byte_size` already enforces `<= 209715200` with a CHECK, and a configured limit above it would let a file through the API only for the database to refuse it. The identity thresholds became variables because nothing else enforced them; this one is enforced by the schema.
- 2026-09-16 — the limit is applied **twice**: a guard refuses a declared `Content-Length` over the maximum before the body is read, and `UploadService` counts the bytes that actually arrived. The header is the client's own claim, and a request that declares nothing — `Transfer-Encoding: chunked` — passes the first check and is stopped by the second. Both were exercised.
- 2026-09-16 — multer writes to a directory beside the objects rather than to memory. A 200 MB file held in RAM per concurrent upload is the kind of limit that only appears under load, and `StoragePort.put` takes a stream for the same reason.

- 2026-09-16 — `T-3.3-09`'s four tests join the **existing `6c` job** rather than founding a `6d`. The job already builds the application, migrates and drives it over HTTP; a second one would maintain the same scaffolding twice.
- 2026-09-16 — content-type sniffing is **hand-rolled**, roughly ten magic-byte comparisons. `file-type` has been ESM-only since v17 and `apps/api` compiles to CommonJS, so the alternative is pinning its last CommonJS release from 2021. The library recognises some two hundred formats; this system admits ten, and ten signatures are small enough to read and to test one by one.
- 2026-09-16 — `T-3.3-08` is tested with a **format from the allowlist** — a `.csv` whose contents are `<script>` — rather than by admitting HTML. That is also the more honest case: the file is one a user may legitimately upload, and what is under test is `Content-Disposition: attachment` with `X-Content-Type-Options: nosniff`, not the allowlist.
- 2026-09-16 — the Owner-only rule of `T-3.3-02` is **enforced in the service** and recorded as a deviation, to be replaced by `WorkspaceRoleGuard` at `T-3.2-06`. Pulling `T-3.2-03` and `T-3.2-04` forward would drag half of WP-3.2 into this package.
- 2026-09-16 — the "every change is audited" and "no candidates in search" clauses become **deferrals that name their task**: `T-2.4-05` and `T-2.3-06`. A check may be deferred only by naming what will run it.
- 2026-09-16 — everything in this package lives in **`modules/workspaces/`**, with no `documents` module of its own. [Detail §7.1](../ei-ai-phase-1-detail.md) names fourteen modules and `documents` is not among them, and a separate module would meet architecture rule 3 the moment it needed to read membership.
- 2026-09-16 — every repository method takes an **optional transaction** and falls back to the pool. A workspace and the membership that makes its creator an Owner must commit together, and BR-07 will need audit rows written inside the caller's transaction — a repository that only knows the pool cannot join one.
- 2026-09-16 — a clash on `workspaces_name_unique` is raised as **`WORKSPACE_NAME_TAKEN` (409)**, a sixth code §7.4 does not name; `Q-14` already asks whether the taxonomy adopts the five WP-3.1 added. The check reads the constraint name rather than the SQLSTATE alone, so a different unique index failing is not dressed up as a name clash.

## Open questions

- 2026-09-16 — **one unexplained failure under `test:coverage`**, at `T-3.3-03`: a run reported `1 failed | 122 passed` where the same tree passed `test` and then passed `test:coverage` eight times in a row. Which test failed was lost — the command was piped through a `grep` that kept only the summary line. Nothing is known beyond "it happened once", and that is recorded rather than tidied away. The `::error::` step added to stage 3 during WP-3.1 exists for exactly this and will name the test next time CI sees it. · **watch on CI; do not close the package while it is unexplained**

## Interpretations

- 2026-09-16 — **a workspace may not be left without an Owner.** Nothing in the schema forbids it and no task mentions it, but removing or demoting the last Owner produces a workspace nobody can administer — the same invariant that makes the creator an Owner in the first place. Raised as `WORKSPACE_LAST_OWNER` (409), a seventh code §7.4 does not name; `Q-14` covers the question.
- 2026-09-16 — reading the member list is Owner-only, like changing it. Design §7.2 marks `GET/POST/DELETE /workspaces/{id}/members` as Owner without splitting the verbs, and who else is in a workspace is not something an Editor needs from this endpoint.

## Deviations

- 2026-09-16 — `workspace-members.repository.ts` is written at `T-3.3-01` rather than `T-3.3-02`, with only `upsert` and `findRole`. A workspace whose creator is not its Owner is one nobody can administer, so the first membership cannot wait for the task that manages memberships.
- 2026-09-16 — `UPLOADS_DIR` is a new configuration variable, defaulting to the path the compose stack mounts. The adapter needs a base directory, hard-coding the container's path would make the adapter untestable, and `T-1.1-04` made the schema the one place a variable is declared.
- 2026-09-16 — the Owner rule is enforced in `MembershipsService` rather than by `WorkspaceRoleGuard`, which is `T-3.2-04`. `T-3.2-06` replaces it. A membership endpoint with no rule at all would be worse than one whose rule sits in the wrong layer, and pulling the guard forward would drag half of WP-3.2 into this package.
- 2026-09-16 — the upload route carries its own `@Catch(PayloadTooLargeException)` filter. Multer aborts with "File too large" and Nest wraps it, so the response had the right code and a message that never said what the limit was — half of what `T-3.3-04` asks for. The filter re-raises it as `DOC_TOO_LARGE` with `limitBytes`.

---

## Gate · closed 2026-09-17

Reviewed and accepted: all nine tasks. The proving command ran through the real endpoint — a real
ELF binary, `/bin/ls` at 151 344 bytes, renamed `.pdf` and refused 415 `DOC_CONTENT_MISMATCH`, and
a 201 MB body refused 413 `DOC_TOO_LARGE` with the limit stated in the response rather than merely
applied.

What the package kept teaching is that a boundary agrees with you in ASCII. busboy's latin-1
filename decoding survived every test written until one used a Vietnamese name, and that is the
only kind of name this product will ever carry. The same shape appeared in the limit: a check
against a declared `Content-Length` looks like enforcement until a request declines to declare one.

**Not proved here:** no CI run number is recorded against this package's own commits — the four
scenarios of `T-3.3-09` were run locally against the built `dist/main.js` in the shape job `6c`
runs them, and `gh` is not installed in this environment to read the run. Half of FR-02's limit,
the 2 000 pages, cannot be enforced until the parser fills `page_count` in milestone 2A. The
"every change is audited" and "no candidates in search" clauses of `T-3.3-02` and `T-3.3-01` are
deferrals naming `T-2.4-05` and `T-2.3-06`. The Owner-only rule sits in `MembershipsService` until
`WorkspaceRoleGuard` replaces it at `T-3.2-06`. DOCX, XLSX and PPTX are distinguished only by their
extension — the shared `PK` signature says they are OOXML containers and nothing more, and opening
the archive is parser work.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — four rules, in force from the next package: a
boundary that mangles Vietnamese looks correct in ASCII; a size the client declares is a claim, not
a measurement; a library your build cannot load is not a candidate; a value the database already
enforces is a constant, not configuration. The fifth candidate — enforcing a rule in the wrong
layer rather than not at all — was not promoted: "a deferral must name what it defers to" already
covers it, and the deviation names `T-3.2-06`.

**Promoted to [Progress §3](../ei-ai-progress.md)** — `Q-17`, the one unexplained `test:coverage`
failure the package could not reproduce, carried out of the gate rather than closed at it.

## After the gate

- 2026-09-17 — **`Q-17` answered the day it was opened, by running the suite rather than reading it.** Thirty
  runs of `pnpm test` produced two failures with two different causes, neither of which any single run explains.
  `auth.service.spec.ts` asserted `before - since >= 900000` where `before` is `Date.now()` read **before** the
  call and `since` is computed from the service's own later clock — an inequality that holds only while no
  millisecond ticks during the call, and one run reported `899999`. It now brackets the call with `before` and
  `after` and asserts both sides, which needs no slack at all. `upload.service.spec.ts` handed `StoragePort.put`
  a double that resolved without reading its argument; `store` then removed the incoming file in its `finally`
  while the unconsumed read stream was still opening it, and the ENOENT arrived on a stream with no error
  listener — an **uncaught exception** that reddens the run while every test passes and names an unrelated test.
  The double now drains the stream, as the real adapter does. Thirty consecutive green runs after the fix,
  against two failures in the thirty before.
- 2026-09-17 — two rules are candidates for the **next** gate, not this one, which is closed: an assertion that
  compares against a clock must read that clock on both sides of the call; and a test double that does not honour
  its port's contract invents a failure mode the real adapter does not have.
- 2026-09-17 — every document under `docs/design`, `docs/plan` and `docs/plan/notes` is now English, and so are
  Swagger's summaries, the 24 `error-codes` titles and the `AppException` details behind them. That reverses a
  decision recorded at the WP-3.1 gate; `Q-18` carries it to the design. What stayed Vietnamese is what would
  lose its subject in translation: the multipart filename in the busboy finding, the embedding and rerank probes
  in the development-environment runbook, and the sample question and answer in design §7.3 — user data, not
  interface text.

# Ei-AI

## Work

**Questions before work, contradictions first.** A package opens with `docs/plan/notes/<WP>.md`: the open questions it raises, and every contradiction found between the design, the plan and what already exists. The answers come before the first edit, not during it. [Phase 1 · Detail §1](docs/plan/ei-ai-phase-1-detail.md) is the argument for this rule — ten defects and a CI contradiction found after the documents were written, then carried in as corrections.

**A plan is approved once, then it runs.** The plan for a package is a hard stop: nothing is written until it is approved. After that the package runs task by task without asking again, and the next stop is its proving command. Approving a plan is not approving a commit — that is separate, and it is in `## Git`.

**Stop climbing after three.** A failing check is fixed in place at most twice. Then name the cause and what it touches — the task, the package, or the design. A cause that reopens the task may loop back at most three times; after that, stop and ask. Grinding past that point is an escalation refused, not persistence.

**Tests travel with the task that needs them.** The "Done when" in [Tasks](docs/plan/ei-ai-phase-1-tasks.md) is the acceptance test, and [Detail §11](docs/plan/ei-ai-phase-1-detail.md) sets what each type covers. Code written without its test is a task still in progress.

**Keep a diary, under four headings and no others.** In that same `docs/plan/notes/<WP>.md`, one dated line per entry. **Interpretations** — an ambiguity closed by choosing. **Deviations** — a deliberate departure from the plan. **Tradeoffs** — the alternative considered and dropped. **Open questions** — what nobody has answered yet. The diary carries what a diff cannot: why this and not that.

**A deferral must name what it defers to.** "Unchanged", "as before", "keeps its verified shape" — each is a pointer, and a pointer with no target is a hole the reader only finds when they try to build. Design §6.1 deferred eleven tables this way, `users` and `workspace_members` among them, and nobody noticed until WP-1.2 opened. Name the document and section, or write the thing down.

**Promote at the gate, never mid-package.** When a package closes, confirmed interpretations, deviations and tradeoffs become rules in this file; open questions become rows in [Progress §3](docs/plan/ei-ai-progress.md). Nothing else moves. A rule added at a gate applies from the next package — the package that produced it is judged by the rules it started under.

## Git

**Never commit, stage or push on your own initiative.** After adding or editing files, stop and report what changed; the user decides when it gets committed. This covers `git add`, `git commit`, `git push`, `--amend` and rebase — each needs an explicit request, and approval for one commit does not carry to the next.

**Commit messages are short.** One line, `type: what changed`, at most ~72 characters, **no body**. The existing history is the model:

```
docs: dev environment setup runbook with per-step verification
docs: rewrite design as agentic assistant; add operating modes
docs: execute dev environment runbook, log verified results
```

Types in use: `docs`, `feat`, `fix`, `chore`, `refactor`, `test`.

A body is the exception. Add one only when a decision needs a "why" the diff cannot carry, and keep it to two or three lines. Findings, summaries, rationale and lists belong in the documents themselves — a commit message is not a place to re-explain work that is already written down.

**A commit made to be reverted contains only the thing being reverted.** A deliberate-failure probe was committed with `git add -A`, swept up twelve lines of working notes, and the revert deleted them. Stage the probe by name.

**No attribution trailer.** A commit carries no `Co-Authored-By` line and no co-author of any kind — the author is whoever ran the commit. `.claude/settings.json` sets `attribution.commit` to an empty string so the trailer is not generated; never add one by hand.

## Proving

**A check that can pass for the wrong reason has not been run.** `ip route | grep -c default` printed `0` in an image with no `ip` — grep read empty input, and the invariant it defends looked green. Before trusting a check, confirm the tool it depends on exists and that the check can still fail.

**"Up" is not "working".** A container stays up while the process inside is dead, and a port answers because a different project is holding it. Prove a service through its own address, from inside its own network, and know which process replied.

**Pin by digest; a tag is a label, not a version.** `pgvector:0.8.0-pg17` carries PostgreSQL 17.6 and `ubuntu/squid:6.6-24.04_beta` carries Squid 6.13. Record the version the running image actually reports, and correct the plan when it differs from what was written.

**Pin what your pin drags in.** A pinned package with an unpinned transitive dependency lets the resolver walk backwards through every release without terminating. Pin them together, in the same line.

**Say what the machine did not prove.** A package's proof ends with three lists, not one: what a command demonstrated, **what needs the reader's hands** — the exact steps and what a pass looks like — and **what was skipped on purpose**, each with the risk that leaves open. A "Done when" only a person can check is not a lesser test; it is the one that gets quietly dropped.

**What the process reads is not always what the file says.** A single-file bind mount pins an inode, so an edit that writes a new file and renames it — `git checkout`, `sed -i`, most editors — leaves the container on the old content. Squid kept permitting a destination whose rule had been deleted, and the reload reported success. Mount the directory, and verify the effect rather than the file.

**Make the check reach its subject.** Two checks in WP-2.1 ran green without ever touching what they claimed to test: one because a different constraint refused first, so the foreign key could have been absent entirely; one because empty fixtures made the offending statement affect no rows. Name the mechanism you expect to refuse and confirm it is the one that did, and build the fixtures rather than borrowing whatever the database happens to hold.

**A check asserts only what it proves.** `verify-egress.sh` required a service that the egress boundary has nothing to do with, and went red on CI for a reason unrelated to the invariant it defends. A check that fails for reasons outside its subject gets muted, and then it defends nothing.

**Build the artefact that ships.** CI built the `dev` image target and stayed green against code that did not compile, because that target copies source and compiles nothing. The `prod` target — the one that runs the build and the one that ships — had never been built at all, and did not work when it finally was. A build step that exercises a convenient stand-in proves the stand-in.

**The order of work and the order of proof need not match.** `T-2.1-01` had to run before `chunks` existed, and its "Done when" could only be shown after the task that depended on it. When they diverge, say which later task demonstrates the earlier one, so the proof is deferred rather than forgotten.

**Skip because something later covers it, never because it is awkward.** A check may be deferred only by naming the task or gate that will run it. Cost is a reason to reschedule a check, never a reason to stop counting it.

**What the checker reads must be what the rule is written against.** Four architecture rules in WP-2.5 forbade imports that `dependency-cruiser` could not see: `consistent-type-imports` writes almost every cross-boundary import as `import type`, the compiler erases it, and the tool read the graph that survives. The identical violation reported `no dependency violations found` and exit 0 until `tsPreCompilationDeps` was turned on. Before trusting a rule, run one violation with the option you are unsure of turned off.

**A rule that fires is not yet a rule that discriminates.** WP-2.5's provider-SDK rule went red on `@anthropic-ai/sdk` — and would have gone red on any package that is not installed, which is every package in an empty tree. The control is the near miss that must be **accepted**: a different unresolvable import from the same file. A prohibition that cannot tell its subject from a lookalike gets switched off the first time the lookalike is legitimate.

**A fixture built once at module scope ages with the file, not with the test.** `revocation.service.spec.ts` created its `Principal` at import and asserted a TTL within five seconds of it. That is generous on a laptop and not on a runner transforming fourteen files while Argon2id tests fight over two cores: CI stage 3 failed on one run and passed on the next with no change to any test. Build the fixture inside the test, and measure against the object the test just made, so a delay moves both sides of the comparison together.

**What runs the tests is not what runs the code.** Vitest transpiles with esbuild, which neither typechecks nor emits `design:paramtypes` — so a real compile error shipped while 44 tests passed, and a Nest application booted inside the suite gave every controller `undefined` for each dependency. Neither failure is visible from the test result. Run the typechecker separately, and when a test needs the framework's runtime behaviour, drive the built artefact rather than a re-transpiled copy of the source.

**Coverage's worth is the list, not the number.** Reading the uncovered 5 % of WP-3.1 found a `catch` no test had ever entered — under a test whose name claimed it did, passing because the input it used parses fine and never throws — and a method with no unit test at all, which the integration suite exercised where the gate could not see it. Chase the lines the report names; the percentage is only how it points at them.

**A boundary that mangles Vietnamese looks correct in ASCII.** busboy decodes a multipart filename as latin-1, so `hợp đồng.csv` reached the handler as `há»£p Äá»ng.csv` and was stored that way. Every upload test until then had used an ASCII name, where latin-1 and UTF-8 agree byte for byte and nothing can go wrong — and for a product whose documents are Vietnamese, the broken case was every real filename. Drive a boundary with the text it will actually carry.

**A size the client declares is a claim, not a measurement.** The 200 MB limit is applied twice: a guard refuses a `Content-Length` above the maximum before the body is read, and the service counts the bytes that actually land. A request that declares nothing — `Transfer-Encoding: chunked` — walks past the first check untouched. A limit enforced once, on a number the caller chose, is a limit the caller sets.

**A guard that cannot fire is not a guard.** `mergeShortTail` folded a short final chunk back into its predecessor "when the two fit" — and the predecessor is always grown to the maximum, so they never fit. The branch had never run once. The unit test written to demonstrate it failed, and the corpus showed why: a shortest chunk of 78 tokens under a floor of 200. Before trusting a fallback, produce the input that reaches it; a branch nothing can enter defends nothing and hides the case it was written for.

**A fixture that cannot express absence tests the default instead.** Passing `undefined` to a parameter that has a default selects the default: a job built as "no attempts configured" arrived carrying three, and a version meant to be missing arrived present. Both tests failed against a fixture that had quietly built the opposite of what it named. `null` as the sentinel is the shape that survives, and it was already settled in `downloads.service.spec.ts`.

**A thing that still answers can be answering with half of itself.** `POST /search` returned sensible passages, ranked plausibly, with every test green — and the lexical branch was matching nothing at all. `plainto_tsquery` ANDs a whole question, ten terms a chunk must all contain, and it matched 0 of 123 where the keyword form matched 44. Nothing failed, because a full outer join with an empty side is still a result. The only thing that said so was the arithmetic: every score was a multiple of `1/61`, the signature of one contributor. When a result is composed of parts, assert that each part contributed.

**A measurement that changes between identical runs has not been made.** Three consecutive runs of the same query-plan probe gave `SEQ`, `INDEX`, `INDEX`. The query did not move; the dead tuples the probe itself left behind did, and 4.8 ms against 3.5 ms is close enough for the planner to change its mind. Repeat a measurement before recording it, and clear the state your own probe leaves — the first number was neither right nor wrong, it was noise with a plan attached.

**"Not present" is only evidence when something is known to be present.** The control on the tool
catalogue asserted that a Member's compiled SQL does not send `Administrator`, `Knowledge Manager` or
`Approver`. Delete the `min_system_role` predicate entirely and the query sends no roles at all, so
all three absences hold and the control is green against a query returning every tool in the table.
Rewritten as an equality — the exact set each role sends — it goes red along with six others. Name
what must be there, not only what must not.

**Arithmetic written in prose is arithmetic nobody has done.** The plan for WP-3.6 said "five real
screens plus sixteen planned makes twenty-one", and design §8.1 has twenty-one rows of which four
are real — so the true count was twenty-two routes, five real and seventeen planned, and the number
19 was already copied into seven documents. A twenty-line script that reads §8.1 out of the design
and compares it with the router found it in one run, and now says `21 screens in design §8.1, 22
routes declared (1 outside §8.1)`. Count with a command, against the document that decides, and the
count stops being a claim two people can read differently.

**A test suite is a caller, and the product's defences apply to it.** Twenty-three screen tests each
signed in, which is twenty-three attempts in two minutes against a limit of ten in fifteen — so the
suite went red on `RATE_LIMITED`, the FR-65 defence firing on the tests written to exercise it. The
fix was one signed-in context per spec file, letting the refresh token rotate inside it, which is
also how a person uses the product. A suite that has to disable a defence to run is testing a system
nobody ships.

**A measurement whose no-op case scores worse than its subject has not measured its subject.** The
first OCR upper bound compared Docling-with-OCR against a PDF's own text layer and scored 0.89 word
recall, below the 90 % that triggers R-01 — a decision about the plan, from one number. Switching OCR
off entirely, so Docling read the text layer directly, scored **0.61**. OCR cannot beat reading the
text, so the harness was measuring Docling's layout classification and Markdown export, not
Tesseract. Isolating the reader — pdfium's text against `tesseract` on a render of the same page,
nothing else on either side — gave 0.94 and the opposite conclusion. Before believing a comparison,
run it with the thing under test removed; whatever it still scores is what the harness contributes.

**A reference is only a reference if its own text layer is sound.** One gazette PDF carried its text
twice, the second copy broken into glyph runs — `ph`, `ển`, `c` as separate tokens — and a correct
OCR reading scored 0.402 against it, dragging a page-weighted average from 0.94 to 0.84. The tell
was arithmetic: common words appeared twice as often on the reference side as on the OCR side, and
41.8 % of its tokens were one or two characters where every other document sat between 14.7 % and
23.0 %. Measure the ground truth before scoring anything against it, and report the measurement per
item rather than the verdict alone.

**To isolate one contributor, make the others prefer the wrong answer.** Killing the dense branch with a zero vector still ranked every chunk, because ordering by distance to zero orders everything. What isolates the lexical branch is a decoy sitting exactly on the question's own vector: it wins the dense branch outright, so only the lexical branch can put the right passage first. A control that cannot change the answer is not a control.

**A handler for failures that can itself fail stops everything.** `worker.on('failed', (job, error) => void this.onFailed(job, error))` — and `void` on a rejected promise is an unhandled rejection, which ends the Node process. One job whose audit row could not be written took the ingest worker down and stopped every later job from running at all. The path that runs when something has already gone wrong is the path least likely to have been exercised; give it its own catch.

**A queue outlives the code that filled it.** `IngestJob` gained a required field, and jobs enqueued by the previous build were still sitting in Redis without it when the new worker started. A job payload is a wire format between two versions of the same program, so a field added to it is optional until every job that predates it has drained — and a `NOT NULL` column downstream turns that into a crash rather than a warning.

**An append-only table's foreign keys freeze the rows they point at.** `audit_events` references `users` and `workspaces`, and once an action is audited neither row can be deleted: `ON DELETE CASCADE` would delete audit rows and `ON DELETE SET NULL` would update them, and the immutability trigger refuses both. It surfaced as two test teardowns failing, not as a design review. Immutability reaches further than the table it is declared on.

**Three checks that see different things, and the weakest is the one you would have written.** The authorisation matrix was loosened three ways and measured each time. Widening a row of the table: the matrix spec goes red and so does a real request. Removing the `@Roles` decorator: the table still agrees with the design, and only the route scan and a real request notice. Removing the guard from the controller's chain: the table is right, the decorator is still on the route, the scan is green — **and nothing but a real request can tell**. One check would have been the first one.

**Coverage measured before the last edit is not coverage.** The WP-2.4 gate reported 100 % on every metric, and the fix for the worker crash landed after that measurement — `test` was run afterwards, `test:coverage` was not. The lines that stopped a failed audit write from killing the process were never covered, and the gate said the opposite. Run the gate's own measurement after the last change, not before it.

**Two permission dimensions ANDed make one of them unreachable.** Design §9.1 gives "upload documents" to Administrator and Knowledge Manager, and the workspace roles give it to Owner and Editor; both must admit the caller. So a Member who is an Editor of a workspace cannot upload, and the Editor role is reachable only by someone whose system role already permits the action everywhere. Neither table is wrong on its own. Before layering two checks, write down who the narrower one leaves the wider one meaningless for.

## Packages

**Forward-only means a new file, never an edit.** The plan described later constraints as belonging "inside" migrations already written, which the checksum guard refuses and the discipline forbids. Work that arrives after a migration is applied arrives as the next number.

**A proving command that needs another package's task pulls it forward, it does not wait.** Run the task early, record it as a deviation, and leave its hours with the package that owns it. Scope moves between packages only through the task document.

**A locked network changes the development loop, not only production.** Containers on the internal network cannot reach a package registry, so a new dependency is a `package.json` edit, an image rebuild, and the `node_modules` volume dropped so it repopulates. There is no shortcut, and that is the constraint working as intended.

**Scope the plan never named is provisional until the gate.** When the work needs something no task describes, build the smallest version that keeps the invariants, record it as an open question, and let the gate decide whether it grows an existing task or earns an id.

**A library your build cannot load is not a candidate.** `file-type` is the obvious way to sniff a file signature and has been ESM-only since v17, while `apps/api` compiles to CommonJS — so the real offer was its last CommonJS release, from 2021, or nothing. Ten hand-written signatures, one per admitted format, are smaller than a library that recognises two hundred. Read the module format against the build's output format before weighing a dependency's features; this is the shape that bit at WP-3.1, where a package resolved a layout its peer no longer had and the application died at boot after `tsc` reported nothing.

**An image that installs a dependency is not an image that can run it.** `apps/parser` pinned
docling and installed the Tesseract Vietnamese data, and the first conversion ever attempted in it
failed with `LocalEntryNotFoundError`: docling fetches its layout and table-structure models from
the Hub on first use, and the container runs on the default-deny network. The image had been built
in CI for weeks and never asked to parse anything. A dependency's runtime assets are part of the
build on a network that will not fetch them later — and an image nothing has exercised is an image
nobody has run.

## Code

**Comments in English, and few of them.** A comment sits above a declaration and says _why_; it never restates what the line already says. One or two lines each.

**Avoid comments inside a function body.** A block that needs explaining wants a name, not a note — extract it into a small named function instead. The exception is a genuinely surprising constraint (a workaround, an ordering requirement, a spec quirk), and then one line is enough.

**Names carry the explanation.** Function and class names are short and say what the thing does, so most comments become unnecessary. `resolveWorkspaceRole` needs no comment; `handle` with a paragraph above it is the wrong trade.

**Look before you write.** Before adding a helper, search for one that already does the job — shared code lives in `packages/*`, `apps/api/src/common/`, `ports/` and `adapters/`. Two functions doing the same thing in different words is worse than one imperfect name.

**Prefer reuse over a new variant**, and prefer extending over rewriting.

**Changing a shared function is the last resort.** If the change would force edits at existing call sites, do not change it: add an optional parameter with a default that keeps current behaviour, or add a sibling function. When a shared function genuinely must change, read every call site first and say in your report which ones were checked.

**A retry must be able to re-enter the work it retried.** The ingestion state machine had no `parsing → parsing`, so an attempt that died after its first transition left the row where the next attempt could not resume. The retry then failed on the state machine rather than on the missing file that actually broke it, and `cannot move from parsing to parsing` is what landed in the column a person reads to find out why. A guard that refuses the retry replaces the fault with itself.

**What boots must not need what only one entrypoint has.** `api` and `ingest-worker` run the same module graph from the same image, and only the worker mounts the model cache. A snapshot lookup sitting in a constructor — beneath a comment promising it was deferred to first use — took the API down at boot over a directory it is never meant to have. Construct nothing that the other entrypoint cannot reach, and check that the comment claiming laziness describes the whole of it.

**A value the database already enforces is a constant, not configuration.** `document_versions.byte_size` carries a CHECK at 200 MB. A configured limit above it would let a file through the API only for the database to refuse it, and one below it is a second place to change. The identity thresholds became variables because nothing else enforced them; this one is enforced by the schema.

**A switch withholds; it does not create.** `TOOL_WEB_SEARCH_ENABLED=true` offers nothing, because
no `web_search` row exists until 2B writes one, and the operating mode has to say `web: off` rather
than promise a capability the agent would then not find. Where configuration and a registry both
have a say, configuration can only narrow what the registry already holds — and a test has to fix
that direction, or the flag reads like a feature toggle to the next person who finds it.

**An order the database cannot check is kept only by whoever writes the rows.** `tools.min_system_role`
carries a CHECK over the five role names and nothing more; the ranking that makes "minimum" mean
something lives in TypeScript. A row inserted with a role the ranking does not know passes the CHECK
and is invisible to every caller, silently. That is acceptable while the only writer is the seed, and
it stops being acceptable the moment a screen can write one.

**A screen that shows a state which changes on its own has to ask again.** A document reached
`indexed` in the database at 08:12:05 and the workspace table still read `embedding` three minutes
later, because the query had no polling and nothing invalidated it. Every unit and integration test
in the repository was green throughout — they test the API, and the API was right. Ingestion is a
queue and a worker, so the reader changes nothing and the answer changes anyway; the table now polls
while any row is unsettled and stops when they all are. A status that only updates on reload is a
timestamp with a misleading name.

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

## Packages

**Forward-only means a new file, never an edit.** The plan described later constraints as belonging "inside" migrations already written, which the checksum guard refuses and the discipline forbids. Work that arrives after a migration is applied arrives as the next number.

**A proving command that needs another package's task pulls it forward, it does not wait.** Run the task early, record it as a deviation, and leave its hours with the package that owns it. Scope moves between packages only through the task document.

**A locked network changes the development loop, not only production.** Containers on the internal network cannot reach a package registry, so a new dependency is a `package.json` edit, an image rebuild, and the `node_modules` volume dropped so it repopulates. There is no shortcut, and that is the constraint working as intended.

**Scope the plan never named is provisional until the gate.** When the work needs something no task describes, build the smallest version that keeps the invariants, record it as an open question, and let the gate decide whether it grows an existing task or earns an id.

## Code

**Comments in English, and few of them.** A comment sits above a declaration and says _why_; it never restates what the line already says. One or two lines each.

**Avoid comments inside a function body.** A block that needs explaining wants a name, not a note — extract it into a small named function instead. The exception is a genuinely surprising constraint (a workaround, an ordering requirement, a spec quirk), and then one line is enough.

**Names carry the explanation.** Function and class names are short and say what the thing does, so most comments become unnecessary. `resolveWorkspaceRole` needs no comment; `handle` with a paragraph above it is the wrong trade.

**Look before you write.** Before adding a helper, search for one that already does the job — shared code lives in `packages/*`, `apps/api/src/common/`, `ports/` and `adapters/`. Two functions doing the same thing in different words is worse than one imperfect name.

**Prefer reuse over a new variant**, and prefer extending over rewriting.

**Changing a shared function is the last resort.** If the change would force edits at existing call sites, do not change it: add an optional parameter with a default that keeps current behaviour, or add a sibling function. When a shared function genuinely must change, read every call site first and say in your report which ones were checked.

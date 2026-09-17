# WP-2.5 · Architecture rules in CI — stage 4

Opened 2026-09-15. Authorities: [Detail §WP-2.5](../ei-ai-phase-1-detail.md) — the five rules · [Detail §7](../ei-ai-phase-1-detail.md) the tree · [Tasks §4](../ei-ai-phase-1-tasks.md) · [Design §5.4](../../design/ei-ai-agentic-knowledge-assistant.md) the three seams · [Design §11.2](../../design/ei-ai-agentic-knowledge-assistant.md) the nine stages · [Progress §4.3](../ei-ai-progress.md).

## Contradictions found on opening

- 2026-09-15 — **rule 1 cannot be expressed in `dependency-cruiser`.** The tool reasons about the import graph; "queries the `chunks` table" is a string literal inside a file — `db.selectFrom('chunks')` under Kysely, or a `sql` template — and produces no dependency edge. [Detail §WP-2.5](../ei-ai-phase-1-detail.md) and [design §11.2](../../design/ei-ai-agentic-knowledge-assistant.md) both name `dependency-cruiser` as the enforcer of exactly this rule, and `T-2.5-02`'s "Done when" — *a `chunks` query added elsewhere fails the build* — needs a second mechanism that neither document names.
- 2026-09-15 — **rule 3 has nowhere to send a module.** It reads *"modules do not import each other's services; only through `ports/`"*, but [detail §7](../ei-ai-phase-1-detail.md) says `ports/` holds *"model-provider · vector-store · storage — only three seams"* and [design §5.4](../../design/ei-ai-agentic-knowledge-assistant.md) forbids adding a fourth: *"Nothing else is abstracted."* Those three are outbound infrastructure seams. A module that legitimately needs another module — `retrieval` needing workspace membership, `ingestion` needing `workspaces` — has no port to go through and no permitted way to build one.
- 2026-09-15 — **`packages/shared-types` does not exist and no task creates it.** [Detail §7](../ei-ai-phase-1-detail.md) lists it in the tree and [detail §2](../ei-ai-phase-1-detail.md) names it in WP-1.1's workspace line, but `T-1.1-01` closed on *"api, web and both packages"* — `eslint-config` and `tsconfig`. Rule 4 is worded as an allowlist, *"imports from `packages/shared-types` only"*, so its positive half has no subject; `T-2.4-03` and `T-3.2-01` also write into a package that is not there.
- 2026-09-15 — **four of the five rules have no subject on disk.** `apps/api/src` holds `config/`, `database/` and one module, `modules/admin`. There is no `ports/`, no `adapters/`, no `modules/connectors`, `modules/governance` or `modules/retrieval`. Detail says to write rules 2 and 5 anyway and gives the reason; rules 1 and 3 are in exactly the same position and it does not say so. Against the rule promoted at the WP-2.1 gate — make the check reach its subject — a stage 4 reporting zero violations over that graph is green for the wrong reason.
- 2026-09-15 — **`T-2.5-02`'s declared blocker contradicts the package's own principle.** [Tasks §2](../ei-ai-phase-1-tasks.md) blocks it on `T-2.3-02`, the repository file it guards. Detail argues the opposite in the same section: *a rule added before the code it constrains is a constraint; added afterwards it is a negotiation.* Its "Done when" is a deliberate violation, which needs no real repository.
- 2026-09-15 — **`T-2.5-05`'s declared blocker does not match its own "Done when".** [Tasks §2](../ei-ai-phase-1-tasks.md) blocks it on `T-3.6-04`, the 19 routes. The "Done when" is *"an import from `apps/api` in web fails the build"*, and `apps/web` exists and is crawlable today.
- 2026-09-15 — **installing the tool is a lockfile change on a machine with no Node.** The host has neither `node` nor `pnpm`, CI runs `pnpm install --frozen-lockfile`, and `pnpm-lock.yaml` must therefore be regenerated elsewhere before stage 4 can install anything. [CLAUDE.md `## Packages`](../../../CLAUDE.md) names the cost — a `package.json` edit, an image rebuild, the `node_modules` volume dropped — and `T-2.5-01`'s 4 hours read as though the tool were simply present.

## Open questions

- ~~2026-09-15 — what enforces rule 1, given `dependency-cruiser` cannot?~~ · **Answered 2026-09-15:** an ESLint architecture config, run inside stage 4 alongside the cruiser.
- ~~2026-09-15 — what does rule 3 mean, now that `ports/` cannot grow past its three seams?~~ · **Answered 2026-09-15:** no module imports another module's `*.service.ts`.
- ~~2026-09-15 — is rule 4 written as the negative half alone, or does this package create `packages/shared-types`?~~ · **Answered 2026-09-15:** the negative half alone; the package is left to whoever first needs it.
- ~~2026-09-15 — do `T-2.5-02` and `T-2.5-05` drop their declared blockers?~~ · **Answered 2026-09-15:** yes, both; the package runs whole.

## Interpretations

- 2026-09-15 — **rule 1 is enforced by ESLint, not by `dependency-cruiser`**, in `eslint.architecture.config.mjs` run as the second command of stage 4. `no-restricted-syntax` matches the Kysely builder calls naming `chunks` and any `sql` template mentioning the table, over `apps/api/src` less `database/`. Keeping it in stage 4 rather than stage 1 is what makes the gate line — *CI stage 4 red on a deliberate architecture violation* — still true of the rule it was written for.
- 2026-09-15 — **rule 3 reads as "no module imports another module's `*.service.ts`"**, not the literal "only through `ports/`". `ports/` holds the three outbound seams design §5.4 permits and may not grow a fourth, so the literal reading is unsatisfiable by any module. The boundary that is actually enforceable is the one between a module's internals and its exported surface.
- 2026-09-15 — **rule 4 is written as its negative half alone** — `apps/web` must not import `apps/api`. That is exactly `T-2.5-05`'s "Done when". Creating an empty `packages/shared-types` here would be a package with no contents, written to satisfy the wording of a rule rather than a need; `T-3.2-01` is the task that first has something to put in it.
- 2026-09-15 — **`T-2.5-02` and `T-2.5-05` drop their declared blockers**, `T-2.3-02` and `T-3.6-04`. Detail's own argument for rules 2 and 5 — a rule added before the code it constrains is a constraint, after it a negotiation — applies unchanged to rule 1, and `apps/web` is crawlable today.
- 2026-09-15 — **"baseline config" is the crawl scope plus `no-circular`**, not an empty rule set. A config carrying no rules reports zero violations by construction, so `T-2.5-01`'s "Done when" would have gone green over a stage that could not fail. `no-circular` is `dependency-cruiser`'s own baseline and it fires on a real cycle.
- 2026-09-15 — the crawl runs with **`tsPreCompilationDeps: true`**. `consistent-type-imports` is an error in the shared ESLint config, so most cross-boundary imports are written as `import type` and are erased before runtime; without this option rules 2 to 5 would see almost nothing and report green.
- 2026-09-15 — rule 3 carries **no exemption for `*.spec.ts`**. A test that imports another module's service is the loophole that turns the rule into a negotiation, and no Phase 1 task needs one. A later package that genuinely does may argue for it then, against a rule already standing.
- 2026-09-15 — `tsPreCompilationDeps` was **shown to be load-bearing, not assumed**. The rule 4 probe imports with `import type`, which is how `consistent-type-imports` makes every such import look. With the option off the identical violation reports `no dependency violations found` and exit 0; with it on the rule fires by name. Every boundary rule here would otherwise have been green over an unread graph.
- 2026-09-15 — rule 5 names its providers rather than inferring them, and the pattern matches both a bare specifier and a `node_modules/` path, so it keeps working when an SDK is actually installed. No SDK is installed today, so the probe's import is unresolvable; a control importing a different unresolvable module from the same file reports green, which is what separates "this rule caught an SDK" from "this rule caught a broken import".
- 2026-09-15 — the TypeScript parser is exposed as a sibling export, `packages/eslint-config/parser.js`, rather than adding `typescript-eslint` to `apps/api`. Stage 4's config needs the parser and none of the shared rule set — a stage that also reported stage 1's findings would go red for reasons outside the invariant it defends — and a second declaration of the same version is a version to keep in step by hand.
- 2026-09-15 — the "WP-2.5 README" of `T-2.5-07` is [`docs/ops/architecture-rules.md`](../../ops/architecture-rules.md). `docs/ops/` is already in [detail §7](../ei-ai-phase-1-detail.md)'s tree, so the directory is the one the plan named rather than one invented here.

## Tradeoffs

- 2026-09-15 — **stage 4 is two commands, not one.** Folding rule 1 into stage 1's ESLint run would have kept it to one, and would have broken the gate line: *CI stage 4 red on a deliberate architecture violation*. The cost is a second install step in the job; the alternative was a gate line that no longer described where the rule lives.
- 2026-09-15 — rule 1 matches the three shapes this codebase actually uses to reach a table — the Kysely builder, raw SQL in a string, raw SQL in a `sql` template — rather than attempting every shape SQL can take. A fourth shape would pass; the control that `` `indexed ${n} chunks` `` is *not* flagged is what keeps the rule from being switched off for noise.
- 2026-09-15 — the gate's own violation was made **type-only** — `erp.client.ts` exports a type and `health.controller.ts` imports it with `import type` — so that stage 4 would be the only stage to go red. A value import would have added an uncovered file to the coverage scope and turned stage 3 red as well, and a probe that reddens two stages proves less about either. It also puts the hardest case in the gate's own evidence: the import the compiler erases.

---

## Gate · closed 2026-09-15

Reviewed and accepted: all seven tasks. Run #9 green with stage 4 running for the first time,
run #10 red at **stage 4 alone** on a deliberate rule-2 violation, run #11 green after the
revert — and `git diff 78c3cd3 HEAD` empty, so the revert took nothing but the probe.

The constraints were easy; the evidence was the work. Twice a rule reported what looked like
the right answer for the wrong reason, and both were found only by running the control rather
than the case: four import rules were blind to every `import type` until `tsPreCompilationDeps`
was turned on, and the provider-SDK rule would have fired on any package that is not installed.
A rule that has never refused the near miss has not been checked.

Two of the five rules also had to be re-read before they could be written at all. Rule 1 cannot
be a `dependency-cruiser` rule — a table name is source text, not an edge — so stage 4 is two
commands. Rule 3's "only through `ports/`" is unsatisfiable, because `ports/` holds the three
seams design §5.4 permits and may not grow a fourth.

**Not read by a person:** the CI log line naming the rule. Job logs need admin rights, so the
evidence is that stage 4 alone failed at step `Run pnpm arch`, and that the identical tree
reproduces `connectors-only-via-governance` locally.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — two rules, in force from the next package:
what the checker reads must be what the rule is written against; a rule that fires is not yet
a rule that discriminates.

**Promoted to [Progress §3](../ei-ai-progress.md)** — `Q-13`, the `shared-types` package that
is named in the tree, written into by two later tasks, and created by none.

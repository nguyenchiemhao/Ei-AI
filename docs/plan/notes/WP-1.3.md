# WP-1.3 · Base CI — stages 1–3, 5, 6

Opened 2026-09-15. Authorities: [Detail §2](../ei-ai-phase-1-detail.md) · [Tasks §3](../ei-ai-phase-1-tasks.md) · [Detail §11](../ei-ai-phase-1-detail.md) test plan · [Progress §4.3](../ei-ai-progress.md).

## Contradictions found on opening

- 2026-09-15 — **`T-1.3-06` requires Testcontainers, which is `T-5.4-01` in WP-5.4 — G5, the pre-agreed cut.** Its "Done when" reads "both paths run against a Testcontainers Postgres", so a stage in the non-cuttable G1 depends on infrastructure the plan has already agreed to drop first if time runs short.
- 2026-09-15 — **"previous release tag → head" has no previous release tag.** `git tag` is empty and Phase 1 produces no release, so half of stage 6 cannot run and will not be able to for months. [Detail §1.3](../ei-ai-phase-1-detail.md) invented this path to replace `down` migrations, without saying what it does on the first run.
- 2026-09-15 — **the 80% coverage gate measures modules that do not exist yet.** [Detail §11](../ei-ai-phase-1-detail.md) lists what "domain modules" means — RRF fusion, chunk boundary maths, token counting, content sniffing, password policy — and every one of them belongs to WP-2.3, WP-3.1, WP-3.3 or WP-3.4. Today the only code under `apps/api/src` is `config/` and `database/`, so the gate either measures the wrong thing or fails on an empty denominator.
- 2026-09-15 — **`@vitest/coverage-v8` is not installed.** `T-1.3-04` cannot run at all as things stand, and adding a dependency now means an image rebuild and dropping the `node_modules` volume.
- 2026-09-15 — **every "Done when" in this package needs a run on GitHub**, and the machine has no `.github/` directory and no `gh` CLI. Nothing here can be demonstrated without a push, which [CLAUDE.md `## Git`](../../../CLAUDE.md) reserves to an explicit request. The pull-request half of the wording is resolved under Interpretations: `dev` is the trunk.
- 2026-09-15 — `T-1.3-05` builds all three images on a hosted runner. The parser image is **2.88 GB** and takes several minutes because Docling pulls CPU torch; GitHub-hosted runners start with roughly 14 GB free. Not a contradiction in the plan, but the first thing likely to fail in practice.

- 2026-09-15 — **`--target dev` compiles nothing.** Proving stages 1 and 2 could fail also showed stage 5 staying green against code that does not typecheck: the `dev` target only copies source and sets a CMD, while `nest build` lives in the `build` stage that only `prod` depends on. CI was therefore never building the image that ships.
- 2026-09-15 — **the `prod` target had never been built, and did not work.** Its first build ever, run today, failed with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`: `pnpm install --prod` has to remove the dev `node_modules` and refuses to do so unprompted without a TTY. A defect carried since `T-1.1-05`, invisible because nothing built that target.

## Open questions

- 2026-09-15 — does stage 6 run against a plain `postgres` service container instead of Testcontainers, keeping the dependency inside G1? Testcontainers would pull `T-5.4-01` forward out of the pre-agreed cut. · **blocks `T-1.3-06`**
- 2026-09-15 — what does "previous release tag → head" do when no tag exists: skip with a stated reason, or fall back to the previous commit on `main`? · **blocks `T-1.3-06`**
- 2026-09-15 — is the coverage gate set at 80% now and allowed to constrain only `config/` and `database/`, or declared at 80% and enforced from the package that first adds a domain module? · **blocks `T-1.3-04`**
- ~~2026-09-15 — is the branch pushed and a pull request opened so this package can be proved at all, and who opens it?~~ · **Answered 2026-09-15:** `dev` is pushed and is the trunk; the proof reads the Actions run of a push, not a PR's checks.

## Interpretations

- 2026-09-15 — stage 6 runs against a **GitHub Actions `postgres` service container**, not Testcontainers. Testcontainers stays `T-5.4-01` in G5 where the plan put it, so a stage in the non-cuttable G1 does not depend on work already agreed as the first thing to cut. The service container is also closer to what stage 6 is testing: a migration against a database it did not create.
- 2026-09-15 — the "previous release tag → head" half of stage 6 **skips with a stated reason** while no tag exists, printing what it skipped and why, and turns itself on when the first tag appears. Falling back to the previous commit on `main` was rejected: it would test a path no customer ever walks and would report green for the wrong reason.
- 2026-09-15 — the coverage gate is **declared at 80% and scoped to domain directories**, which are empty today, so the stage is green and honest rather than green because the threshold was lowered. The first package to add a domain module inherits a gate already standing rather than having to argue for one.
- 2026-09-15 — the branch is `dev` and CI triggers on `pull_request` to any target plus `push` to `main` and `dev`, so a push that never becomes a PR is still checked.
- 2026-09-15 — **`dev` is the working trunk and nothing merges to `main` yet.** [Detail §2](../ei-ai-phase-1-detail.md) words WP-1.3's proof as "a pull request runs stages 1, 2, 3, 5 and 6", which assumes a PR exists. The substance of that proof — nine stages, five running and four visibly skipped — is equally visible on the Actions run of a push to `dev`, and that is how this package is proved. The `pull_request` trigger stays wired and unexercised until `dev → main` opens.

## Deviations

- 2026-09-15 — the parser image is built **only when something under `apps/parser/` changed**, not on every run. It is 2.88 GB against a runner that starts with roughly 14 GB free, and rebuilding it for a change to a TypeScript file buys nothing. An unresolvable base commit — a branch's first push — builds it anyway rather than skipping the heaviest image silently.
- 2026-09-15 — `*.controller.ts` is outside the coverage gate's scope. Controllers are the HTTP edge, which [detail §11](../ei-ai-phase-1-detail.md) covers with contract and end-to-end tests; counting them in a unit-coverage gate measures the wrong thing. `health.controller.spec.ts` was written anyway, so the exclusion removes a bad metric rather than a test.

## Tradeoffs

- 2026-09-15 — stage 5 builds **both** api targets rather than only `dev`. `T-1.3-05` says "build api, web and parser images" without naming a target, and building the one that skips compilation is the weaker reading of it — demonstrably so, since it passed on code that did not compile. The cost is about 40 s.

- 2026-09-15 — the coverage gate is declared at 80% over an empty domain scope, rather than set low and raised later. It reports 0% and passes today, which is only defensible because the gate was shown to still fail: a deliberately untested domain file turned it red with `Exit status 1` before being removed.

---

## Gate · closed 2026-09-15

Reviewed and accepted: all six tasks. Runs #1 and #3 green on `dev`, #2 deliberately red.
**G1 is complete.**

The deliberate failure earned its keep: it showed stage 5 green against code that did not
compile, which led to the `prod` image target — never built since `T-1.1-05` — failing its
first build ever with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — two rules, in force from the next package:
build the artefact that ships; a commit made to be reverted contains only the thing being reverted.

**Promoted to [Progress §3](../ei-ai-progress.md)** — Q-12, branch protection: CI reports but
does not gate, and run #2 put a broken commit on the trunk with nothing to stop it.

`T-1.3-07` was opened rather than left as a question, following the precedent set for the
ingress and the database tunnel. Nothing else moved.

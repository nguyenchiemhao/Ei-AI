# WP-1.3 · Base CI — stages 1–3, 5, 6

Opened 2026-09-15. Authorities: [Detail §2](../ei-ai-phase-1-detail.md) · [Tasks §3](../ei-ai-phase-1-tasks.md) · [Detail §11](../ei-ai-phase-1-detail.md) test plan · [Progress §4.3](../ei-ai-progress.md).

## Contradictions found on opening

- 2026-09-15 — **`T-1.3-06` requires Testcontainers, which is `T-5.4-01` in WP-5.4 — G5, the pre-agreed cut.** Its "Done when" reads "both paths run against a Testcontainers Postgres", so a stage in the non-cuttable G1 depends on infrastructure the plan has already agreed to drop first if time runs short.
- 2026-09-15 — **"previous release tag → head" has no previous release tag.** `git tag` is empty and Phase 1 produces no release, so half of stage 6 cannot run and will not be able to for months. [Detail §1.3](../ei-ai-phase-1-detail.md) invented this path to replace `down` migrations, without saying what it does on the first run.
- 2026-09-15 — **the 80% coverage gate measures modules that do not exist yet.** [Detail §11](../ei-ai-phase-1-detail.md) lists what "domain modules" means — RRF fusion, chunk boundary maths, token counting, content sniffing, password policy — and every one of them belongs to WP-2.3, WP-3.1, WP-3.3 or WP-3.4. Today the only code under `apps/api/src` is `config/` and `database/`, so the gate either measures the wrong thing or fails on an empty denominator.
- 2026-09-15 — **`@vitest/coverage-v8` is not installed.** `T-1.3-04` cannot run at all as things stand, and adding a dependency now means an image rebuild and dropping the `node_modules` volume.
- 2026-09-15 — **every "Done when" in this package needs a pull request on GitHub**, and the branch has five unpushed commits, no `.github/` directory, and no `gh` CLI on the machine. Nothing here can be demonstrated without a push, which [CLAUDE.md `## Git`](../../../CLAUDE.md) reserves to an explicit request.
- 2026-09-15 — `T-1.3-05` builds all three images on a hosted runner. The parser image is **2.88 GB** and takes several minutes because Docling pulls CPU torch; GitHub-hosted runners start with roughly 14 GB free. Not a contradiction in the plan, but the first thing likely to fail in practice.

## Open questions

- 2026-09-15 — does stage 6 run against a plain `postgres` service container instead of Testcontainers, keeping the dependency inside G1? Testcontainers would pull `T-5.4-01` forward out of the pre-agreed cut. · **blocks `T-1.3-06`**
- 2026-09-15 — what does "previous release tag → head" do when no tag exists: skip with a stated reason, or fall back to the previous commit on `main`? · **blocks `T-1.3-06`**
- 2026-09-15 — is the coverage gate set at 80% now and allowed to constrain only `config/` and `database/`, or declared at 80% and enforced from the package that first adds a domain module? · **blocks `T-1.3-04`**
- 2026-09-15 — is the branch pushed and a pull request opened so this package can be proved at all, and who opens it? · **blocks every task in the package**

## Interpretations

- 2026-09-15 — stage 6 runs against a **GitHub Actions `postgres` service container**, not Testcontainers. Testcontainers stays `T-5.4-01` in G5 where the plan put it, so a stage in the non-cuttable G1 does not depend on work already agreed as the first thing to cut. The service container is also closer to what stage 6 is testing: a migration against a database it did not create.
- 2026-09-15 — the "previous release tag → head" half of stage 6 **skips with a stated reason** while no tag exists, printing what it skipped and why, and turns itself on when the first tag appears. Falling back to the previous commit on `main` was rejected: it would test a path no customer ever walks and would report green for the wrong reason.
- 2026-09-15 — the coverage gate is **declared at 80% and scoped to domain directories**, which are empty today, so the stage is green and honest rather than green because the threshold was lowered. The first package to add a domain module inherits a gate already standing rather than having to argue for one.
- 2026-09-15 — the branch is `dev` and CI triggers on `pull_request` to any target plus `push` to `main` and `dev`, so a push that never becomes a PR is still checked.

## Deviations

- none yet

## Tradeoffs

- none yet

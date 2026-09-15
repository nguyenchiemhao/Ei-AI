# WP-3.1 · Identity

Opened 2026-09-15. Authorities: [Detail §WP-3.1](../ei-ai-phase-1-detail.md) · [Tasks §5](../ei-ai-phase-1-tasks.md) · [Design §9.1](../../design/ei-ai-agentic-knowledge-assistant.md) roles · FR-58, FR-64, FR-65 · [Progress §4.3](../ei-ai-progress.md).

`002_identity.sql` is already applied and carries `users`, `refresh_tokens`, `login_attempts` and `group_mappings` with their constraints. This package writes the code above it.

## Contradictions found on opening

- 2026-09-15 — **the package's own gate has nowhere to run.** `T-3.1-12`'s "Done when" is *"Both green in CI stage 7"*, and stage 7 sits in [ci.yml](../../../.github/workflows/ci.yml) as `if: false`, implemented by `T-5.4-01` in WP-5.4 — **G5, the pre-agreed cut**. A package in G3 therefore closes on a stage the plan has already agreed to drop first. WP-1.3 met this exact shape with Testcontainers and answered it by using stage 6's service container instead.
- 2026-09-15 — **`argon2`'s install script will not run, and nothing will say so.** Root `package.json` sets `pnpm.onlyBuiltDependencies` to `@nestjs/core` and `esbuild`; `argon2@0.41.1` declares `"install": "node-gyp-build"`. pnpm 10 skips an unlisted package's install script silently, so the native binding is never resolved and the failure lands at the first `hash()` call rather than at install. [Detail §WP-3.1](../ei-ai-phase-1-detail.md) names the library and the version and not this.
- 2026-09-15 — **the configurable password policy has no configuration.** `T-3.1-02` asks for one; [`env.schema.ts`](../../../apps/api/src/config/env.schema.ts) declares `JWT_SECRET`, `ACCESS_TOKEN_TTL` and `REFRESH_TOKEN_TTL` and nothing about passwords. `T-1.1-04` made that schema the one place every variable is declared, so the policy needs variables no task creates.
- 2026-09-15 — **the rate limit and the lockout are literals in two documents and configuration in neither.** Detail and Tasks both write "10 per account per 15 minutes" and "lockout after 10". WP-2.3 is told in the same document that `RETRIEVAL_*` "come from config, never from constants"; nothing says whether identity's numbers are held to that.
- 2026-09-15 — **`T-3.1-03` asks for a property no ordinary test asserts.** Its "Done when" is *"Unknown email and wrong password are indistinguishable in response **and in timing**"*. On a shared hosted runner a timing comparison is a statistical test with a tolerance, which is how flaky tests are born. The mechanism that produces the property — always run a dummy Argon2id verify on an unknown account — is assertable; the timing itself is not.
- 2026-09-15 — **`T-3.1-10` needs a way to disable a user that Phase 1 does not build.** Detail puts the admin surface in Phase 2 and keeps "the mechanism" here, so "disabling a user invalidates a live access token inside a minute" can only be driven by writing to the database directly.
- 2026-09-15 — **the 80 % coverage gate goes live with this package.** WP-1.3 declared it over `src/modules/**`, `src/adapters/**` and `src/ports/**` and noted the scope was empty, so the stage has been green over nothing. `T-3.1-02` is the first file inside it. Not a defect; a cost nobody priced, and this package pays it first.
- 2026-09-15 — **architecture rule 3 is now in force and shapes where this package's code may live.** `no-cross-module-service` refuses any import of another module's `*.service.ts`, and WP-3.2's guards will need identity. `common/` is not under `modules/`, so guards placed there are unaffected — but that is now a constraint rather than a preference.

## Open questions

- 2026-09-15 — where do `T-3.1-12`'s two gate scenarios run, given stage 7 is in the pre-agreed cut: stage 6's existing Postgres service container, a stage of their own alongside it, or `T-5.4-01` pulled forward out of G5? · **blocks `T-3.1-12`, and the package cannot close without it**
- 2026-09-15 — `argon2` 0.41 with its install script added to `onlyBuiltDependencies`, or `@node-rs/argon2`, which ships a prebuilt Rust binding and needs no build step in the image at all? The first keeps the plan's wording; the second takes node-gyp out of the picture. · **blocks `T-3.1-02`**
- 2026-09-15 — do the password policy, the rate-limit window and the lockout threshold become environment variables in `env.schema.ts`, or named constants in the module? · **blocks `T-3.1-02`, `T-3.1-08`, `T-3.1-09`**
- 2026-09-15 — what closes `T-3.1-03`'s timing clause: asserting the mechanism, or comparing measured timings within a tolerance? · **blocks `T-3.1-03`**

# Architecture rules — CI stage 4

Five rules, no exceptions ([design §11.2](../design/ei-ai-agentic-knowledge-assistant.md), [Phase 1 · Detail WP-2.5](../plan/ei-ai-phase-1-detail.md)). They are constraints rather than conventions: each one fails a build, and four of the five were written before the code they guard existed.

Stage 4 is **two commands**, because the five rules are not all the same kind of rule.

| Command | Covers | Config |
| --- | --- | --- |
| `pnpm arch` | rules 2–5 — import-graph rules | [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs) |
| `pnpm --filter @ei-ai/api arch:chunks` | rule 1 — a source-text rule | [`apps/api/eslint.architecture.config.mjs`](../../apps/api/eslint.architecture.config.mjs) |

Rule 1 needs the second command because `dependency-cruiser` reasons about imports and a SQL table name produces no import. It runs under its own ESLint config rather than the workspace one, so stage 4 cannot go red for a formatting complaint that belongs to stage 1.

## The rules

| # | Name in the output | What it refuses |
| --- | --- | --- |
| 1 | `no-restricted-syntax` | any file but `modules/retrieval/hybrid-search.repository.ts` querying `chunks` — the Kysely builder, raw SQL in a string, raw SQL in a `sql` template |
| 2 | `connectors-only-via-governance` | anything but `modules/governance/execution.gateway.ts` importing `modules/connectors` |
| 3 | `no-cross-module-service` | a module importing another module's `*.service.ts` |
| 4 | `web-not-to-api` | `apps/web` importing `apps/api` |
| 5 | `provider-sdk-only-in-adapter` | a model-provider SDK imported outside `adapters/model-provider/` |

Rule 3 is the enforceable reading of *"modules talk only through `ports/`"*: `ports/` holds the three outbound seams of [design §5.4](../design/ei-ai-agentic-knowledge-assistant.md) and may not grow a fourth, so a module reaches another module through its exported surface instead. Rule 4 enforces only its negative half while `packages/shared-types` does not exist.

## Running them on this machine

There is no Node and no pnpm in the distro — [ADR-13](../design/ei-ai-agentic-knowledge-assistant.md) keeps the host to Docker and VS Code. Run either command in a throwaway container:

```sh
docker run --rm -v "$PWD":/workspace -w /workspace \
  -u "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  node:22.13.1-bookworm-slim \
  sh -c 'npx --yes pnpm@10.34.5 arch'
```

## Proving a rule can still fail

A rule that has never fired is a rule nobody has checked. Each one has a probe: add it, run the command, confirm the **named** rule is what refused, then delete it.

| Rule | Probe | Expected |
| --- | --- | --- |
| 1 | `db.selectFrom('chunks')` in any file but the repository | `no-restricted-syntax`, exit 1 |
| 2 | a file under `modules/connectors/`, imported from `modules/admin/` | `connectors-only-via-governance`, exit 1 |
| 3 | `modules/a/x.ts` importing `modules/b/y.service.ts` | `no-cross-module-service`, exit 1 |
| 4 | `apps/web/src/x.ts` importing anything under `apps/api/src/` | `web-not-to-api`, exit 1 |
| 5 | `import Anthropic from '@anthropic-ai/sdk'` outside the adapter | `provider-sdk-only-in-adapter`, exit 1 |

Two of these pass for the wrong reason if you only read the exit code:

- **Rule 5** fires on a module that is not installed. Import a *different* uninstalled module from the same file and confirm that one is accepted — otherwise the rule may be catching "cannot resolve" rather than "is an SDK".
- **Every import rule** depends on `tsPreCompilationDeps: true`. `consistent-type-imports` makes most cross-boundary imports `import type`, which is erased before runtime; with the option off the rule 4 probe reports *no dependency violations found* and exits 0.

## The gate's own violation

WP-2.5 closes on a violation that reaches GitHub, not only the working tree ([Detail WP-2.5](../plan/ei-ai-phase-1-detail.md)): create `apps/api/src/modules/connectors/erp.client.ts`, import it from `modules/admin/health.controller.ts`, commit **only those two files**, watch stage 4 go red, then revert. Staging by name matters — a `git add -A` on a probe commit has swept working notes into a revert before.

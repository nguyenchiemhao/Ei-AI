# Authorisation — the deliberate-loosening check

Design §9.1's matrix lives in `packages/shared-types/src/permissions.ts` and nowhere else. Two
guards read it, and three things defend it. `T-3.2-08` is the task of running this procedure; a
check that has never been made to fail is not a check.

## What must go red

| Suite                               | Reads                                                 | Stage |
| ----------------------------------- | ----------------------------------------------------- | ----- |
| `permissions.matrix.spec.ts`        | the table against design §9.1, transcribed separately | 3     |
| `authorisation.integration.spec.ts` | real 403s over HTTP                                   | 6c    |
| `scripts/check-route-decisions.mjs` | every mapped route against its recorded decision      | 6c    |

## The three loosenings

**1. Widen a row of the matrix.** Add `'Member'` to `workspace.manage` in `permissions.ts`. The
matrix spec goes red, because its expectations are transcribed from §9.1 rather than imported from
the table under test; the integration suite goes red too, at _"refuses a Member"_.

**2. Remove a decorator.** Delete `@Roles('workspace.manage')` from `POST /workspaces`. The matrix
spec stays green — it knows nothing about routes — and the other two go red: the route check reports
`MISS POST /workspaces`, and a Member creating a workspace receives 201.

**3. Remove a guard from the chain.** Drop `RolesGuard` from the controller's `@UseGuards`. The
route check stays green, because the decorator is still there; only the integration suite notices.
That is why there are three and not one.

```bash
docker compose -f infra/compose/docker-compose.yml exec api \
  sh -c 'pnpm --filter @ei-ai/api test src/modules/identity/permissions.matrix.spec.ts'
docker compose -f infra/compose/docker-compose.yml run --rm --no-deps --entrypoint node \
  api apps/api/scripts/check-route-decisions.mjs
docker compose -f infra/compose/docker-compose.yml exec api \
  sh -c 'pnpm --filter @ei-ai/api build && pnpm --filter @ei-ai/api test:integration'
```

Restore, and confirm all three are green again — a check that only goes red is half a check.

## Recorded results

**2026-09-22**, each measured rather than predicted — the first attempt at this table guessed and
was wrong about every number.

| Loosening                                    | Matrix spec     | Route check              | Integration     |
| -------------------------------------------- | --------------- | ------------------------ | --------------- |
| 1 · `Member` added to `workspace.manage`     | **1 of 86 red** | 15/15 green              | **2 of 46 red** |
| 2 · `@Roles` removed from `POST /workspaces` | 86 green        | **1 without a decision** | **3 of 46 red** |
| 3 · `RolesGuard` removed from the chain      | 86 green        | 15/15 green              | **4 of 46 red** |
| restored                                     | 86 green        | 15/15 green              | 46 green        |

Read the row for loosening 3: two of the three checks see nothing. The decorator is still on the
route and the table still says what it said; only a real request notices that nothing reads them.
That is the argument for having three.

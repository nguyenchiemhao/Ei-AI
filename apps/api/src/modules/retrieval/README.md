# Retrieval — the mutation check

`hybrid-search.repository.ts` is the only file permitted to read `chunks` (WP-2.5 rule 1). Two
suites defend the predicate inside it, and a test that cannot fail defends nothing — so the
procedure for making both of them fail is written here, and `T-2.3-10` is the task of running it.

## What must go red

- `permission-predicate.spec.ts` — reads the **compiled SQL**, not results. Stage 3, no database.
- `hybrid-search.integration.spec.ts` — drives real rows it creates itself. Stage 6c, needs Postgres.

## The procedure

Delete the three `JOIN permitted p ON p.document_version_id = c.document_version_id` lines from
`compile()` — one in `dense`, one in `lexical`, one in the payload select — and run both suites:

```bash
docker compose -f infra/compose/docker-compose.yml exec api \
  sh -c 'pnpm --filter @ei-ai/api test src/modules/retrieval/permission-predicate.spec.ts \
      && pnpm --filter @ei-ai/api build && pnpm --filter @ei-ai/api test:integration'
```

Both must fail. Then restore the lines and confirm both pass again — a check that only goes red is
half a check.

## What each failure proves

Removing the joins leaves the `permitted` CTE declared and unused, which is valid SQL: the query
still runs and still returns rows. That is the point. Nothing crashes, nothing warns, and the only
thing that changes is _which_ rows come back — which is why the leak has to be asserted rather
than watched for.

| Suite                               | What it notices                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `permission-predicate.spec.ts`      | The join count falls from three to zero, and the SQL no longer contains the predicate   |
| `hybrid-search.integration.spec.ts` | An outsider receives candidates; a member without a grant receives the restricted chunk |

## Recorded results

**2026-09-21.** Joins removed: **4 of the 13** compiled-SQL assertions failed and **13 of the 27**
integration assertions did, `leakage > gives an outsider nothing at all` among them. Joins restored:
13 and 27 green. The leak is not subtle once asserted — an outsider with no membership anywhere
received candidates — and it is completely silent otherwise: the query still runs, the CTE is simply
declared and never joined, and PostgreSQL has no complaint about that.

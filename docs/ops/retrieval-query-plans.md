# Query plans for hybrid retrieval — `T-2.3-03`, `T-2.3-11`

**Recorded 2026-09-21.** PostgreSQL 17.6 with pgvector 0.8.0, `chunks` holding 30 000 rows.

## Why not the seeded corpus

`T-2.3-03` asks that `EXPLAIN` show an index scan. The seeded corpus is **123 chunks**, and against
a table that small the planner sequentially scans both branches — correctly, because reading 123
rows is cheaper than descending an index. Measured before anything was changed:

```
->  Seq Scan on chunks c (actual time=0.084..0.860 rows=123 loops=1)
->  Seq Scan on chunks c (actual time=0.184..0.823 rows=39 loops=1)
```

So the plans below are taken against a corpus grown for the purpose by
`apps/api/scripts/check-query-plans.mjs`, which builds it, measures, and removes it:

```bash
docker compose -f infra/compose/docker-compose.yml run --rm --no-deps --entrypoint node \
  api apps/api/scripts/check-query-plans.mjs 30000
```

Its chunks carry twelve terms drawn from a vocabulary of five hundred, so a three-term question
matches about 6 % of the corpus. An earlier version repeated one sentence in every chunk; every
term then matched every row, the GIN index was worth nothing against a predicate that selects
everything, and the planner sequentially scanned. That was the fixture being wrong, not the index.

## Two things this measurement had to settle first

**At 10 000 rows the lexical plan is unstable.** Three identical runs gave `SEQ`, `INDEX`, `INDEX`.
Execution times were 4.8 ms sequential against 3.5 ms indexed — close enough that the planner is
entitled to change its mind, and what moved it was the dead tuples this script leaves behind when it
builds and drops a corpus in the same table. The script now runs `VACUUM ANALYZE` rather than
`ANALYZE`, and the row count is 30 000. Three runs at that size chose the index every time.

**Where the `tsquery` sits does not decide it.** The branch computes its query from the question, so
the value is not a constant at plan time; the concern was that a `FROM` item would become a join
filter the index could not serve. Both shapes are measured below and both reach the index, so the
query keeps design §6.1's shape.

## The plans

```
--- dense branch (HNSW over halfvec): INDEX ---
Limit (actual time=0.222..0.415 rows=60 loops=1)
  ->  Index Scan using chunks_embedding_hnsw on chunks c (actual time=0.221..0.409 rows=60 loops=1)
        Order By: (embedding <=> $1::halfvec)
Planning Time: 0.130 ms
Execution Time: 0.461 ms

--- lexical, tsquery as a FROM item: INDEX ---
Limit (actual time=6.894..6.900 rows=60 loops=1)
  InitPlan 1
    ->  Function Scan on unnest lexeme (actual time=0.003..0.004 rows=3 loops=1)
  ->  Sort (actual time=6.894..6.896 rows=60 loops=1)
        Sort Key: (ts_rank_cd(c.text_search, q.q)) DESC
        Sort Method: top-N heapsort  Memory: 29kB
        ->  Nested Loop (actual time=0.284..6.745 rows=1920 loops=1)
              ->  Function Scan on to_tsquery q (actual time=0.027..0.027 rows=1 loops=1)
              ->  Bitmap Heap Scan on chunks c (actual time=0.246..1.219 rows=1920 loops=1)
                    Recheck Cond: (text_search @@ q.q)
                    Heap Blocks: exact=863
                    ->  Bitmap Index Scan on chunks_text_search_gin (actual time=0.176..0.176 rows=1920 loops=1)
                          Index Cond: (text_search @@ q.q)
Planning Time: 0.348 ms
Execution Time: 6.921 ms

--- lexical, tsquery as a scalar subquery: INDEX ---
Limit (actual time=6.241..6.247 rows=60 loops=1)
  CTE terms
    ->  Result (actual time=0.009..0.010 rows=1 loops=1)
          InitPlan 1
            ->  Function Scan on unnest lexeme (actual time=0.002..0.003 rows=3 loops=1)
  InitPlan 3
    ->  CTE Scan on terms (actual time=0.000..0.000 rows=1 loops=1)
  InitPlan 4
    ->  CTE Scan on terms terms_1 (actual time=0.010..0.010 rows=1 loops=1)
  ->  Sort (actual time=6.241..6.243 rows=60 loops=1)
        Sort Key: (ts_rank_cd(c.text_search, (InitPlan 3).col1)) DESC
        Sort Method: top-N heapsort  Memory: 29kB
        ->  Bitmap Heap Scan on chunks c (actual time=0.247..6.106 rows=1920 loops=1)
              Recheck Cond: (text_search @@ (InitPlan 4).col1)
              Heap Blocks: exact=863
              ->  Bitmap Index Scan on chunks_text_search_gin (actual time=0.176..0.176 rows=1920 loops=1)
                    Index Cond: (text_search @@ (InitPlan 4).col1)
Planning Time: 0.091 ms
Execution Time: 6.264 ms

```

## What this does not say

- **These are synthetic chunks with random vectors.** HNSW's recall on real embeddings is not
  measured here and is not what `T-2.3-03` asks about; the question was whether the planner chooses
  the index, and it does.
- **30 000 rows is a threshold, not a target.** It is the size at which the choice stopped flipping
  on this machine, with this vocabulary. A real corpus with different term distribution will have a
  different threshold.
- **No permission predicate is in these plans.** They isolate one branch each, which is what makes
  the scan visible; the predicate is asserted separately by `permission-predicate.spec.ts` against
  the compiled SQL and by the integration suite against real rows.

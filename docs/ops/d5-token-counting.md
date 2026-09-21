# D-5 — How a token is counted

**Decided 2026-09-21: the XLM-RoBERTa tokenizer, `CHUNK_TOKEN_COUNTER=tokenizer`.** The
character-ratio approximation stays reachable as `ratio` and is not dead code.

[Detail §WP-3.4](../plan/ei-ai-phase-1-detail.md) frames the question: *"the chunk size must mean the
same thing to the chunker as to BGE-M3, or '200–400 tokens' is fiction"*, and asks for the choice to
be made *"in week 2 with a measurement, not an opinion"*. This is the measurement.

## Method

`apps/api/scripts/measure-token-counting.mjs`, run against the seed corpus — 50 Vietnamese Markdown
documents, 124 333 characters — through the container that mounts the model cache:

```bash
docker compose -f infra/compose/docker-compose.yml run --rm --no-deps --entrypoint node \
  ingest-worker apps/api/scripts/measure-token-counting.mjs
```

The tokenizer is BGE-M3's own `tokenizer.json`, read out of the `models` volume that infinity
populated, so the count is the count the embedding model will actually make. Each counter is asked
to cut every document into windows targeting 300 tokens; both are then judged by the **true** token
count of the windows they produced, against the mandated band of 200–400.

Counting includes the two special tokens BGE-M3 prepends and appends. The budget a chunk has to fit
inside is the model's, not the tokenizer's.

## What it found — 2026-09-21

```
corpus              50 files, 124333 chars, 31752 tokens
global ratio        3.916 chars/token
build tokenizer     611 ms  (once per worker process)
tokenize whole set  199 ms  (4.0 ms/doc)

ratio by genre
  bao-cao              3.502  (8 docs)
  bien-ban-hop         3.855  (9 docs)
  hop-dong             3.978  (9 docs)
  huong-dan            4.050  (8 docs)
  quy-trinh            4.077  (8 docs)
  tai-lieu-ky-thuat    3.944  (8 docs)
  spread               3.502–4.077

windows targeting 300 tokens, band 200–400
  tokenizer          0/75 outside (0.0%)  counts 300–300 (median 300)
  ratio @ 3.916      0/75 outside (0.0%)  counts 279–373 (median 293)

ratio calibrated on one genre, applied to the whole corpus
  bao-cao              @ 3.502  0/94 outside (0.0%)
  bien-ban-hop         @ 3.855  0/76 outside (0.0%)
  hop-dong             @ 3.978  0/74 outside (0.0%)
  huong-dan            @ 4.050  0/74 outside (0.0%)
  quy-trinh            @ 4.077  0/74 outside (0.0%)
  tai-lieu-ky-thuat    @ 3.944  0/74 outside (0.0%)
```

## Why the tokenizer, given the ratio did not fail

**The ratio was not refuted, and that is worth saying plainly.** On this corpus every window it
produced landed inside the band, including when calibrated on the one genre furthest from the mean
and applied to all the others. Detail's own fallback condition was *"if it proves slow"*, and the
argument for the tokenizer is therefore not that the alternative broke.

It is chosen for two reasons the numbers do support:

**It is exact by construction.** The tokenizer's windows are 300–300; the ratio's are 279–373. The
band allows ±33 % around the target and the ratio already spends ±24 % of it, on a corpus composed
from a single prose pool whose genre ratios span only 3.502–4.077. A corpus with mixed English, part
numbers, long tables or code — which is what a real customer set looks like — widens that spread,
and the remaining 9 % of headroom is not much to absorb it with.

**It is not slow.** 611 ms once per worker process, then 4.0 ms per document. The condition that
would have triggered the fallback does not hold, so nothing is bought by approximating.

## What this measurement does not prove

- **The corpus is composed, not collected.** Its 50 documents come from one authored pool of
  Vietnamese prose, so the ratio spread is narrower than a real corpus would show. The 0 % failure
  rate for the ratio is a statement about this corpus and not a general safety claim. The WP-4.1
  proxy corpus (`T-4.1-01`) is where a heterogeneous set will first exist.
- **Nothing here is measured on non-Markdown formats.** The parser lands in milestone 2A; until
  then only text the pass-through produces is chunked.
- **The 8.7 % figure from the discarded first attempt is not reproduced.** That attempt recorded the
  ratio as missing the band on 8.7 % of windows and was rolled back before it was committed; this run
  finds 0 %. The earlier number's corpus is unknown, so the two are not comparable, and it is
  recorded here as unreproduced rather than as contradicted.

## What the choice touches

- `CHUNK_TOKEN_COUNTER` — `tokenizer` (default) or `ratio`.
- `CHUNK_CHARS_PER_TOKEN` — 3.5 by default; **the measured value for this corpus is 3.916**, and an
  operator switching to `ratio` should set it from a run of the script above on their own documents
  rather than trusting either number.
- `MODEL_CACHE_DIR` — `/models`, mounted read-only into `ingest-worker`. With `ratio` selected the
  mount is not needed, which is the one deployment where the fallback earns its keep.
- `chunker_version` records which counter produced a set of chunks, so a re-index after a change is
  identifiable.

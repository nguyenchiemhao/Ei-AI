# WP-2.3 · Retrieval with the permission predicate

Opened 2026-09-21. Authorities: [Detail §WP-2.3](../ei-ai-phase-1-detail.md) · [Tasks §4](../ei-ai-phase-1-tasks.md) · FR-10 – FR-14, BR-06 · [Design §6.1](../../design/ei-ai-agentic-knowledge-assistant.md) the canonical query · [Progress §4.3](../ei-ai-progress.md).

Everything the query needs is on disk and populated. `chunks` holds **123 rows across 51 versions**,
every one with a `halfvec(1024)` embedding and a generated `text_search` tsvector;
`chunks_embedding_hnsw`, `chunks_text_search_gin` and `chunks_version_idx` are built;
`document_grants`, `documents.restricted` and `workspaces.status` (`active` | `archived`, by CHECK)
all exist with the shape design §6.1 assumes. `immutable_unaccent` is `IMMUTABLE PARALLEL SAFE`, and
a lexical probe confirms it strips diacritics as the index does — `hợp đồng thanh toán` compiles to
`'hop' & 'dong' & 'thanh' & 'toan'` and matches 39 of the 123 chunks.

This is the package the architecture rule was written for: since the WP-3.4 gate, rule 1 permits
exactly one file to **read** `chunks`, and that file is this package's and does not exist yet.

## Contradictions found on opening

- 2026-09-21 — **the relevance floor has no scale it can apply to.** `RETRIEVAL_RELEVANCE_FLOOR`
  defaults to `0.35` and is validated between 0 and 1, but an RRF score with k = 60 is bounded by
  `1/(60+1) + 1/(60+1) = 0.0328`. Every result the query can produce is below the default floor, so
  applied literally the endpoint returns nothing, always. FR-13's threshold reads like a reranker
  score — and Detail says plainly that the reranker **is not in the Phase 1 path**. `T-2.3-05`
  closes on *"changing the floor in `.env` changes the result count with no code change"*, which is
  demonstrable only across a range entirely below 0.0328.
- 2026-09-21 — **`T-2.3-03`'s "Done when" cannot be met at the seeded volume, and this is measured,
  not predicted.** `EXPLAIN (ANALYZE)` over the 123 chunks that exist gives a `Seq Scan` on both
  branches: the planner will not choose HNSW or GIN on a table this small, and it is right not to.
  `T-2.3-11`'s *"query-plan review at seeded volume"* would faithfully record two sequential scans.
  The check as written passes only against a corpus nothing in Phase 1 creates.
- 2026-09-21 — **Detail and design §6.1 disagree about which unaccent the query calls.** Detail says
  the lexical branch is *"`plainto_tsquery` over `immutable_unaccent`"*; §6.1's SQL writes
  `plainto_tsquery('simple', unaccent($4))`. The generated column is
  `to_tsvector('simple', immutable_unaccent(text))`. Calling a different function in the query than
  the one in the index is how a query silently stops matching.
- 2026-09-21 — **`T-2.3-07` closes on metrics that do not exist.** *"The second identical question
  skips the embedding call, visible in the client's metrics"* — `InfinityClient` counts nothing and
  no task creates a metric surface.
- 2026-09-21 — **the reranker is "wired behind the same interface" and no task wires it.** Detail
  §WP-2.3 says so in the same breath as excluding it from the Phase 1 path; `RERANK_MODEL` sits in
  the configuration schema unused. Eleven tasks and none mentions it.
- 2026-09-21 — **60 appears three times in §6.1's query and is not one number.** Two of them are the
  per-branch candidate `LIMIT`, which Detail says comes from `RETRIEVAL_CANDIDATE_LIMIT`; the third
  is RRF's k in `1.0 / (60 + rnk)`, which Detail calls *"RRF fusion at k=60"*. Reading the literal
  as a single setting would couple the fusion constant to the candidate limit.
- 2026-09-21 — **the specs may not read `chunks`.** Rule 1 permits exactly
  `modules/retrieval/hybrid-search.repository.ts`, and the WP-2.5 gate settled that `*.spec.ts` gets
  no exemption — *"a test that imports another module's service is the loophole that turns the rule
  into a negotiation"*. `leakage.spec.ts` must therefore learn B's chunk id from the rows it inserts
  itself, never by querying for them. Inserts are permitted: the WP-3.4 gate narrowed rule 1 to reads.
- 2026-09-21 — **no fixture exists for the leakage test.** All 50 seeded documents sit in one
  workspace, none is `restricted`, and `document_grants` is empty. The promoted rule is to build the
  fixtures rather than borrow whatever the database happens to hold.
- 2026-09-21 — **`POST /search`'s request shape is specified nowhere.** §6.1's `permitted` CTE takes
  a workspace-id array as `$2::uuid[]`, and neither the design nor `T-2.3-06` says whether the caller
  supplies it or whether it defaults to every workspace the caller belongs to. The difference is
  visible to anyone writing a client.
- 2026-09-21 — **`T-2.3-10` asks for a README "in the package"** and there is no `modules/retrieval/`
  directory yet, nor any precedent for a per-module README in this tree.

## Open questions

- ~~2026-09-21 — **the relevance floor**: rescale to the RRF range, leave it inert until 2A, or
  normalise the fused score first?~~ · **Answered 2026-09-21: normalise the fused score to 0–1.**
- ~~2026-09-21 — **the EXPLAIN checks**: grow a corpus, force `enable_seqscan = off`, or defer to
  WP-4.1?~~ · **Answered 2026-09-21: grow a corpus large enough that the planner chooses.**
- ~~2026-09-21 — **`POST /search`**: workspace ids from the body, or the caller's memberships?~~ ·
  **Answered 2026-09-21: default to every membership, `workspaceIds` narrows it.**
- 2026-09-21 — **the reranker**: wire the interface now as Detail's prose implies, or leave it
  entirely to milestone 2A and record that Detail's sentence describes 2A rather than this
  package? · **does not block; decide before the package closes**

## Answered before the first edit

- 2026-09-21 — **the fused score is normalised to 0–1 before the floor is applied**, by dividing by
  RRF's own maximum `2/(k+1)`. The configuration keeps the 0–1 shape it was written with, the floor
  means something in Phase 1 rather than rejecting every result, and when the reranker arrives in 2A
  the scale does not move — only what produces the score does.
- 2026-09-21 — **`T-2.3-03` and `T-2.3-11` are proved against a corpus grown for the purpose**,
  large enough that the planner chooses HNSW and GIN because they are cheaper. Forcing
  `enable_seqscan = off` would show the indexes exist and can be used, which is not what the task
  asks; deferring to WP-4.1 hands the check to a lane with no schedule.
- 2026-09-21 — **`POST /search` defaults to every workspace the caller belongs to**, with an
  optional `workspaceIds` to narrow. A person asking a question rarely knows which workspace holds
  the answer, and the permission predicate is inside the query either way.
- 2026-09-21 — **the query calls `immutable_unaccent`, not `unaccent`.** The generated column is
  built with the former, and a query that normalises its terms differently from the index is a query
  that silently stops matching. A deviation from design §6.1's literal SQL.
- 2026-09-21 — **RRF's k stays a constant, separate from `RETRIEVAL_CANDIDATE_LIMIT`.** They are both
  60 in §6.1's SQL and they are not the same number: coupling them would make changing how many
  candidates are fetched also change the ranking formula.
- 2026-09-21 — **the reranker is left to 2A.** No task in this package names it, and Detail's
  sentence describes what 2A will add rather than work this package owes.
- 2026-09-21 — **`T-2.3-07`'s "visible in the client's metrics" is read as "does not call the
  client".** There is no metric surface and no task creates one; a counting double proves the second
  identical question never reaches `InfinityClient`, which is the behaviour the task is about.

## Contradictions found while running

- 2026-09-21 — **`plainto_tsquery` ANDs every term, so the lexical branch is dead for a real
  question.** Design §6.1 fixes the parser, and a question put to the endpoint —
  *"Thời hạn thanh toán của hợp đồng là bao lâu?"* — compiles to
  `'thoi' & 'han' & 'thanh' & 'toan' & 'cua' & 'hop' & 'dong' & 'la' & 'bao' & 'lau'`, ten terms all
  of which a chunk must contain. **It matches 0 of 123 chunks.** The same corpus answers 44 to the
  keyword form `thanh toán`. Every score the endpoint returned is a multiple of `1/61`, which is the
  arithmetic signature of one branch contributing and the other returning nothing: hybrid search has
  degenerated to dense-only without failing, and nothing in the query or the tests says so.
  FR-10's own acceptance — *"a part number present in a document is still found when the question is
  worded entirely differently"* — is the case that needs the lexical branch, and `T-2.3-04` closes on
  it. The isolated branch tests pass because they feed keywords, which is the shape that works.

## Open questions

- 2026-09-21 — **what the lexical branch does with a natural-language question.** Keep §6.1's
  `plainto_tsquery` and accept that the branch fires only for keyword queries; switch the parser so
  the terms are OR-ed and let `ts_rank_cd` do the discriminating; or keep the parser and fall back to
  an OR form only when the AND form matches nothing? This changes the shape of a query design §6.1
  fixes and Detail says to keep exactly, so it is a design decision rather than a task
  decision. · **blocks `T-2.3-04`'s "Done when"; the rest of the package stands**

## What running it taught

- 2026-09-21 — **the endpoint worked and the scores gave it away.** Every relevance came back a
  multiple of `1/61`, which is one branch scoring and the other returning nothing. Nothing failed:
  the passages were sensible, the ranking plausible, the tests green. Hybrid search had degenerated
  to dense-only and the only thing that said so was the arithmetic. After OR-ing the terms the same
  question returns 0.96, 0.95, 0.93 — both branches contributing.
- 2026-09-21 — **the lexical branch's first control did not isolate it.** Feeding a zero vector to
  kill the dense branch still returned 60 candidates, because ordering by distance to a zero vector
  ranks everything. The control that works holds the embedding constant and varies only the text,
  and the fixture carries a decoy sitting on the question's own vector: the decoy wins the dense
  branch outright, so only the lexical branch can put the answer first.
- 2026-09-21 — **the query-plan check failed twice before it measured anything.** The first synthetic
  corpus repeated one sentence in every chunk, so every term matched every row and the planner
  sequentially scanned — correctly, because a GIN index is worth nothing against a predicate that
  selects everything. With a varied vocabulary the match fell to 6 %, and the plan then **flipped
  between `SEQ` and `INDEX` across three identical runs** at 10 000 rows: 4.8 ms against 3.5 ms is
  close enough for the planner to change its mind, and what moved it was the dead tuples the script
  leaves behind building and dropping a corpus in the same table. `VACUUM ANALYZE` rather than
  `ANALYZE`, and 30 000 rows, gave three runs the same answer.
- 2026-09-21 — the mutation check is not subtle once asserted and completely silent otherwise.
  Removing the three joins leaves the CTE declared and unused, which is valid SQL: the query runs,
  PostgreSQL says nothing, and an outsider with no membership anywhere receives candidates.
- 2026-09-21 — two of my own assertions were wrong rather than the code: `not.toMatch(/unaccent\(/)`
  matched `immutable_unaccent(` as a substring, and a floor of 0.4 does not separate a score that
  normalises to 0.4357.

## Interpretations

- 2026-09-21 — **the lexical branch ORs the question's terms.** Recorded separately above as a
  contradiction against design §6.1, and answered by decision. The lexemes come from the same
  `to_tsvector('simple', immutable_unaccent(…))` the index was built with, so the query cannot
  tokenise differently from the column it searches; `quote_literal` keeps punctuation from being
  read as tsquery syntax, and a sentinel keeps an empty question an empty result rather than a
  syntax error.
- 2026-09-21 — `permittedVersionIds` exists so the predicate can be asserted before any ranking
  runs. It composes the same fragment the hybrid query does rather than a second copy, so the two
  cannot drift.
- 2026-09-21 — the fused score is **not** returned by the endpoint; `relevance` is. A raw RRF score
  is an artefact of k and of how many branches matched, and a client that compared one against
  another release's would be comparing two different scales.

## Deviations

- 2026-09-21 — **`plainto_tsquery` is replaced** by an OR of the question's lexemes. Design §6.1
  fixes the parser and Detail says to keep the query's shape exactly; the shape is kept and the
  parser is not.
- 2026-09-21 — the final projection joins `permitted` a third time. §6.1's query selects only
  `chunk_id` and the fused score; `T-2.3-06` needs the file name, the span and the heading trail, so
  the passage is read back — and that read carries the predicate like the other two.
- 2026-09-21 — `apps/api/scripts/check-query-plans.mjs` is committed, as the D-5 script was.
  `T-2.3-11` asks for a plan review recorded in `docs/ops/`, and a record nobody can re-run against
  a corpus that no longer exists is a claim rather than a measurement.

---

## Gate · closed 2026-09-21

Reviewed and accepted: all eleven tasks. The proving command ran in both directions —
`permission-predicate.spec.ts` and the integration suite green, then the three
`JOIN permitted` lines removed and **4 of 13** compiled-SQL assertions and **13 of 27** integration
assertions red, then restored and green again. 780 unit tests at 100 % on every metric, 27
integration tests, `arch:chunks` and `depcruise` clean over 152 modules.

What the package kept teaching is that this kind of system fails without failing. The endpoint
answered while half of it was silent; the plan probe reported a scan that was noise; the first two
controls could not have changed their own answers. None of it surfaced as an error — it surfaced as
a number that was too round, a result that was too stable, and a corpus where everything matched.

**Not proved here:** no CI run number is recorded against this package's commits, as with WP-3.3 and
WP-3.4 — `gh` is not installed in this environment and every check was run locally. The G3 gate line
*"the search screen returns relevant passages"* is `T-3.6-11`'s. FR-12 and FR-13's reranking and
nDCG are milestone 2A's. The query plans are taken against synthetic chunks with random vectors, so
HNSW's recall on real embeddings is not measured — the question `T-2.3-03` asks is whether the
planner chooses the index, and it does. 30 000 rows is the threshold on this machine with this
vocabulary, not a general one.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — three rules, in force from the next package: a
thing that still answers can be answering with half of itself; a measurement that changes between
identical runs has not been made; to isolate one contributor, make the others prefer the wrong
answer. Three candidates were **not** promoted, because existing rules carry them: the synthetic
corpus where every row matched is "build the fixtures rather than borrowing whatever the database
happens to hold"; the mutation check is what WP-2.5's rules were written for; and two assertions
that were wrong rather than the code need no rule at all.

**Promoted to [Progress §3](../ei-ai-progress.md)** — `Q-22`, whether the reranker seam is owed now
or belongs entirely to milestone 2A.

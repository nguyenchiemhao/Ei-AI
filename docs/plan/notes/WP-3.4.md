# WP-3.4 · Markdown ingestion pipeline

Opened 2026-09-19. Authorities: [Detail §WP-3.4](../ei-ai-phase-1-detail.md) · [Tasks §5](../ei-ai-phase-1-tasks.md) · FR-04, FR-05 · [Design §5.4](../../design/ei-ai-agentic-knowledge-assistant.md) · [Progress §4.3](../ei-ai-progress.md).

The schema is already shaped for this package and needs no migration: `version_status` carries
`uploaded | parsing | parsed | chunking | embedding | indexed | failed | quarantined | superseded | purged`,
`document_versions` carries `status_reason`, `parser_version` and `chunker_version`, and `chunks`
carries `char_start`, `char_end`, `heading_path`, `token_count`, `embedding halfvec(1024)` and a
generated `text_search` tsvector, with `chunks_embedding_hnsw` and `chunks_text_search_gin` already
built by `007_indexes.sql`. Infinity is up on the backend network serving both `BAAI/bge-m3` and
`BAAI/bge-reranker-v2-m3`. `chunks` and `pages` are both empty.

## A discarded start, recovered in part

2026-09-19 — work on this package was begun and rolled back the same morning, with no commit and no
stash. What survives is residue: empty `apps/api/src/modules/ingestion/`, `corpus/md/` and `spike/`,
a `spike/__pycache__/build-corpus.cpython-314.pyc`, and a root-owned `apps/api/coverage/` written at
08:22. That coverage report holds a complete `modules/ingestion/token-counter.ts` at 100 % coverage —
`T-3.4-05` settled by measurement, the XLM-RoBERTa tokenizer chosen over a character ratio that
*"misses the mandated 200–400 band on 8.7 % of windows"*. The document it cites,
`docs/ops/d5-token-counting.md`, is gone; so is the dependency from `pnpm-lock.yaml` and the three
configuration variables from `env.schema.ts`. **The code is recovered from the report; the 8.7 %
is not evidence until a command produces it again.**

## Contradictions found on opening

- 2026-09-19 — **rule 1 of WP-2.5 forbids this package from writing a chunk.** [Detail §WP-2.5](../ei-ai-phase-1-detail.md)
  words it as *"only `modules/retrieval/hybrid-search.repository.ts` may **query** `chunks`"*, but the
  selector in [eslint.architecture.config.mjs](../../../apps/api/eslint.architecture.config.mjs)
  matches `insertInto`, `updateTable`, `deleteFrom` and `replaceInto` as well as `selectFrom`, plus
  `into chunks` and `update chunks` in raw SQL and in `sql` templates, and ignores exactly one path.
  The chunker at `T-3.4-07` and the embedding write at `T-3.4-10` are both writes to `chunks`, so the
  first row this package inserts turns CI stage 4 red. **The permitted path does not exist yet** —
  WP-2.3 is 0/11 — so today the rule permits nothing at all. What rule 1 defends is T-02, a leak
  through what a query *returns*; an insert returns no rows to leak.
- 2026-09-19 — **`T-3.4-11` closes on a screen that does not exist.** *"The documents list shows the
  state machine advancing without a page reload"* is the web app, and WP-3.6 is 0/12. The same shape
  as `T-3.3-01`'s search clause, which the WP-3.3 gate closed with a deferral naming `T-2.3-06`.
- 2026-09-19 — **`T-3.4-03` requires audit that nothing has built.** *"Every transition is written and
  audited"* — WP-2.4 is 0/8 and `audit.repository.ts` (`T-2.4-01`) does not exist. The same shape as
  `T-3.3-02`'s audit clause, closed with a deferral naming `T-2.4-05`.
- 2026-09-19 — **the seeded corpus has no bytes behind it.** `T-3.4-08` closes on *"every chunk of the
  seeded corpus, not a sample"*, and [seed.ts:112](../../../apps/api/src/database/seed.ts#L112) writes
  twenty versions with `storage_key = 'seed/sample-NN.md'`, `byte_size = 1024`, and a `sha256` that is
  `randomUUID()` with the dashes removed — 32 hex characters, not a digest. The `uploads` volume holds
  two objects, both from WP-3.3's own tests. Every seeded version fails at `StoragePort.read`. The
  seed's comment says documents stop at `uploaded` *"because a seed that pretended to index them would
  make the pipeline's own tests pass against fiction"* — the intent was right and the bytes were the
  half that was missed.
- 2026-09-19 — **`pages.extraction_method` admits the accurate label and the task forbids it.** The
  CHECK admits `'text_layer' | 'ocr' | 'markdown'`; `T-3.4-04` and Detail both specify `'text_layer'`
  for the Markdown pass-through. The schema offers `'markdown'`, which is what the row actually is.
- 2026-09-19 — **the worker cannot reach a tokenizer.** The counter `T-3.4-05` chooses needs
  XLM-RoBERTa's `tokenizer.json`. Egress is default-deny, so nothing downloads it at runtime. The
  `models` volume already holds it at
  `hub/models--BAAI--bge-m3/snapshots/5617a9f61b028005a4858fdac845db406aefb181/tokenizer.json`,
  put there by infinity — but `ingest-worker` mounts `uploads` and its own `node_modules` and `dist`,
  **not `models`**. No task names that mount.
- 2026-09-19 — **`T-3.4-09`'s "Done when" is a hands check.** *"A restart of the infinity container
  mid-run resumes without losing chunks"* is not something a command in this package demonstrates; it
  needs a person to restart a container while a run is in flight.
- 2026-09-19 — **Detail recommends the heavier of two tokenizers, and it depends on the lighter one.**
  Detail names `@huggingface/transformers` (WASM). At 4.3.0 that is 9.9 MB unpacked and pulls
  `onnxruntime-node`, `onnxruntime-web` and `sharp` — and it depends on `@huggingface/tokenizers` ^0.2.0,
  which is 361 KB with **no dependencies** and is the part that actually counts tokens. Both expose a
  CommonJS `require` entry, so neither is refused by the build: the question here is weight, not
  loadability, and "a library your build cannot load is not a candidate" does not decide it.
- 2026-09-19 — **two new dependencies arrive on a locked network.** `bullmq` (6.3.8, plain CommonJS)
  and the tokenizer. Per [CLAUDE.md](../../../CLAUDE.md) `## Packages` that is a `package.json` edit,
  an image rebuild, and dropping `api-app-node-modules` and `worker-app-node-modules` so they
  repopulate — best paid once, up front, rather than twice.
- 2026-09-19 — **WP-2.5's note and rule 1's configuration disagree about reach.** The note records the
  rule as running *"over `apps/api/src` less `database/`"*; the config's `files: ['src/**/*.ts']`
  excludes nothing but the single permitted path, so `database/seed.ts` is in scope. Nothing depends
  on it today — no file touches `chunks` — but the note describes a narrower rule than the one that runs.

## Open questions

- ~~2026-09-19 — **rule 1**: narrow it to reads, add the ingestion writer to the permitted list, or
  have ingestion write `chunks` through a file under `modules/retrieval/`?~~ · **Answered 2026-09-19:
  narrowed to reads.**
- ~~2026-09-19 — **`pages.extraction_method`**: `'text_layer'` as `T-3.4-04` says, or `'markdown'` as
  the schema offers?~~ · **Answered 2026-09-19: `'markdown'`.**
- ~~2026-09-19 — **the `models` mount**: a compose edit on `ingest-worker`, or vendor `tokenizer.json`
  into the image?~~ · **Answered 2026-09-19: `models:/models:ro` on `ingest-worker` alone.**

## Answered before the first edit

- 2026-09-19 — **rule 1 of WP-2.5 is narrowed to reads.** The selector keeps `selectFrom` and the
  `from chunks` / `join chunks` shapes and drops `insertInto`, `updateTable`, `deleteFrom`,
  `replaceInto`, `into chunks` and `update chunks`. What the rule defends is T-02, a leak through what
  a query *returns*; an insert returns no rows and cannot leak. The permitted reader stays exactly one
  file. **This owes a re-proof of `T-2.5-02`'s "Done when"**: an unpermitted *read* of `chunks` must
  still turn stage 4 red while the ingestion writer is accepted — the near-miss control WP-2.5's own
  gate promoted as a rule, since a prohibition that cannot tell its subject from a lookalike gets
  switched off the first time the lookalike is legitimate.
- 2026-09-19 — **the Markdown pass-through writes `extraction_method = 'markdown'`**, not
  `'text_layer'` as `T-3.4-04` and Detail say. A deviation, and the reason is milestone 2A: there
  `'text_layer'` will mean *a PDF that had a text layer*, and a Markdown row written with that value
  is indistinguishable from a parsed PDF the moment the parser lands — by which time these rows
  already exist. The schema admits `'markdown'` because that is what the row is.
- 2026-09-19 — **`ingest-worker` mounts `models:/models:ro`**, a compose edit no task names. The
  tokenizer is already in the volume, put there by infinity, so the counter matches the model actually
  being served and nothing is downloaded through an egress that denies by default. `api` does not get
  the mount: only the worker chunks.
- 2026-09-19 — **`T-3.4-11`'s "without a page reload" is deferred to `T-3.6-10`**, and the wave table
  is the evidence: `T-3.6-10` is *blocked by* `T-3.4-11`. A screen this package's own dependant builds
  cannot be this package's proof. The API exposes per-document ingestion status; the live table is
  WP-3.6's.
- 2026-09-19 — **`T-3.4-03`'s "audited" clause is deferred to `T-2.4-06`**, on the same evidence:
  `T-2.4-06`, *wire upload and every ingestion state change*, is blocked by `T-3.4-03`. The graph puts
  the audit wiring after the state machine, so the "Done when" contradicts the plan it belongs to
  rather than the plan being silent about it. `T-2.4-01` is not pulled forward.
- 2026-09-19 — **`InfinityClient` is an adapter, not a port.** [Detail §7](../ei-ai-phase-1-detail.md)'s
  tree names `adapters/embedding/infinity.client`, and [design §5.4](../../design/ei-ai-agentic-knowledge-assistant.md)
  fixes the seams at three — model-provider, vector-store, storage. Both `ingestion` and `retrieval`
  (`T-2.3-07`) will import it; rule 3 forbids cross-module **service** imports and an adapter does not
  live under `modules/`, so it does not fire.
- 2026-09-19 — **`@huggingface/tokenizers` 0.2.0, not `@huggingface/transformers`.** The earlier reading
  that the ESM-only shape refused `transformers` was wrong: at 4.3.0 it ships `dist/transformers.node.cjs`
  for `require` and loads fine. The objection that survives is weight — 9.9 MB pulling `onnxruntime-node`,
  `onnxruntime-web` and `sharp` into the image to count tokens, and depending on `@huggingface/tokenizers`
  ^0.2.0, which is 361 KB with no dependencies and is the part that counts.

- 2026-09-19 — **the corpus**: the seed writes real Markdown bytes through `StoragePort` with a real
  digest, so "the seeded corpus" of `T-3.4-08` means something and a clean install is ingestible. This
  touches `T-1.2-11`'s output and is recorded as a deviation.
- 2026-09-19 — **the corpus text is Vietnamese Markdown**, with diacritics, headings and tables. The
  promoted rule is that a boundary which mangles Vietnamese looks correct in ASCII, and the token
  band, the character offsets and the heading path are all boundaries where the two encodings
  disagree. This morning's discarded spike generated ASCII, which measures the one case where nothing
  can go wrong.
- 2026-09-19 — **D-5**: `token-counter.ts` is recovered from the coverage report, and the measurement
  behind it is run again and written to `docs/ops/d5-token-counting.md`. A number carried across a
  discard is a deferral with no target.

## Contradictions found while running

- 2026-09-19 — **the earlier reading of `@huggingface/transformers` was wrong.** It was recorded on
  opening as ESM-only and therefore refused by the CommonJS build. The registry says otherwise: 4.3.0
  declares `"type": "module"` but its `exports` map gives Node a `require` entry at
  `dist/transformers.node.cjs`. `@huggingface/tokenizers` 0.2.0 does the same. Both load; the reason
  to prefer the smaller one is weight, not loadability, and the note above is corrected rather than
  quietly dropped.
- 2026-09-21 — **Docker Desktop stopped, and with it the whole toolchain.** The host distro has no
  Node — `/usr/bin/docker` is a symlink into `/mnt/wsl/docker-desktop`, and every command in the
  development loop runs inside a container. This is exactly the condition [Progress §2.1](../ei-ai-progress.md)
  records against `E-4`. Nothing after `T-3.4-05`'s first file could be run or proved until it is back.

## Interpretations

- 2026-09-19 — the token count **includes the two special tokens** BGE-M3 prepends and appends. The
  budget a chunk has to fit inside is the model's, not the tokenizer's, so counting what the model
  will actually receive is the count that means something. Measured on the running infinity image:
  `"hello world"` is 5, `"hợp đồng mua bán hàng hóa"` is 8, and
  `"Điều 5. Giá trị hợp đồng và phương thức thanh toán"` is 13.
- 2026-09-19 — `resolveSnapshot` takes the **newest snapshot by modification time**, not the first
  one sorted. The recovered code sorted the directory names and took `entries[0]`; commit hashes
  carry no order, so a second revision pulled later would be shadowed by whichever hash sorts lower.
  Today there is exactly one snapshot and both readings agree, which is why the difference had to be
  found by reading rather than by failing.
- 2026-09-19 — the token counter's unit tests build a **three-word WordLevel tokenizer** in a
  temporary Hugging Face cache layout rather than depending on the `models` volume. Shipping
  XLM-RoBERTa's own 17 MB `tokenizer.json` to assert a number is a fixture nobody would read, and a
  test that needs a mounted volume is a test that does not run in CI stage 3.

## Deviations

- 2026-09-19 — **the corpus is built at `T-3.4-05`, not at `T-3.4-08`.** D-5 is decided by measuring
  the tokenizer against the ratio *on a corpus*, and the WP-4.1 proxy corpus does not exist (WP-4.1 is
  0/11). The corpus the plan places with the seed is therefore built first and wired into the seed at
  `T-3.4-08`. Order of work, not scope.
- 2026-09-19 — the corpus lives at `apps/api/src/database/corpus/` rather than the repository root.
  The seed runs from `dist/` inside a container that mounts `apps/api` and nothing else, so a corpus
  at the root would need a mount of its own to be visible. `nest-cli.json` copies it into `dist`
  the way it already copies the migrations.
- 2026-09-19 — `EMBEDDING_BATCH_SIZE`, `EMBEDDING_TIMEOUT_MS`, `EMBEDDING_MAX_ATTEMPTS`,
  `EMBEDDING_BACKOFF_MS`, `MODEL_CACHE_DIR`, `CHUNK_TOKEN_COUNTER`, `CHUNK_CHARS_PER_TOKEN`,
  `CHUNK_MIN_TOKENS`, `CHUNK_MAX_TOKENS`, `CHUNK_OVERLAP_RATIO`, `INGEST_MAX_ATTEMPTS` and
  `INGEST_BACKOFF_MS` are added to the environment schema. Each is named by a task; none is a value
  the database already enforces. `chunks_token_count_check` caps `token_count` at 1024, which is a
  ceiling above the band rather than the band itself.

## Open questions

- 2026-09-21 — the D-5 measurement, `T-3.4-06`'s band check and everything downstream are **waiting on
  Docker Desktop**. No code after `token-counter.spec.ts` should be written until the suite can run:
  what runs the tests is not what runs the code, and a package's worth of unverified TypeScript is
  the failure that rule describes. · **blocked, not deferred**

## T-3.4-05 · what running it taught

- 2026-09-21 — **the test fixture mangled Vietnamese, exactly as the rule warns.** The minimal
  tokenizer built for the unit tests used the `Whitespace` pre-tokenizer, whose pattern is `\w+`
  without the Unicode flag: it cut `chào` into `ch`, `à`, `o`, and every count came back two high.
  Three assertions failed and the diagnosis was visible only because the fixture was Vietnamese — in
  ASCII the two pre-tokenizers agree exactly. Fixed by using `WhitespaceSplit`, and a test now pins
  that a diacritic-bearing word counts as the one token it is.
- 2026-09-21 — **the ratio approximation did not fail, and the decision changed shape because of
  it.** 0 of 75 windows fell outside 200–400, including when the ratio was calibrated on the genre
  furthest from the mean and applied to all the others. Detail's fallback condition was *"if it
  proves slow"*, and the tokenizer is not slow: 611 ms once per worker process, then 4.0 ms per
  document. So the tokenizer is chosen for being **exact** (300–300 against the ratio's 279–373,
  spending 24 of the band's 33 % of headroom) and cheap — not for the alternative being broken.
- 2026-09-21 — **the 8.7 % from the discarded attempt is not reproduced.** This run finds 0 %. The
  earlier corpus is unknown so the two are not comparable, and `docs/ops/d5-token-counting.md`
  records it as unreproduced rather than as contradicted. This is what the rule about carrying a
  number across a discard is for.
- 2026-09-21 — the corpus `README.md` was being counted as a corpus document in the first run
  (51 files, not 50), which pulled a non-Vietnamese, non-representative file into the calibration.
  Caught by reading the output rather than by any assertion.

## Deviations

- 2026-09-21 — `apps/api/scripts/measure-token-counting.mjs` is committed. `T-3.4-05` requires the
  measurement be in `docs/ops/`, and a document whose method exists only as prose cannot be re-run
  when the corpus changes. It sits outside `src`, so neither `eslint src` nor `tsc` sees it.
- 2026-09-21 — `apps/api/src/database/corpus/*.md` is added to `.prettierignore`. `T-3.4-08` asserts
  that slicing the source by a chunk's character offsets reproduces its text exactly; a formatter
  with opinions about table alignment and line wrapping has no business inside that loop.

## T-3.4-09 · what running it taught

- 2026-09-21 — **the first restart probe passed without touching its subject.** It embedded 320 texts
  and then restarted infinity four seconds later — but the embed had already finished in 1 400 ms, so
  the run was green and had demonstrated nothing. Redone the only way that reaches the subject:
  restart infinity, then start the embed while it is still loading. That run took **15 256 ms** and
  returned 320/320 vectors, all 1024 wide. The warm run is the control.
- 2026-09-21 — the measured reload is about fourteen seconds, so `EMBEDDING_BACKOFF_MS` is raised
  from 500 to **2000**: five attempts backing off from two seconds span thirty, and a window shorter
  than a reload cannot survive one. The old default spanned 7.5 s and would have failed this test.
- 2026-09-21 — **the response is ordered by an `index` field, not by arrival.** infinity returns one
  per vector precisely because it does not promise request order, and a client that zipped the array
  positionally would attach the wrong embedding to a chunk — silently, since every vector is the
  right width. `vectorsInRequestOrder` sorts by it, and a test shuffles the response to prove it.
- 2026-09-21 — the 14 unit tests all drive a stubbed `fetch`, which proves nothing about the service.
  The built `dist/adapters/embedding/infinity.client.js` was therefore driven against the running
  infinity as well: 19 texts over three batches, 19 distinct 1024-wide vectors in 411 ms.
- 2026-09-21 — the uncovered branch the coverage report named was line 93, a rejection that is not an
  `Error`. It is reachable — `Promise.reject('socket hang up')` — and would have put `undefined` in
  the failure reason a job persists. Covered rather than deleted.

## Interpretations

- 2026-09-21 — `EMBEDDING_DIMENSIONS` is a **constant, not configuration**. `chunks.embedding` is
  `halfvec(1024)`; a configured width could only ever disagree with the column. The client refuses a
  vector of the wrong width rather than letting the insert fail later with less context.
- 2026-09-21 — the embedding client is an **adapter with no port**. [Detail §7](../ei-ai-phase-1-detail.md)'s
  tree names `adapters/embedding/infinity.client`, and design §5.4's three seams are model-provider,
  vector-store and storage. `EmbeddingModule` is `@Global` so ingestion and retrieval can both inject
  it without importing each other, which architecture rule 3 forbids.
- 2026-09-21 — a 400 is not retried; a 429, a 5xx and a transport failure are. Waiting does not
  improve a request we malformed ourselves, and retrying one would turn a bug into a delay.

## T-3.4-06 and T-3.4-07 · what running them taught

- 2026-09-21 — **the overlap was 24% of a wanted 15%, and the reason was a rounding habit.** Backing
  up over whole blocks stopped at the first boundary *past* the target rather than the one nearest
  it, and a block is coarse — a paragraph is often a fifth of a chunk on its own. Choosing the
  nearest boundary brought the measured stride overlap to 15.5%.
- 2026-09-21 — **`mergeShortTail` could never fire, and the corpus proved it.** A document's last
  chunk is routinely under the minimum, so it was written to fold back into its predecessor when the
  two fit — but the predecessor is always grown to the maximum, so the merged span always exceeded
  it. The unit test that should have shown the merge showed 8 tokens where 10 were wanted, and the
  corpus run had a minimum of 78 tokens: the path had never run. Replaced by `startOfFinal`, which
  extends the *final* chunk backwards instead. Corpus minimum moved from 78 to exactly 200.
- 2026-09-21 — **two branches the coverage report named turned out to be opposite cases.** The guard
  in `lastBlockThatFits` for "one block alone exceeds the maximum" recomputed precisely what
  `sizes[first]` already held and was dead; it was deleted. The guard in `startOfFinal` for "reaching
  back overshot the maximum" was *not* dead — I could not construct an input for it and restructured
  the walk to stop before the step rather than undo it afterwards, at which point the case covered
  itself. The first reading, that it was unreachable, was wrong.
- 2026-09-21 — the per-block token sums are an estimate and the real slice is counted before a chunk
  is emitted. Tokenisation is not additive across a join, and a test drives the chunker with a
  counter that charges for each join to prove the confirmation step matters.

## Interpretations

- 2026-09-21 — **a chunk is a contiguous slice of the source, never a reassembly.** That is what
  makes `char_start`/`char_end` resolve back exactly, and it makes FR-04's offset requirement
  structural rather than something a test has to police. The blank lines between blocks fall inside
  the slice, which is correct: they are part of the source.
- 2026-09-21 — `heading_path` is the trail joined with ` > `, taken from the block a chunk **starts**
  on. Neither the design nor the tasks prescribe a format. A chunk may run past a later heading; the
  trail names where it begins, which is what a reader needs to place the passage.
- 2026-09-21 — `chunker_version` is `v1-tokenizer`, or `v1-ratio@<chars per token>` when the
  approximation counts. The counter is part of the version because the same text cut with the two
  counters is not the same set of chunks.

## Tradeoffs

- 2026-09-21 — guaranteeing the minimum costs duplication at the end of a document. The final chunk
  reaches back until it clears 200 tokens, so its overlap with its predecessor averages 32.6% rather
  than 15%. The alternative was a corpus whose shortest chunk was 78 tokens — a fragment that still
  has to be embedded, indexed and ranked. Duplication is cheaper than a passage not worth retrieving.
- 2026-09-21 — the stride-overlap figure rests on 21 transitions, because most documents in this
  corpus produce only two chunks and their single transition is the final one. The number is
  reported with its n for that reason.

## T-3.4-08 · what running it taught

- 2026-09-21 — **a chunk that was a strict subset of the one before it.** Driving the corpus at a
  tighter band exposed it: backing up for overlap landed on a trailing heading, the next paragraph
  already filled the budget on its own, so the "next" chunk was `[379,398]` inside a predecessor of
  `[0,398]` — the same nineteen characters embedded, indexed and ranked twice. It does not occur at
  the configured 200–400 on this corpus, which is why only a stress configuration found it. `grow`
  now tracks what is covered and skips a chunk that adds nothing.
- 2026-09-21 — the first corpus assertion, that the last chunk ends at `source.length`, was wrong by
  exactly one character on all 50 files. A block ends with its last line, so a file's trailing
  newline belongs to no block. The assertion now says what actually matters: nothing but whitespace
  is left after the last chunk, and nothing but whitespace precedes the first.
- 2026-09-21 — **the seed writes real bytes through `StoragePort` now.** 50 versions, 50 distinct
  64-character digests where there were 32-character stripped UUIDs, byte sizes from 2 063 to 6 061
  where there was a hard-coded 1 024, every `current_version_id` set where none was, and every
  `storage_key` resolving to a file of exactly the recorded size.

## Contradictions found while running

- 2026-09-21 — **the seed aborts entirely when `SEED_ADMIN_PASSWORD` breaks the password policy.**
  On this machine `.env` carried an eight-character value against `PASSWORD_MIN_LENGTH=12`, and the
  whole seed failed — users, workspaces, documents, tools and all — for an optional convenience. The
  message, *"Password must be at least 12 characters"*, does not name the variable that caused it.
  Left as found: `PasswordService` is WP-3.1's and this is not WP-3.4's to change.

## Open questions

- 2026-09-21 — should the seed treat `SEED_ADMIN_PASSWORD` failing the policy as fatal to the whole
  seed, or as a warning that leaves the placeholder hash in place and seeds everything else? And
  should the error name the variable? · **for the gate; nothing in this package depends on it**

## T-3.4-01 to T-3.4-04 · what running them taught

- 2026-09-21 — **BullMQ refuses the shared Redis client.** `CacheModule`'s connection keeps ioredis'
  default `maxRetriesPerRequest`, and a BullMQ `Worker` throws on construction unless it is `null`:
  a worker blocks on commands for as long as it takes, and a retry limit would abort them. The queue
  gets its own connection rather than changing the one every other module uses.
- 2026-09-21 — **a retry could not re-enter the pipeline, and recorded the wrong cause.** The first
  attempt moved the row to `parsing` and then failed on a missing file; the second attempt was
  refused by the state machine itself — `cannot move from parsing to parsing` — and *that* sentence
  is what landed in `status_reason`. A person reading the row would have gone looking for a state
  machine bug instead of a missing file. Every state can now restart at `parsing`, including
  `parsing`. After the fix all three attempts fail on the ENOENT and the row records it.
- 2026-09-21 — the first failure probe used a version id that does not exist, so `setStatus` updated
  **no rows** and the check could not have failed. Redone against a real seeded version with its
  storage object removed, which is the failure this pipeline will actually meet.
- 2026-09-21 — restoring the bytes and re-enqueuing took the version from `failed` back to `parsed`
  with `status_reason` cleared, which also proves the reason does not outlive the failure.

## Interpretations

- 2026-09-21 — **the job id is the document version id.** A version enqueued twice produces one job,
  so a retried request or a redelivered upload cannot put the same bytes through the pipeline twice.
- 2026-09-21 — the consumer is **started by `worker.main.ts` and by nothing else**. Both processes
  boot the same module graph from the same image; what separates the producer from the consumer is
  that one call. The BullMQ worker also holds the event loop open, so `worker.main.ts`'s keep-alive
  interval — written when there was no consumer — is gone.
- 2026-09-21 — concurrency is **1**. A batch of embeddings already saturates the 4 GB VRAM budget,
  so a second concurrent document would contend for it rather than finish sooner.
- 2026-09-21 — `status_reason` keeps the **first line only**, capped at 500 characters. It is read
  by a person looking at a document that did not index, and a stack trace there helps nobody.
- 2026-09-21 — a restart is not a skip. The state machine still refuses every stage skip and every
  backward step; what it now permits is re-entering at `parsing` from anywhere, because each stage
  replaces the previous run's output rather than adding to it.
- 2026-09-21 — `pages.replaceAll` deletes before inserting. `pages_unique` would otherwise refuse a
  second run rather than let it correct the first.

## T-3.4-10 and T-3.4-11 · what running them taught

- 2026-09-21 — **the API died at boot over a directory it is never meant to have.** Wiring
  `IngestionModule` into `AppModule` made the API construct the token counter, whose constructor
  resolved the Hugging Face snapshot — and only `ingest-worker` mounts that cache. The comment in
  the recovered code said the tokenizer is built on first use "because the API process never
  chunks"; the *snapshot lookup* was not. Both are lazy now, and a test asserts the counter can be
  constructed without touching the cache at all.
- 2026-09-21 — **port 3000 on this host is held by another project.** `curl 127.0.0.1:3000/health`
  returned a create-react-app called "EERP - Engineering": `marlin-dev` publishes 3000, and this
  stack reaches the host on 4180 through the ingress. Everything since is driven from inside
  `ei-ai_backend` by the service's own name. `documents.integration.spec.ts` defaults
  `API_BASE_URL` to `http://127.0.0.1:3000`, which on this machine is a different application.
- 2026-09-21 — **the narrowed rule 1 was checked against its near miss before being trusted.**
  `chunks.repository.ts` writes and reads in the same file: with a `countWithoutEmbedding` that
  did a `selectFrom('chunks')`, stage 4 went red on that line while accepting the insert and the
  delete beside it. The read was then removed rather than exempted — completeness is structural,
  because `StoredChunk` requires an embedding and a chunk cannot be written without one.
- 2026-09-21 — **three files sat at 0 % coverage** after the queue landed: the consumer, the queue
  and the pipeline service. The overall number was 89.94 % and the gate is 80 %, so nothing would
  have failed. Reading the list rather than the number found that the pipeline's orchestration —
  the state order, the chunk-to-vector mapping, the skip for formats the parser owns — had no unit
  test at all and was proved only end to end, where the gate cannot see it.
- 2026-09-21 — twice, a test fixture was defeated by **default parameters swallowing an explicit
  `undefined`**: a job built with "no attempts configured" arrived with three, and a version meant
  to be absent arrived present. `downloads.service.spec.ts` already had the answer — `null` as the
  sentinel — which is what "look before you write" is for.

## Interpretations

- 2026-09-21 — **`GET /workspaces/{id}/documents` is scope no task names.** [Detail §8](../ei-ai-phase-1-detail.md)
  lists it as implemented in Phase 1 and no WP-3.3 task builds it, while `T-3.4-11` requires the
  ingestion state to be exposed per document. Built as the smallest thing that keeps the invariants:
  Reader and above, each document with its current version's status, reason, `chunker_version` and
  `indexed_at`.
- 2026-09-21 — the upload **queues after the transaction commits, and a queue failure does not fail
  the upload**. The bytes are stored and the row exists, so the document stays at `uploaded`, which
  is exactly what the status column is for. Losing a 201 to a Redis that is briefly down is worse.
- 2026-09-21 — the producer lives in `IngestQueueModule`, separate from `IngestionModule`. The
  upload path needs the producer and the consumer needs the workspaces repositories; without the
  split the two modules would import each other and `no-circular` would refuse it, correctly.

## Deviations

- 2026-09-21 — **WP-2.5 rule 1 is narrowed from "may query" to "may read"** in
  `eslint.architecture.config.mjs`, by the decision recorded above. `insertInto`, `updateTable`,
  `deleteFrom`, `replaceInto` and the `into`/`update` raw-SQL shapes are no longer matched.
- 2026-09-21 — `worker.main.ts`'s keep-alive interval is removed. It existed because Phase 1 had no
  consumer to hold the event loop open; a running BullMQ worker holds it.
- 2026-09-21 — `WorkspacesModule` now exports `DocumentsRepository` and `DocumentVersionsRepository`.
  Additive, with no change at any existing call site.

## Open questions

- 2026-09-21 — `documents.integration.spec.ts` defaults `API_BASE_URL` to `http://127.0.0.1:3000`,
  a port another project holds on this machine, and the stack publishes 4180. Should the default
  become the ingress port, or should the variable be required with no default? · **for the gate**

---

## Gate · closed 2026-09-21

Reviewed and accepted: all eleven tasks. The proving command ran end to end — 51 versions at
`indexed`, `SELECT count(*) FROM chunks WHERE embedding IS NULL` returning **0** over 123 chunks,
and every one of the 121 corpus chunks slicing its own text back out of the source file by its
offsets. A Vietnamese-named Markdown document uploaded through the API reached `indexed` unattended
and `GET /workspaces/{id}/documents` reported it.

What the package kept teaching is that a path nothing travels is a path nobody has checked.
`mergeShortTail` had never run; the retry had never re-entered; the snapshot lookup had never met a
container without the model cache. Each was written to be correct and each was wrong in a way no
unit test could see, because no test produced the input that reaches it. The corpus found two of
them and a deliberately broken job found the third.

**Not proved here:** no CI run number is recorded against this package's commits — every check was
run locally, and `gh` is not installed in this environment. The live-updating documents table of
`T-3.4-11` is deferred to `T-3.6-10`, which the wave table makes a dependant of `T-3.4-11`. The
audit clause of `T-3.4-03` is deferred to `T-2.4-06`, blocked by `T-3.4-03` for the same reason.
Non-Markdown formats are accepted, stored and left at `uploaded`: the parser attaches in milestone
2A, and `page_count` stays null until it does, so every chunk carries `page_from = page_to = 1`.
The D-5 measurement rests on a corpus composed from one prose pool, so its 0 % failure rate for the
ratio counter is a statement about this corpus and not a general safety claim.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — four rules, in force from the next package: a
retry must be able to re-enter the work it retried; what boots must not need what only one
entrypoint has; a guard that cannot fire is not a guard; a fixture that cannot express absence
tests the default instead. Three candidates were **not** promoted because existing rules already
carry them: the Vietnamese pre-tokenizer finding is "a boundary that mangles Vietnamese looks
correct in ASCII" met inside a test fixture; the host port answering for another project is "'up'
is not 'working'"; and the three files at 0 % beneath an overall 89.94 % is "coverage's worth is
the list, not the number". Each is recorded above as a reconfirmation rather than a new rule.

**Promoted to [Progress §3](../ei-ai-progress.md)** — `Q-19` the seed dying whole over an optional
convenience, `Q-20` the integration suite's default origin pointing at another project's port, and
`Q-21` whether `GET /workspaces/{id}/documents` earns its own id.

# WP-4.1 · Corpus, OCR spike, GPU benchmark

Opened 2026-09-23. Authorities: [Detail §WP-4.1](../ei-ai-phase-1-detail.md) · [Tasks §5](../ei-ai-phase-1-tasks.md) · [Progress §4.5](../ei-ai-progress.md) — the five numbers · R-01 · [Design §12](../../design/ei-ai-agentic-knowledge-assistant.md).

The only package in G4, and the only one that touches no product code. `apps/parser` already carries
what the OCR spike needs — docling 2.15.1 pinned with docling-core 2.14.0, and
`tesseract-ocr-vie`/`-eng` installed in its image. `infinity` serves both models. The GPU is an
NVIDIA GeForce RTX 3050 Ti Laptop with **4096 MiB**.

## Contradictions found on opening

- 2026-09-23 — **the VRAM number is already over its threshold, and Detail predicted it would not
  be.** With `infinity` healthy and both `BAAI/bge-m3` and `BAAI/bge-reranker-v2-m3` resident,
  `nvidia-smi --query-gpu=memory.used` reports **3740 MiB of 4096**. §4.5's row reads *"Over ~3.6 GB
  → reranker to int8 or CPU"*, and Detail's own risk table says *"The two models do not fit in 4 GB
  VRAM · **Low** · ~2.4 GB at fp16 leaves headroom"*. The reading is 3.65 GB — half again what was
  predicted, and 356 MiB from the card's limit. `T-4.1-08` is the task that measures this properly;
  what the opening shows is that the number decides something.
- 2026-09-23 — **`T-4.1-01`, `-02` and `-03` cannot be done by whoever runs this package from a
  terminal.** Twenty-eight of the eighty hours are collecting 30–50 **real scanned** Vietnamese legal
  PDFs with stamps, multi-column layout and mixed quality, 10–20 report documents with real tables,
  and **hand-transcribing ~20 reference pages**. A corpus generated here would have no skew, no JPEG
  artefacts, no stamp bleeding into text and no degraded diacritics — and its accuracy figure would
  be written into the row where R-01's decision goes.
- 2026-09-23 — **a reference transcription produced by reading the same file is not ground truth.**
  `T-4.1-03` exists so the OCR output has something independent to be wrong against. If the same
  process produces both sides, `T-4.1-06` measures agreement, not accuracy, and the 90 % threshold
  stops meaning anything.
- 2026-09-23 — **`eval/` does not exist.** Detail §7's tree and §54 both name `eval/golden-set/`
  (*"empty in Phase 1; the customer's 2h/week starts week 4"*) and `eval/runner/` (*"directory +
  README only"*) as created in Phase 1. Neither directory is on disk. WP-1.1 closed without them.
- 2026-09-23 — **`spike/` contains nothing but a stale artefact.** Its only content is
  `__pycache__/build-corpus.cpython-314.pyc` — compiled bytecode of a `build-corpus.py` that is not
  in the tree, under **Python 3.14** while `apps/parser` pins `==3.12.*`. `T-4.1-04`'s "Done when"
  is `python spike/ocr_bench.py --corpus …`, so this is the directory the harness lands in.
- 2026-09-23 — **the spike is "deliberately outside the product" and both its dependencies live
  inside it.** docling is pinned in `apps/parser/pyproject.toml` and the Tesseract language data is
  installed in `apps/parser/Dockerfile`. Either the harness runs in the parser image — and is not
  outside the product — or a second image repeats the same two pins, which is the thing
  *"Pin what your pin drags in"* exists to stop drifting.
- 2026-09-23 — **`T-4.1-11` must publish five numbers and this package produces three.** §4.5's
  numbers 4 (HMR latency) and 5 (empty-allowlist denial) belong to WP-1.1 and WP-2.2. Number 5 was
  demonstrated at the WP-2.2 gate; **number 4 appears nowhere** — not in a notes file, not in
  `docs/ops/`, not in Progress. `docs/ops/week-1-measurements.md` does not exist.
- 2026-09-23 — **the corpus location is named only as "outside git", and nothing says where.**
  `T-4.1-01`'s "Done when" is *"committed to a location outside git (with a manifest in git)"*.
  `.gitignore` has no entry for it and no path is written down anywhere.
- 2026-09-23 — **per-process VRAM is not readable on this host.**
  `nvidia-smi --query-compute-apps=pid,used_memory` returns `1, [N/A]` under WSL2. `T-4.1-08`'s own
  command — `--query-gpu=memory.used` — works, but it measures the card, not the process, so the
  174 MiB already in use before `infinity` started has to be subtracted by hand and stated.

## Open questions

- 2026-09-23 — **where does the proxy corpus come from?** It is 28 hours of human work and the number
  it feeds is the one that can change the plan. Options: you supply real scans and the ~20
  transcribed pages; I fetch public Vietnamese legal scans over an approved egress and you still
  transcribe the reference; or the OCR half is deferred by name and the package closes on the GPU
  numbers alone. · **blocks `T-4.1-01`, `-02`, `-03`, and through them `-05`, `-06`, `-07`**
- 2026-09-23 — **does the harness run in the parser image or its own?** Reusing `apps/parser`'s image
  gets docling and Tesseract at their existing pins and puts the spike inside the product; a second
  image keeps the separation Detail asks for and duplicates two pins. · **blocks `T-4.1-04`**
- 2026-09-23 — **where does the corpus live?** A path under the repository with a `.gitignore` entry,
  or somewhere else entirely with only the manifest committed. · **blocks `T-4.1-01`**
- 2026-09-23 — **who measures HMR latency?** §4.5 number 4 has no owner: WP-1.1 is closed and never
  recorded it, and no WP-4.1 task names it. Either this package measures it as scope no task
  describes, or `T-4.1-11` publishes four numbers and names what will fill the fifth. · **blocks
  `T-4.1-11`, not the package's start**

## Answered before the first edit

- 2026-09-23 — **the GPU half runs now, the corpus half waits.** `T-4.1-04`, `-08`, `-09`, `-10` and
  `-11` here; `-01`, `-02`, `-03` and through them `-05`, `-06`, `-07` wait on real scans and a
  hand-transcribed reference. The alternatives were fetching public Vietnamese legal scans over an
  approved egress — which still leaves the transcription to a person — and deferring the OCR half
  outright to week 8, which is the thing Detail sets in bold as not to be done.
- 2026-09-23 — **the harness runs in the `apps/parser` image.** It already pins docling 2.15.1 with
  docling-core 2.14.0 and installs `tesseract-ocr-vie`; a second image would repeat those two pins
  and drift from them. The cost is that the spike is not "outside the product" the way Detail words
  it — recorded as a deviation below.
- 2026-09-23 — **HMR latency is measured in this package**, as scope no task names, rather than
  published as a blank row.

## What running it taught

- 2026-09-23 — **`apps/parser` could not parse anything, and nothing had noticed.** The first
  conversion failed with `LocalEntryNotFoundError`: docling fetches its layout and table-structure
  models from the Hub on first use, and the parser runs on the default-deny network. The image had
  been built and never exercised. The models are now downloaded at build time, pinned to the
  revision docling 2.15.1 itself asks for. An image that installs a dependency is not an image that
  can run it.
- 2026-09-23 — **the VRAM number is 1.1 GB above what the plan estimated, and the plan called the
  risk low.** 3 715–3 790 MiB of 4 096 over three cycles against Detail's *"~2.4 GB at fp16 leaves
  headroom · **Low**"*. Three cycles rather than one because the first reading alone would not have
  shown that the spread is 75 MiB and the conclusion is stable.
- 2026-09-23 — **a health check is not both models.** infinity loads a model on its first request,
  so reading VRAM after `healthy` measures whichever model happened to be touched. The benchmark
  calls `/embeddings` and `/rerank` before reading.
- 2026-09-23 — **18 ms was too fast to trust without a control.** `spike/hmr_control.mjs` holds the
  page open for 8 seconds writing nothing and sees zero HMR messages, so the 16 updates the
  benchmark timed were caused by its 16 writes. Without it the number could have been the listener
  catching something the page says on its own.
- 2026-09-23 — **rerank is 59 % of NFR-03's budget before anything else runs.** 867 ms p50 and
  889 ms p95 for 60 candidates, against 1.5 s p95 for the whole of `search_documents`. Not one of
  the five numbers; measured because the models were loaded anyway, and the same trade as number 1
  seen from the other side.
- 2026-09-23 — **even a clean synthetic page loses Vietnamese diacritics.** `DỊCH` → `DICH`,
  `HĐDV` → `HDDV`, `trăm` → `tram` on a 200 dpi render with no skew and no noise. It is not an
  accuracy measurement and it is the reason one is worth making early.
- 2026-09-23 — **the spike container wrote root-owned files into the repository.** The same residue
  shape as `apps/api/coverage/`. The service now runs as the developer's uid.
- 2026-09-23 — **`correlationId` is a uuid column and I queued a label.** Fifty jobs failed, and so
  did the handler recording each failure — and the worker stayed up, which is WP-3.4's rule about a
  failure handler that can itself fail, working.
- 2026-09-23 — **a scanned Vietnamese legal PDF is scarcer than the plan assumed.** 324 documents
  were examined on Công báo Chính phủ and 34 were scans — about 10 %. The gazette now publishes
  typeset PDFs, and the ones that are scans are mostly `văn bản hợp nhất` and `công văn`. Detail
  asks for 30–50; 34 is inside the range and at the bottom of it, and the site had no more to give.
- 2026-09-23 — **the classifier had to be measured into existence.** A listing gives no hint which
  PDF is a scan, and the two look identical until downloaded. The separation is wide — 35–334
  characters a page against 1 400–2 600 — so the threshold at 400 sits far from both, and every
  file's measured value goes into the manifest rather than only its verdict.
- 2026-09-23 — **`T-4.1-02` found nothing.** Every document in the gazette's report-shaped
  categories was typeset. Reporting zero is the finding; inventing a report class from the legal
  scans would have put a number in `T-4.1-07` that describes nothing.
- 2026-09-23 — **OCR is 2.2× over NFR-04 and nobody had measured it.** 3.26 s a page on 12 cores
  against a budget of 1.5 s a page for the whole pipeline. Number 2's own note had said embedding
  was safe and that OCR was the thing to watch; it was right, and by more than a factor of two.
- 2026-09-23 — **the corpus can be asked about itself without a reference.** Uppercase letters carry
  a diacritic 8.7 % of the time and lowercase 16.8 %, in the same documents. Vietnamese gives no
  reason for that gap, so it is the OCR dropping marks — and it drops them in the capitals, which is
  where a legal document puts the issuing body and the document type. It is a failure mode, not an
  accuracy figure, and it is stated as one.
- 2026-09-23 — **my first upper-bound measurement was wrong, and only its control said so.** It
  compared Docling-with-OCR against the PDF's own text layer and scored 0.8935 word recall, which
  would have triggered R-01. The control — the same harness with OCR switched **off**, reading the
  text layer directly — scored 0.6149. OCR cannot beat reading the text, so the harness was measuring
  Docling's layout classification and Markdown export, not Tesseract. The number was never published.
  A measurement whose own no-op case scores worse than its subject has not measured its subject.
- 2026-09-23 — **isolating the reader reversed the answer.** With Docling out of both sides —
  pdfium's text layer against `tesseract -l vie+eng` on a 200 dpi render of the same page — the
  ceiling is **0.9702 characters, 0.9411 words, 0.9359 on words carrying diacritics** over 125 pages
  and 58 840 words. Above 0.90, so the upper bound does not trigger R-01. It leaves four points for
  everything a real scan adds, and the real-scan corpus already shows a larger loss than that.
- 2026-09-23 — **the control that makes the ceiling worth reading is the wrong-language run.** The
  same pages with `-l eng` score 0.0016 on diacritic-bearing words and 0.9753 on plain ASCII ones.
  The metric discriminates on exactly what it claims to measure; without that, 0.94 would have been
  a number with no demonstrated sensitivity.
- 2026-09-23 — **one reference PDF was defective and it cost a whole conclusion.** A gazette file
  carried its text twice, the second copy broken into glyph runs — `ph`, `ển`, `c` as separate
  tokens, 41.8 % of them one or two characters long against a healthy band of 14.7 – 23.0 %. A
  correct OCR reading scored 0.402 against it. The guard is in both harnesses, with the measured
  share reported per file rather than the verdict alone.

## Interpretations

- 2026-09-23 — **§4.5 number 1 is read as the card's occupancy**, not infinity's share. The two
  differ — 3.63–3.70 GB against 3.48–3.50 GB — and the decision the row drives is whether the models
  fit on this card. Both numbers are published so the reading can be disagreed with.
- 2026-09-23 — **the throughput corpus is the product's own chunks.** The fifty seeded Vietnamese
  Markdown documents were put through the real pipeline and the 128 chunks it produced were
  exported. Text cut up for the benchmark would quote a chunk size nobody uses.
- 2026-09-23 — **the smoke PDF is rendered as an image on purpose.** A PDF with a text layer is read
  straight out by docling and Tesseract never runs, so it would prove nothing about OCR.
- 2026-09-23 — **the corpus lives at `spike/corpus/`, gitignored, with `spike/corpus-manifest.json`
  committed.** `T-4.1-01` says "outside git with a manifest in git" and names no path; this is the
  smallest reading of it that a second person can reproduce from the manifest alone.
- 2026-09-23 — **the upper bound is an alarm, not a pass.** Written into the harness's own summary
  and onto the page it produces: below 0.90 means real scans are worse and R-01 triggers; at or
  above it, nothing follows. A one-way inference read as two-way would be the whole point lost.
- 2026-09-23 — **raggedness is the mechanical half of `T-4.1-07`.** A table whose rows disagree about
  their column count lost or merged cells; 11 of the 23 tables Docling recovered are ragged, one with
  columns running 6/8/9/10/11 across seven rows. Which of "merged" or "lost" applies needs the page
  beside the output, and that stays a hands row.

## Deviations

- 2026-09-23 — **the spike runs inside the product's parser image**, against Detail's *"deliberately
  outside the product"*. Nothing in `apps/api` or `apps/parser` imports `spike/`, so the direction
  that matters is preserved; what is shared is the image, and sharing it is what keeps docling
  pinned in one place.
- 2026-09-23 — **`apps/parser/Dockerfile` gained a model download step.** Outside this package's
  scope, and the alternative was a harness that cannot run and a parser image that cannot parse.
- 2026-09-23 — **HMR latency was measured although no task names it**, so `T-4.1-11` could publish a
  number rather than a blank.
- 2026-09-23 — **`T-4.1-02`'s separate report class was dropped by decision.** The gazette publishes
  its report-shaped categories typeset, and the corpus scope was narrowed to ordinary legal
  documents. `T-4.1-07` keeps a subject anyway: five of the 34 legal scans carry tables.

## Tradeoffs

- 2026-09-23 — **the throughput number is measured over infinity's HTTP API**, not against a locally
  loaded model. It therefore includes serialisation and a network hop on the internal bridge, and it
  is lower than the model's raw rate. That is the number the product will actually get.
- 2026-09-23 — **eight rounds for HMR, 120 for rerank, three for VRAM.** Each is as many as the
  spread justified: HMR's max is within 2× its min, rerank's p95 is 2 % above its p50, and VRAM's
  three cycles differ by 75 MiB. None needed more; the rerank number needed the most because it is
  the one closest to a budget.

## Open questions

- 2026-09-23 — **who owns the VRAM decision?** §4.5 says *"reranker to int8 or CPU"* and no task in
  any package does it. Reranking is wired and not enabled until 2A, so nothing is broken today.
  · **for the gate**
- 2026-09-23 — **does the HMR measurement earn a task id?** It was built as scope no task describes.
  It either grows `T-4.1-11` or becomes `T-4.1-12`. · **for the gate**
- 2026-09-23 — **`eval/golden-set/` and `eval/runner/` do not exist**, although Detail §7 and §54
  both say Phase 1 creates them. WP-1.1 closed without them, and scope moves between packages only
  through the task document, so this package did not create them. · **for the gate**
- 2026-09-23 — **OCR is 2.2× over NFR-04 for scanned documents.** 3.26 s a page on 12 cores against
  a budget of 1.5 s a page for the whole pipeline; a 400-page scan needs 22 minutes against a limit
  of 10. Parallelism across documents does not help, the parser holds no GPU by design, and no task
  in any package owns this. Does NFR-04 say what it means for scans, or does the engine change?
  · **for the gate**
- 2026-09-23 — **Docling's Markdown export differs from the raw text layer by far more than
  Tesseract's reading does.** Reading a typeset PDF with OCR off recovered 0.61 of the reference's
  words where OCR on a render of the same page recovered 0.94. Some of that gap is deliberate — page
  furniture classified away — and how much is the ingestion pipeline's business. Nothing in Phase 1
  measures what the product's own extraction keeps. · **for the gate**

## Gate · closed 2026-09-23

Ten of eleven tasks, 68/80 h. `T-4.1-03` — ~20 hand-transcribed reference pages — is the one left,
and with it `T-4.1-06`'s accuracy figure and the R-01 recommendation.

Four of the five numbers of §4.5 are published with their methods and their controls. The fifth is
stated as unmeasured, with an upper bound beside it and the reason the bound cannot stand in for it.

**Promoted to CLAUDE.md** — three rules:

- *A measurement whose no-op case scores worse than its subject has not measured its subject* — the
  control that killed the first ceiling before it was published.
- *A reference is only a reference if its own text layer is sound* — the gazette PDF against which a
  correct OCR reading scored 0.402.
- *An image that installs a dependency is not an image that can run it* — `apps/parser` could not
  parse anything, and nothing had noticed.

**Carried to Progress §3** — `Q-31` … `Q-35`.

**Not promoted.** *An upper bound is an alarm, not a pass* stays in this file: it is written into
both harnesses and onto the page they produce, which is where it does its work. The corpus location
and the scan/digital classifier are decisions about this package's subject, not about how to work.


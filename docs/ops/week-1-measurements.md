# Week 1 measurements

The five numbers of [Progress §4.5](../plan/ei-ai-progress.md) — the ones that can change the plan —
each with the command or method that produced it. Measured 2026-09-23 on the development machine:
WSL2, NVIDIA GeForce RTX 3050 Ti Laptop GPU with 4096 MiB, Docker Desktop, the repository on the
WSL2 filesystem rather than `/mnt/c`.

**Four of the five are here. The fifth — OCR accuracy — is not measured, and with it the R-01
recommendation is not made.** That is stated plainly in §3 rather than left as a blank row, because
it is the number the plan is most exposed to.

---

## 1 · VRAM with both models loaded — **3 715–3 790 MiB of 4 096**

`bash spike/vram_bench.sh`, three cycles. Each cycle stops `infinity`, reads the card, starts it,
waits for healthy, then **touches both endpoints** — infinity loads a model on its first request, so
a health check alone leaves the reranker unloaded and the reading is for one model, not two.

| cycle | baseline MiB | both models MiB | infinity's share MiB |
| --- | --- | --- | --- |
| 1 | 131 | 3 715 | 3 584 |
| 2 | 222 | 3 790 | 3 568 |
| 3 | 140 | 3 725 | 3 585 |

The baseline is subtracted by hand and printed because WSL2 answers
`nvidia-smi --query-compute-apps=pid,used_memory` with `[N/A]`: there is no per-process figure on
this host, and the card's total is the only honest reading.

**This trips the threshold.** §4.5's row reads *"Over ~3.6 GB → reranker to int8 or CPU"*. The card
carries **3.63–3.70 GB** with both models resident, leaving **306–381 MiB** free. The two models
themselves are 3.48–3.50 GB, just under the line; which of the two numbers the threshold means is
not written down, and the decision it drives — does this fit — is about the card.

Detail's risk table says *"The two models do not fit in 4 GB VRAM · **Low** · ~2.4 GB at fp16 leaves
headroom"*. The measurement is **1.1 GB above that estimate**, and the risk is not low.

The action §4.5 names — reranker at int8, or on CPU — is **not a task in WP-4.1**. It is reported
here and belongs to whoever owns the retrieval budget in 2A, where reranking is first enabled.

---

## 2 · Embedding throughput — **60.5 chunks/second at batch 8**

`docker compose --profile spike run --rm spike python /workspace/spike/gpu_bench.py --chunks …`

The corpus is the product's own chunks, not text cut up for the benchmark: the fifty seeded
Vietnamese Markdown documents were put through the real ingestion pipeline, and the 128 chunks it
produced were exported from the `chunks` table. **Tokens per chunk: min 13, median 333, max 392.**

Three rounds over the whole corpus: 2.10 s, 2.12 s, 2.12 s. Median 2.12 s for 128 chunks.

**What it means for NFR-04** — *"ingesting a 400-page document from `uploaded` to `indexed` within
≤10 minutes"*. At ~333 tokens a chunk, a 400-page document is roughly 1 000 chunks, so embedding
costs about **17 seconds**. NFR-04 is not at risk from embedding — and §3 now measures what is:
OCR spends 3.26 s a page, which is 22 minutes for the same document against a 10-minute limit.

---

## 3 · OCR accuracy on the proxy corpus — **still not measured**

**No accuracy figure, and therefore no R-01 recommendation.** What changed on 2026-09-23 is that the
corpus and the OCR run now exist; what is still missing is the hand-transcribed reference they have
to be scored against.

### The corpus — 34 files, 360 pages, 213 MB

`python spike/fetch_corpus.py --out spike/corpus --manifest spike/corpus-manifest.json`

From **Công báo Chính phủ** (`congbao.chinhphu.vn`). The files live outside git; `spike/corpus-manifest.json`
records each one's title, source page, PDF url, pages, bytes, sha256 and measured text density.

Scans are told from digitally typeset PDFs by measurement, not by eye: a scanned page is an image
whose text layer holds a header at most, a typeset page carries its whole body.

| | files | characters per page |
| --- | --- | --- |
| kept — scans | **34** | 35 – 334, median 89 |
| rejected — digital | **290** | 1 400 – 2 600 |

**324 documents examined, 34 of them scans — about 10 %.** The gazette now publishes most documents
typeset, so "a scanned Vietnamese legal PDF" is scarcer than the plan assumed. The gap between 334
and 1 400 is wide enough that the classification is not a judgement call, and each file's measured
value is in the manifest so it can be argued with.

**`T-4.1-02`'s separate report class was dropped by decision on 2026-09-23.** Every document in the
gazette's `báo cáo`, `thông báo`, `đề án` and `chương trình` categories was typeset, and the corpus
scope was narrowed to ordinary legal documents — which is what the 34 files are.

### The OCR run — 34 of 34 produced text, 0 failures

`docker compose --profile spike run --rm spike python /workspace/spike/ocr_bench.py --corpus … --manifest …`

360 pages in 1 174 s on 12 CPU cores — **3.26 seconds a page**. Output: 1 595 characters a page at
the median, 19.8 % of characters carrying Vietnamese diacritics, which is the density of real
Vietnamese rather than of noise.

**This is `T-4.1-05`'s "Done when": every file either produces text or a recorded reason.** All 34
produced text.

### What it says about NFR-04, which is not what number 2 said

NFR-04 gives a 400-page document from `uploaded` to `indexed` **≤10 minutes**, which is 1.5 s a page
for everything. OCR alone spends **3.26 s a page**, so a 400-page scan needs about **22 minutes** —
**2.2× over the limit**, before parsing, chunking or the 17 seconds of embedding number 2 measured.

Number 2's note said embedding does not threaten NFR-04 and that whatever does would be OCR. It is,
and by more than a factor of two. Parallelism across documents does not help: NFR-04 is about one
document. The parser holds no GPU by design (`apps/parser/Dockerfile`: *"CPU wheels only"*), so the
options are a faster engine, a GPU-served OCR, or an NFR that says what it means for scans.

### The failure mode, counted

Without a reference there is no accuracy figure, but the corpus can be asked about itself. Across
all 34 documents:

| | letters | of which carry a diacritic |
| --- | --- | --- |
| uppercase | 37 285 | 3 253 — **8.7 %** |
| lowercase | 453 443 | 76 322 — **16.8 %** |

Vietnamese gives no reason for that asymmetry: the same language is being written in both cases.
Uppercase carrying marks at half the rate of lowercase is the OCR dropping them, and a sample shows
it plainly — `ĐIỀU ƯỚC QUỐC TẾ` came out `DIEU UOC QUOC TE`, `BỘ NGOẠI GIAO` as `BO NGOAI GIAO`,
`CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM` as `CONG HOA XA HOI CHU NGHIA VIET NAM`, while the lowercase
body beneath them is very nearly right.

**That is the worst place for it.** A Vietnamese legal document puts the issuing body, the document
type and the national heading in capitals — exactly the fields a retrieval system matches on and a
reader cites.

### Tables, as far as a command can judge them — 23 tables, 11 of them broken

`spike/out/corpus/tables.csv`, from the OCR output of the corpus.

Five of the 34 legal scans carry tables; between them Docling recovered 23. Whether a table survived
is read from its own shape: a table whose rows disagree about how many columns they have is a table
whose cells were merged or lost.

| document | tables | ragged |
| --- | --- | --- |
| `legal-bc7e64a991a9` | 10 | 5 |
| `legal-89aa704482ed` | 3 | **3** |
| `legal-7e32f989fb7c` | 4 | 3 |
| `legal-345727e87813` | 3 | 0 |
| `legal-a32f313d8263` | 3 | 0 |
| **total** | **23** | **11** |

The worst is a 7-row table whose rows claim 6, 8, 9, 10 and 11 columns — no reading of that recovers
the original grid. The two documents with clean tables have simple three-column layouts.

**What a command cannot say** is whether a ragged table lost a cell or merged two, and whether a
clean-looking one is actually right. That needs the page beside the output, and it is the rest of
`T-4.1-07`.

### An upper bound on Tesseract, without a transcription

`docker compose --profile spike run --rm spike python /workspace/spike/tesseract_ceiling.py …`

`T-4.1-03` is still owed, and nothing here replaces it. What can be done without it is to take the
documents the gazette published **typeset** — whose text layer the publisher wrote, not a machine —
render each page to a 200 dpi greyscale image, and read it back with `tesseract -l vie+eng`. Both
sides are raw linear text: no layout model, no Markdown, no chunker.

**The inference runs one way.** A rendered page has no skew, no scanner noise and no stamp across a
line, so real scans can only be worse. Below 0.90 would mean R-01 triggers; at or above it, nothing
follows about real scans.

125 pages, 58 840 reference words, 13 documents:

| | value |
| --- | --- |
| character agreement | **0.9702** |
| word recall | **0.9411** |
| word recall, words carrying diacritics | **0.9359** |
| word recall, plain ASCII words | 0.9706 |

**The alarm does not fire — and the headroom is 4 points.** The ceiling is 0.94 and the line is
0.90, so everything real scans add — skew, noise, stamps, photocopy generation loss — has four
points to spend. The corpus of real scans already shows uppercase losing half its diacritics (above),
which is not four points.

Diacritics cost about 3.5 points on their own: 0.9359 against 0.9706 for plain ASCII words, on the
same pages.

**Control.** `spike/ceiling_control.py` reads the same pages with `-l eng`, dropping the Vietnamese
model. Diacritic-bearing words collapse from **0.9366 to 0.0016** while plain ASCII words stay at
0.9753. The measurement discriminates on exactly the thing it claims to measure.

**A first attempt at this was discarded, and its control is what discarded it.** It compared
Docling-with-OCR against the PDF's text layer and scored 0.8935, which would have triggered R-01.
Switching OCR off entirely then scored **lower** — 0.6149 — and OCR cannot beat reading the text
directly, so the harness was measuring Docling's layout classification and Markdown export rather
than Tesseract. The number was never published. `spike/ocr_ceiling.py` keeps that attempt with the
reasoning on it; `spike/tesseract_ceiling.py` is the one that isolates the reader.

That gap is worth its own look, later and by someone else: Docling's Markdown export differs from the
raw text layer by far more than Tesseract's reading does. Some of it is deliberate — page furniture
and headers are classified away — and how much is the ingestion pipeline's business, not this
package's.

### What is still missing

`T-4.1-03`: **~20 hand-transcribed reference pages**, spread across the real scans. The transcription
has to come from a person reading the page. Everything above is measured on *typeset pages rendered
clean*; not one number in this section describes a real scan, and the corpus of real scans is
exactly what R-01 is about.

**The risk this leaves open.** Detail says the R-01 decision *"belongs to week 3, not week 12"*. The
fallback is commercial OCR at roughly $1.50 per 1 000 pages, or a narrower v1 format list stated
plainly to the customer — and deciding late makes the second much more expensive, because by then
the format list has been built to.

Covered by: `T-4.1-03`, then `T-4.1-06` and `T-4.1-07` in this package; `Q-01`'s ~200 real customer
documents in week 8.

---

## 4 · HMR latency — **median 18 ms, p95 33 ms** over 8 rounds

`docker compose --profile e2e run --rm -v "$PWD/spike":/workspace/apps/web/spike e2e node
/workspace/apps/web/spike/hmr_bench.mjs`

The clock starts at the write into the bind mount and stops when the **browser** reports the module
applied, which is the whole path a developer waits on. Each round appends a comment to
`apps/web/src/screens/search.tsx`, waits for the update, restores the file, and waits again; the
script verifies by SHA-256 that the file it restored is byte-identical to the one it found.

min 16 ms · median 18 ms · p95 33 ms · max 33 ms.

**Control:** `spike/hmr_control.mjs` holds the page open for 8 seconds writing nothing and observes
**0** HMR messages, so the 16 updates the benchmark timed were caused by its 16 writes rather than
by something the page says on its own.

§4.5's threshold is *"Over 3 seconds → the source is on the wrong filesystem"*. At 18 ms it is on
the right one — the repository is on the WSL2 filesystem, where inotify works, rather than on a
`/mnt/c` bind mount, where it does not and `usePolling: false` would watch nothing.

---

## 5 · Empty-allowlist denial — **confirmed**

`bash infra/scripts/verify-egress.sh`

```
egress verification
  ok    api has no default route                   0
  ok    internal DNS resolves                      2
  ok    direct egress with proxy env removed       BLOCKED
  ok    proxied http refused by squid              403
  ok    proxied https denied at CONNECT            DENIED
egress boundary holds
```

Demonstrated first at the WP-2.2 gate and re-run here so this document records a measurement rather
than a citation. §4.5's note — *"If it does not deny, Phase 1 does not close"* — holds.

---

## R-01 recommendation

**Not made.** It depends on number 3's accuracy figure, and that needs the hand-transcribed
reference of `T-4.1-03`. The corpus exists and the OCR has run over all of it; what is missing is
the only thing that can say whether the output is right.

Two things are now measured, and they point in different directions:

- **Tesseract's ceiling on clean Vietnamese is 0.94 word recall, 0.936 on words carrying
  diacritics.** Above the 0.90 line, so the upper bound does **not** trigger R-01 — and it leaves
  only four points for everything a real scan adds.
- **On the real scans, uppercase carries diacritics at half the rate of lowercase** — 8.7 % against
  16.8 % in the same documents. That is far more than four points of loss, in the fields a legal
  document puts in capitals.

The two together say the likely answer is below 0.90 and the measurement that would settle it is the
one still missing. Guessing between them is exactly what `T-4.1-03` exists to stop.

---

## What else the measuring turned up

- **`apps/parser` could not parse anything as built.** docling fetches its layout and
  table-structure models from the Hub on first use, and the parser runs on the default-deny network,
  so the first conversion failed with `LocalEntryNotFoundError`. The models are now downloaded at
  image build time, pinned to the revision docling 2.15.1 itself requests. This was latent: nothing
  had run a conversion in that image before.
- **Rerank costs 867 ms p50 / 889 ms p95 for 60 candidates** (120 runs, same command as number 2).
  It is not one of the five numbers and it is measured here because the models were loaded anyway.
  NFR-03 gives `search_documents` **1.5 s p95** in total, so reranking alone would spend **59 %** of
  that budget before the database is touched or the question is embedded. Phase 1 has reranking
  wired and not enabled (§7.1), so nothing is broken today; 2A is where this has to be decided,
  alongside number 1's int8 question, which is the same trade seen from the other side.

# Seed corpus — Vietnamese Markdown

Fifty Markdown documents in six genres: contracts, meeting minutes, internal procedures,
financial reports, technical documentation and user guides. `T-1.2-11`'s seed loads them through
`StoragePort`, so a clean install has a document set the ingestion pipeline can actually run on.

**Why Vietnamese.** A boundary that mangles Vietnamese looks correct in ASCII, and this pipeline is
made of such boundaries: the tokenizer's count, the chunker's character offsets, and
`immutable_unaccent` in the full-text index all behave differently once a character stops being one
byte. A corpus of ASCII placeholders measures the one case where nothing can go wrong.

**Where the text comes from.** It is composed, not collected: a pool of Vietnamese paragraphs
written for this repository, assembled into documents with headings nested three deep, tables,
ordered and unordered lists. There is no customer data here and there must never be — the
repository is public, and the real corpus of [Progress §3.1](../../../../../docs/plan/ei-ai-progress.md)
has no home in this tree.

**What it is not.** Not the WP-4.1 proxy corpus. That one is scanned PDFs collected to measure OCR
accuracy, it is not committed, and `T-4.1-01` owns it. This corpus exercises the Markdown path only.

Sizes run from roughly 1 500 to 4 600 characters, which at BGE-M3's tokenizer is a few hundred to
about thirteen hundred tokens — several chunks per document at the 200–400 band, which is what
`T-3.4-06` and `T-3.4-08` need in order to mean anything.

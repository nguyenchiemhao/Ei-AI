"""OCR spike harness for WP-4.1 — Docling with Tesseract (Vietnamese + English).

Deliberately outside the product: nothing here is imported by `apps/api` or `apps/parser`, and the
numbers it produces go into `docs/ops/week-1-measurements.md`, not into a database. It runs inside
the parser image, which already pins docling 2.15.1 and installs `tesseract-ocr-vie`; a second image
would repeat those pins and they would drift.

    docker compose --profile spike run --rm spike \\
        python /workspace/spike/ocr_bench.py --corpus /workspace/spike/fixtures --out /workspace/spike/out

What this produces is per-page text and a summary row per file. What it does **not** produce is an
accuracy figure: that needs the hand-transcribed reference of T-4.1-03, and it is T-4.1-06's job.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

SUFFIXES = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}
UNCLASSIFIED = "unclassified"


@dataclass
class Result:
    """One row of the summary. Every file gets one, including the ones that failed."""

    file: str
    document_class: str
    status: str
    pages: int
    characters: int
    seconds: float
    reason: str


def converter() -> DocumentConverter:
    # `force_full_page_ocr` because the corpus is scans: without it docling trusts whatever text
    # layer a PDF happens to carry, and a file with a bad embedded layer would be scored as OCR
    # output when no OCR ran. Both languages, in the order Tesseract should try them.
    options = PdfPipelineOptions(
        do_ocr=True,
        do_table_structure=True,
        ocr_options=TesseractCliOcrOptions(lang=["vie", "eng"], force_full_page_ocr=True),
    )
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
    )


# T-4.1-01 and T-4.1-02 write the manifest; until they do, every file is `unclassified` and the
# per-class table T-4.1-06 needs cannot be built. Saying so is better than inventing a class.
def classes_from(manifest: Path | None) -> dict[str, str]:
    if manifest is None or not manifest.exists():
        return {}
    rows = json.loads(manifest.read_text(encoding="utf-8"))
    return {row["file"]: row.get("class", UNCLASSIFIED) for row in rows}


def corpus_files(corpus: Path) -> list[Path]:
    return sorted(p for p in corpus.rglob("*") if p.suffix.lower() in SUFFIXES and p.is_file())


def write_pages(document, destination: Path) -> tuple[int, int]:
    destination.mkdir(parents=True, exist_ok=True)
    text = document.export_to_markdown()
    (destination / "full.md").write_text(text, encoding="utf-8")
    pages = getattr(document, "pages", {}) or {}
    for number in sorted(pages):
        page_text = "\n".join(
            item.text
            for item, _ in document.iterate_items()
            if getattr(item, "prov", None)
            and item.prov
            and item.prov[0].page_no == number
            and getattr(item, "text", None)
        )
        (destination / f"page-{number:03d}.txt").write_text(page_text, encoding="utf-8")
    return max(len(pages), 1), len(text)


def run_one(convert, path: Path, corpus: Path, out: Path, document_class: str) -> Result:
    started = time.perf_counter()
    try:
        result = convert.convert(path)
        pages, characters = write_pages(result.document, out / path.relative_to(corpus).with_suffix(""))
        status = "ok" if characters > 0 else "empty"
        reason = "" if characters > 0 else "converted, but produced no text"
    except Exception as error:  # noqa: BLE001 — every failure is a row, never a stopped run
        pages, characters, status = 0, 0, "failed"
        reason = f"{type(error).__name__}: {error}"[:300]
    return Result(
        file=str(path.relative_to(corpus)),
        document_class=document_class,
        status=status,
        pages=pages,
        characters=characters,
        seconds=round(time.perf_counter() - started, 2),
        reason=reason,
    )


def summarise(results: list[Result], out: Path) -> None:
    with (out / "summary.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(asdict(results[0])) if results else ["file"])
        writer.writeheader()
        for result in results:
            writer.writerow(asdict(result))

    counts: dict[str, int] = {}
    for result in results:
        counts[result.status] = counts.get(result.status, 0) + 1
    print(f"\n{len(results)} files: " + ", ".join(f"{n} {s}" for s, n in sorted(counts.items())))
    print(f"{sum(r.pages for r in results)} pages, {sum(r.seconds for r in results):.1f}s total")
    for result in results:
        if result.status != "ok":
            print(f"  {result.status:7} {result.file} — {result.reason}")
    print(f"\nper-page output and summary.csv in {out}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Docling + Tesseract over a corpus of scans")
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=None, help="JSON list of {file, class}")
    arguments = parser.parse_args(argv)

    files = corpus_files(arguments.corpus)
    if not files:
        print(f"no PDFs or images under {arguments.corpus}", file=sys.stderr)
        return 1

    classes = classes_from(arguments.manifest)
    arguments.out.mkdir(parents=True, exist_ok=True)
    convert = converter()

    results = []
    for index, path in enumerate(files, start=1):
        name = str(path.relative_to(arguments.corpus))
        print(f"[{index}/{len(files)}] {name}", flush=True)
        results.append(
            run_one(convert, path, arguments.corpus, arguments.out, classes.get(name, UNCLASSIFIED))
        )

    summarise(results, arguments.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

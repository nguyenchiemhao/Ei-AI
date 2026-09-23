"""An upper bound on OCR quality for Vietnamese, without a hand-transcribed reference.

`T-4.1-03` asks for ~20 pages transcribed by a person, and nothing here replaces that. What this
does instead is take the documents the gazette published **typeset** — whose text layer is the
publisher's own, not any machine's reading — render each page to an image, and read that image back
with the same Docling and Tesseract the product would use.

**The inference runs one way only.** A rendered page has no skew, no scanner noise, no stamp bleeding
into a line and no photocopy generation loss. So:

    measured here < 90 %  ⟹  real scans are worse  ⟹  R-01 triggers
    measured here ≥ 90 %  ⟹  nothing follows about real scans

It can fire the alarm; it cannot clear it. Written on the page it produces, so nobody reads the
second case as a pass.

    docker compose --profile spike run --rm spike \\
        python /workspace/spike/ocr_ceiling.py --reference /workspace/spike/reference \\
            --out /workspace/spike/out/ceiling
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path

import pypdfium2 as pdfium

from ocr_bench import converter

RENDER_SCALE = 200 / 72  # 200 dpi, the resolution an office scanner is usually set to
MARKDOWN = re.compile(r"[#*_`>|\-]+")

# A reference is only a reference if its own text layer is sound. One gazette PDF carried its text
# twice, the second copy broken into glyph runs — `ph`, `ển`, `c` as separate tokens — which made a
# good OCR reading score 0.402 against it. Across thirteen documents the healthy band was 14.7 % to
# 23.0 % of tokens one or two characters long and the broken one was 41.8 %, so the line sits well
# clear of both. A reference that fails this is reported and left out, never scored.
MAX_SHORT_TOKEN_SHARE = 0.30


@dataclass
class Score:
    file: str
    pages: int
    usable_reference: bool
    short_token_share: float
    reference_chars: int
    ocr_chars: int
    char_agreement: float
    word_recall: float
    diacritic_word_recall: float
    plain_word_recall: float


def normalise(text: str) -> str:
    """Strip what Markdown adds and what layout decides, keeping letters and case."""
    return re.sub(r"\s+", " ", MARKDOWN.sub(" ", text)).strip()


def words(text: str) -> Counter[str]:
    return Counter(w for w in re.findall(r"\w+", normalise(text), re.UNICODE) if w)


def has_diacritic(word: str) -> bool:
    """A Vietnamese word whose letters carry marks — the ones OCR is being asked about."""
    return any(unicodedata.combining(c) for c in unicodedata.normalize("NFD", word))


# Recall of a multiset, not an ordered diff: reading order differs between a text layer and a
# reconstructed page, and penalising that would report a layout difference as a reading error.
def recall(reference: Counter[str], produced: Counter[str]) -> float:
    total = sum(reference.values())
    if total == 0:
        return 1.0
    return sum((reference & produced).values()) / total


def reference_text(path: Path) -> tuple[str, int]:
    document = pdfium.PdfDocument(str(path))
    pages = [document[i].get_textpage().get_text_bounded() for i in range(len(document))]
    return "\n".join(pages), len(pages)


# Rendered back into a PDF rather than handed over as images, so the path through Docling is the
# same one the corpus took — a different input format would exercise a different pipeline.
def render_as_scan(path: Path, destination: Path) -> Path:
    document = pdfium.PdfDocument(str(path))
    images = [document[i].render(scale=RENDER_SCALE).to_pil().convert("L") for i in range(len(document))]
    destination.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(destination, "PDF", save_all=True, append_images=images[1:], resolution=200.0)
    return destination


def short_token_share(counted: Counter[str]) -> float:
    total = sum(counted.values())
    return sum(n for t, n in counted.items() if len(t) <= 2) / total if total else 1.0


def score_one(convert, path: Path, work: Path) -> Score:
    reference, pages = reference_text(path)
    reference_words = words(reference)
    share = short_token_share(reference_words)
    if share > MAX_SHORT_TOKEN_SHARE:
        return Score(path.name, pages, False, round(share, 4), len(normalise(reference)), 0, 0, 0, 0, 0)

    rendered = render_as_scan(path, work / f"{path.stem}-rendered.pdf")
    produced = convert.convert(rendered).document.export_to_markdown()
    produced_words = words(produced)
    diacritic = Counter({w: n for w, n in reference_words.items() if has_diacritic(w)})
    plain = Counter({w: n for w, n in reference_words.items() if not has_diacritic(w)})

    return Score(
        file=path.name,
        pages=pages,
        usable_reference=True,
        short_token_share=round(share, 4),
        reference_chars=len(normalise(reference)),
        ocr_chars=len(normalise(produced)),
        char_agreement=round(
            SequenceMatcher(None, normalise(reference), normalise(produced), autojunk=False).ratio(), 4
        ),
        word_recall=round(recall(reference_words, produced_words), 4),
        diacritic_word_recall=round(recall(diacritic, produced_words), 4),
        plain_word_recall=round(recall(plain, produced_words), 4),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    arguments = parser.parse_args()

    files = sorted(arguments.reference.glob("*.pdf"))
    if not files:
        print(f"no PDFs under {arguments.reference}")
        return 1
    arguments.out.mkdir(parents=True, exist_ok=True)
    convert = converter()

    scores = []
    for index, path in enumerate(files, start=1):
        print(f"[{index}/{len(files)}] {path.name}", flush=True)
        scores.append(score_one(convert, path, arguments.out))
        last = scores[-1]
        if not last.usable_reference:
            print(f"    unusable reference — {last.short_token_share:.1%} of its tokens are 1-2 chars")
            continue
        print(
            f"    chars {last.char_agreement:.3f}  words {last.word_recall:.3f}  "
            f"with-marks {last.diacritic_word_recall:.3f}  plain {last.plain_word_recall:.3f}"
        )

    usable = [s for s in scores if s.usable_reference]
    weights = [s.pages for s in usable]
    total = sum(weights)

    def weighted(field: str) -> float:
        return round(sum(getattr(s, field) * w for s, w in zip(usable, weights)) / total, 4)

    summary = {
        "files_scored": len(usable),
        "files_rejected": len(scores) - len(usable),
        "pages": total,
        "char_agreement": weighted("char_agreement"),
        "word_recall": weighted("word_recall"),
        "diacritic_word_recall": weighted("diacritic_word_recall"),
        "plain_word_recall": weighted("plain_word_recall"),
        "note": (
            "Upper bound on clean renders of typeset pages. Real scans are worse. "
            "Below 0.90 triggers R-01; at or above it, nothing follows about real scans."
        ),
    }
    (arguments.out / "ceiling.json").write_text(
        json.dumps({"summary": summary, "per_file": [asdict(s) for s in scores]}, indent=2),
        encoding="utf-8",
    )
    print("\n" + json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

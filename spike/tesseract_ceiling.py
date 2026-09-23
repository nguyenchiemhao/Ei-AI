"""An upper bound on what Tesseract can read of Vietnamese — with nothing else in the way.

The first attempt at this compared Docling-with-OCR against the PDF's own text layer, and its
control killed it: with OCR switched off entirely, the same harness scored **lower** (word recall
0.61) than the OCR path did (0.89). OCR cannot beat reading the text directly, so the harness was
measuring Docling's layout and Markdown export, not Tesseract. That number was never published.

So this puts the same glyphs through two readers and nothing else:

* **reference** — the page's text layer, as the publisher typeset it, read by pdfium
* **subject** — the same page rendered to a 200 dpi greyscale image and read by `tesseract -l vie+eng`

Both sides come out as raw linear text. No layout model, no Markdown, no chunker.

**The inference still runs one way only.** A rendered page has no skew, no scanner noise, no stamp
across a line. Below 90 % here means real scans are worse and R-01 triggers; at or above it, nothing
follows about real scans.

    docker compose --profile spike run --rm spike \\
        python /workspace/spike/tesseract_ceiling.py --reference /workspace/spike/reference \\
            --out /workspace/spike/out/tesseract
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
import unicodedata
from collections import Counter
from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path

import pypdfium2 as pdfium

RENDER_SCALE = 200 / 72

# Overridable so ceiling_control.py can read the same pages without the Vietnamese model.
LANGUAGES = os.environ.get("TESSERACT_LANGS", "vie+eng")

# Carried over from the first attempt, where one gazette PDF held its text twice with the second
# copy broken into glyph runs — 41.8 % of its tokens one or two characters long against a healthy
# band of 14.7 % to 23.0 %.
MAX_SHORT_TOKEN_SHARE = 0.30


@dataclass
class PageScore:
    file: str
    page: int
    usable_reference: bool
    reference_words: int
    char_agreement: float
    word_recall: float
    diacritic_word_recall: float
    plain_word_recall: float


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def words(text: str) -> Counter[str]:
    return Counter(re.findall(r"\w+", normalise(text), re.UNICODE))


def has_diacritic(word: str) -> bool:
    return any(unicodedata.combining(c) for c in unicodedata.normalize("NFD", word))


def recall(reference: Counter[str], produced: Counter[str]) -> float:
    total = sum(reference.values())
    return sum((reference & produced).values()) / total if total else 1.0


def short_token_share(counted: Counter[str]) -> float:
    total = sum(counted.values())
    return sum(n for t, n in counted.items() if len(t) <= 2) / total if total else 1.0


def tesseract(image_path: Path) -> str:
    result = subprocess.run(
        ["tesseract", str(image_path), "stdout", "-l", LANGUAGES, "--psm", "3"],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout


# Page by page rather than document by document: a whole-document comparison lets a difference in
# page order look like a reading error, and the question is about reading.
def score_page(document: pdfium.PdfDocument, name: str, index: int, work: Path) -> PageScore:
    page = document[index]
    reference = page.get_textpage().get_text_bounded()
    reference_words = words(reference)
    if sum(reference_words.values()) < 50:
        return PageScore(name, index + 1, False, sum(reference_words.values()), 0, 0, 0, 0)
    if short_token_share(reference_words) > MAX_SHORT_TOKEN_SHARE:
        return PageScore(name, index + 1, False, sum(reference_words.values()), 0, 0, 0, 0)

    image_path = work / f"{name}-{index + 1:03d}.png"
    page.render(scale=RENDER_SCALE).to_pil().convert("L").save(image_path)
    produced = tesseract(image_path)
    image_path.unlink()
    produced_words = words(produced)

    diacritic = Counter({w: n for w, n in reference_words.items() if has_diacritic(w)})
    plain = Counter({w: n for w, n in reference_words.items() if not has_diacritic(w)})
    return PageScore(
        file=name,
        page=index + 1,
        usable_reference=True,
        reference_words=sum(reference_words.values()),
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
    arguments.out.mkdir(parents=True, exist_ok=True)

    scores: list[PageScore] = []
    with tempfile.TemporaryDirectory() as work_name:
        work = Path(work_name)
        for path in sorted(arguments.reference.glob("*.pdf")):
            document = pdfium.PdfDocument(str(path))
            for index in range(len(document)):
                scores.append(score_page(document, path.name, index, work))
            usable = [s for s in scores if s.file == path.name and s.usable_reference]
            if usable:
                mean = sum(s.word_recall for s in usable) / len(usable)
                print(f"{path.name[:26]:26} {len(usable):3} pages  word recall {mean:.3f}", flush=True)
            else:
                print(f"{path.name[:26]:26} no usable page", flush=True)

    usable = [s for s in scores if s.usable_reference]
    weights = [s.reference_words for s in usable]
    total = sum(weights)

    def weighted(field: str) -> float:
        return round(sum(getattr(s, field) * w for s, w in zip(usable, weights)) / total, 4)

    summary = {
        "pages_scored": len(usable),
        "pages_skipped": len(scores) - len(usable),
        "reference_words": total,
        "char_agreement": weighted("char_agreement"),
        "word_recall": weighted("word_recall"),
        "diacritic_word_recall": weighted("diacritic_word_recall"),
        "plain_word_recall": weighted("plain_word_recall"),
        "note": (
            "Tesseract alone, on clean 200 dpi renders of typeset pages, against the publisher's "
            "own text layer. Real scans are worse. Below 0.90 triggers R-01; at or above it, "
            "nothing follows about real scans."
        ),
    }
    (arguments.out / "tesseract-ceiling.json").write_text(
        json.dumps({"summary": summary, "per_page": [asdict(s) for s in scores]}, indent=2),
        encoding="utf-8",
    )
    print("\n" + json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

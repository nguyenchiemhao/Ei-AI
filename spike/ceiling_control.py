"""Control for tesseract_ceiling.py: does the measurement notice when reading goes wrong?

The same pages, read with `-l eng` instead of `-l vie+eng`. English has no Vietnamese language
model, so diacritic-bearing words should collapse while plain ASCII words barely move. A metric that
cannot tell those two apart is not measuring what it says.
"""
import os, sys, json, tempfile
sys.path.insert(0, "/workspace/spike")
from pathlib import Path
import pypdfium2 as pdfium
import tesseract_ceiling as tc

files = sorted(Path("/workspace/spike/reference").glob("*.pdf"))[:4]
for langs in ("vie+eng", "eng"):
    tc.LANGUAGES = langs
    scores = []
    with tempfile.TemporaryDirectory() as w:
        for p in files:
            d = pdfium.PdfDocument(str(p))
            for i in range(min(len(d), 4)):
                scores.append(tc.score_page(d, p.name, i, Path(w)))
    ok = [s for s in scores if s.usable_reference]
    weights = [s.reference_words for s in ok]; total = sum(weights)
    wa = lambda f: round(sum(getattr(s, f) * x for s, x in zip(ok, weights)) / total, 4)
    print(json.dumps({"langs": langs, "pages": len(ok),
                      "word_recall": wa("word_recall"),
                      "diacritic": wa("diacritic_word_recall"),
                      "plain": wa("plain_word_recall")}))

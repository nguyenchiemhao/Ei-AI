"""Control for ocr_ceiling.py: how much does the path lose when OCR is not involved at all?

docling reads the typeset PDF directly with OCR off, so what it returns is the publisher's own text
carried through the same markdown export and the same normalisation the ceiling measurement uses.
Whatever this falls short of 1.0 is the harness, not Tesseract — and the ceiling has to be read
against it rather than against a perfect score.
"""
import sys, json, statistics
sys.path.insert(0, "/workspace/spike")
from pathlib import Path
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from ocr_ceiling import normalise, words, recall, reference_text, short_token_share, MAX_SHORT_TOKEN_SHARE
from difflib import SequenceMatcher

convert = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(
    pipeline_options=PdfPipelineOptions(do_ocr=False, do_table_structure=True))})

rows = []
for p in sorted(Path("/workspace/spike/reference").glob("*.pdf")):
    ref, pages = reference_text(p)
    rw = words(ref)
    if short_token_share(rw) > MAX_SHORT_TOKEN_SHARE:
        print(f"{p.name}: skipped, unusable reference"); continue
    got = convert.convert(p).document.export_to_markdown()
    r = recall(rw, words(got))
    c = SequenceMatcher(None, normalise(ref), normalise(got), autojunk=False).ratio()
    rows.append((p.name, pages, c, r))
    print(f"{p.name[:26]:26} pages {pages:3}  chars {c:.3f}  words {r:.3f}")

total = sum(p for _, p, _, _ in rows)
print(json.dumps({
  "files": len(rows), "pages": total,
  "char_agreement": round(sum(c*p for _, p, c, _ in rows)/total, 4),
  "word_recall": round(sum(r*p for _, p, _, r in rows)/total, 4),
}, indent=2))

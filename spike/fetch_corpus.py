"""T-4.1-01 and T-4.1-02 — collect the proxy corpus from Công báo Chính phủ.

Runs on the host's network, not on the internal one: the corpus is fetched once, out of band, and
the containers that read it never reach outside. Sources are Vietnam's official gazette, whose
normative documents carry no copyright under Luật Sở hữu trí tuệ điều 15; the files stay outside
git and only the manifest is committed.

    python spike/fetch_corpus.py --out spike/corpus --manifest spike/corpus-manifest.json

**Scans are told from digital PDFs by measurement, not by hoping.** A scanned page is an image with
almost no extractable text; a digitally generated one has two to three thousand characters and no
image object. The threshold is in SCAN_MAX_CHARS_PER_PAGE, and every file's measured value is
written into the manifest so the classification can be argued with rather than trusted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import ssl
import sys
import time
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urljoin

import pypdfium2 as pdfium

BASE = "https://congbao.chinhphu.vn"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"
DELAY_SECONDS = 1.5

# A scanned page's text layer is a header or nothing; a digital page carries the whole body. The
# gap measured on the first four samples was 120 against 2 500 characters a page, so the line sits
# far from both.
SCAN_MAX_CHARS_PER_PAGE = 400
SAMPLE_PAGES = 5

# Two classes, from Detail: legal scans, and reports with real tabular layout. The gazette groups
# documents by type (`-l<n>`) and by issuing body (`-c<n>`), and both listings are discovered from
# the homepage rather than written down here — a hand-kept list of forty-nine slugs would be stale
# the first time the site adds one.
#
# Which categories hold scans is not guessable: a 2026 thông tư is typeset and a văn bản hợp nhất of
# the same year is a scan of signed pages. So every category is walked and each file is judged on
# its own measurement.
REPORT_HINTS = ("bao-cao", "thong-bao", "bien-ban", "de-an", "chuong-trinh", "du-an")


def categories() -> tuple[list[str], list[str]]:
    html = fetch(BASE + "/van-ban-dang-cong-bao.htm")
    types = sorted(set(re.findall(r'href="(/van-ban-dang-cong-bao/[a-z0-9-]+-l\d+\.htm)"', html)))
    bodies = sorted(set(re.findall(r'href="(/van-ban-dang-cong-bao/[a-z0-9-]+-c\d+\.htm)"', html)))
    reports = [t for t in types if any(h in t for h in REPORT_HINTS)]
    legal = [t for t in types if t not in reports] + bodies
    return legal, reports


_context = ssl.create_default_context()
_context.check_hostname = False
_context.verify_mode = ssl.CERT_NONE


@dataclass
class Entry:
    file: str
    document_class: str
    kind: str
    title: str
    source_page: str
    pdf_url: str
    pages: int
    bytes: int
    sha256: str
    chars_per_page: int
    image_objects: int


def fetch(url: str, binary: bool = False):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=90, context=_context) as response:
        payload = response.read()
    time.sleep(DELAY_SECONDS)
    return payload if binary else payload.decode("utf-8", "replace")


def document_pages(listing_path: str) -> list[str]:
    html = fetch(urljoin(BASE, listing_path))
    return sorted(set(re.findall(r'href="(/van-ban/[^"]*?-\d+\.htm)"', html)))


def pdf_of(page_url: str) -> tuple[str, str] | None:
    html = fetch(page_url)
    links = re.findall(r'href="(https://[^"]*(?:stream|\.pdf)[^"]*)"', html, re.I)
    if not links:
        return None
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    return links[0], (title.group(1).strip() if title else page_url)


# The classification is the whole reason this script exists rather than a browser and a mouse: a
# digitally generated gazette PDF looks identical in a listing and is useless as an OCR subject.
def measure(path: Path) -> tuple[int, int, int, str]:
    document = pdfium.PdfDocument(str(path))
    pages = len(document)
    sampled = min(pages, SAMPLE_PAGES)
    characters, images = 0, 0
    for index in range(sampled):
        page = document[index]
        characters += len(page.get_textpage().get_text_bounded().strip())
        images += sum(1 for obj in page.get_objects() if obj.type == 3)
    per_page = characters // max(sampled, 1)
    kind = "scan" if per_page <= SCAN_MAX_CHARS_PER_PAGE and images > 0 else "digital"
    return pages, per_page, images, kind


def collect(
    document_class: str,
    wanted: int,
    out: Path,
    seen: set[str],
    listings: list[str],
    wanted_kind: str = "scan",
) -> list[Entry]:
    entries: list[Entry] = []
    for listing in listings:
        if len(entries) >= wanted:
            break
        try:
            pages = document_pages(listing)
        except Exception as error:  # noqa: BLE001 — one dead listing must not stop the collection
            print(f"  listing {listing} failed: {type(error).__name__}", file=sys.stderr)
            continue
        print(f"  {listing}: {len(pages)} documents")
        for relative in pages:
            if len(entries) >= wanted:
                break
            page_url = urljoin(BASE, relative)
            if page_url in seen:
                continue
            seen.add(page_url)
            try:
                found = pdf_of(page_url)
                if found is None:
                    continue
                pdf_url, title = found
                data = fetch(pdf_url, binary=True)
            except Exception as error:  # noqa: BLE001
                print(f"    {relative}: {type(error).__name__}", file=sys.stderr)
                continue
            if not data.startswith(b"%PDF-"):
                continue

            digest = hashlib.sha256(data).hexdigest()
            name = f"{document_class}-{digest[:12]}.pdf"  # class and content, nothing else
            path = out / name
            path.write_bytes(data)
            count, per_page, images, kind = measure(path)
            if kind != wanted_kind:
                path.unlink()
                print(f"    skip {kind:8}{title[:52]} ({per_page} chars/page)")
                continue
            entries.append(
                Entry(
                    file=name,
                    document_class=document_class,
                    kind=kind,
                    title=title,
                    source_page=page_url,
                    pdf_url=pdf_url,
                    pages=count,
                    bytes=len(data),
                    sha256=digest,
                    chars_per_page=per_page,
                    image_objects=images,
                )
            )
            print(f"    [{len(entries):2}/{wanted}] {title[:58]} — {count}p, {per_page} chars/page")
    return entries


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--legal", type=int, default=40)
    parser.add_argument("--reports", type=int, default=15)
    # The typeset documents are the upper-bound reference set: their text layer is the publisher's
    # own, so rendering a page and reading it back measures the OCR engine and nothing else.
    parser.add_argument("--kind", choices=["scan", "digital"], default="scan")
    arguments = parser.parse_args()

    arguments.out.mkdir(parents=True, exist_ok=True)
    legal_listings, report_listings = categories()
    print(f"discovered {len(legal_listings)} legal and {len(report_listings)} report categories")
    seen: set[str] = set()
    entries: list[Entry] = []
    for document_class, wanted, listings in (
        ("legal", arguments.legal, legal_listings),
        ("report", arguments.reports, report_listings),
    ):
        print(f"\n{document_class}: want {wanted}")
        entries.extend(
            collect(document_class, wanted, arguments.out, seen, listings, arguments.kind)
        )

    arguments.manifest.write_text(
        json.dumps([asdict(entry) for entry in entries], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    total_pages = sum(entry.pages for entry in entries)
    total_mb = sum(entry.bytes for entry in entries) / 1_000_000
    print(f"\n{len(entries)} files, {total_pages} pages, {total_mb:.0f} MB")
    print(f"manifest: {arguments.manifest}")
    return 0 if entries else 1


if __name__ == "__main__":
    raise SystemExit(main())

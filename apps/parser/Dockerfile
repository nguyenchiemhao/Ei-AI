FROM python@sha256:782412e85d0f0984994c290652577d4018aff08145c85b262bb63dc0c7522254

# Tesseract carries the Vietnamese and English language data the OCR spike scores against.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-vie tesseract-ocr-eng libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/apps/parser

# CPU wheels only: the parser never holds the GPU, which belongs to the embedding server.
COPY apps/parser/pyproject.toml ./
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
      docling==2.15.1 "docling-core[chunking]==2.14.0"

COPY apps/parser/src/ src/
CMD ["python", "src/main.py"]

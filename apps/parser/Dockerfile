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

# docling fetches its layout and table-structure models from the Hub on first use, and the network
# this container runs on is default-deny — so without this the image installs a parser that cannot
# parse. Baked at build time, where the network is reachable, and pinned by the revision docling
# 2.15.1 itself asks for. HF_HOME points at the same place at build and at run.
ENV HF_HOME=/models
RUN python -c "from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline as P; print(P.download_models_hf())"

COPY apps/parser/src/ src/
CMD ["python", "src/main.py"]

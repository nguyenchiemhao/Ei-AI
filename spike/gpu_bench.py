"""T-4.1-09 and T-4.1-10 — embedding throughput and rerank latency against the running infinity.

Driven over infinity's own HTTP API from inside the internal network, because that is how the
product reaches it: a number measured against a locally loaded model would be a number for a
deployment nobody runs.

The corpus is the product's own chunks, exported from the `chunks` table after the fifty seeded
Vietnamese Markdown documents went through the real pipeline — not text cut up here, or the chunk
size the number is quoted at would be invented rather than measured.

    docker compose --profile spike run --rm spike \\
        python /workspace/spike/gpu_bench.py --chunks /workspace/spike/out/chunks.json
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
import urllib.request
from pathlib import Path

EMBEDDING_MODEL = "BAAI/bge-m3"
RERANK_MODEL = "BAAI/bge-reranker-v2-m3"


def post(base: str, path: str, payload: dict) -> dict:
    request = urllib.request.Request(
        base + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(response.read())


def batches(items: list[str], size: int) -> list[list[str]]:
    return [items[start : start + size] for start in range(0, len(items), size)]


# The first call loads the model and pays for it; measuring that once and calling it throughput
# would report the load, not the work.
def warm(base: str, texts: list[str]) -> None:
    post(base, "/embeddings", {"model": EMBEDDING_MODEL, "input": texts[:8]})
    post(base, "/rerank", {"model": RERANK_MODEL, "query": "khởi động", "documents": texts[:8]})


def embedding_throughput(base: str, texts: list[str], batch: int, rounds: int) -> dict:
    runs = []
    for _ in range(rounds):
        started = time.perf_counter()
        for group in batches(texts, batch):
            post(base, "/embeddings", {"model": EMBEDDING_MODEL, "input": group})
        runs.append(time.perf_counter() - started)
    return {
        "chunks": len(texts),
        "batch": batch,
        "rounds": rounds,
        "seconds_per_round": [round(r, 2) for r in runs],
        "chunks_per_second": round(len(texts) / statistics.median(runs), 1),
    }


def rerank_latency(base: str, texts: list[str], candidates: int, runs: int) -> dict:
    documents = (texts * (candidates // len(texts) + 1))[:candidates]
    question = "điều khoản thanh toán trong hợp đồng"
    samples = []
    for _ in range(runs):
        started = time.perf_counter()
        post(base, "/rerank", {"model": RERANK_MODEL, "query": question, "documents": documents})
        samples.append((time.perf_counter() - started) * 1000)
    samples.sort()
    return {
        "candidates": candidates,
        "runs": runs,
        "p50_ms": round(statistics.median(samples), 1),
        "p95_ms": round(samples[int(len(samples) * 0.95) - 1], 1),
        "min_ms": round(samples[0], 1),
        "max_ms": round(samples[-1], 1),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunks", type=Path, required=True)
    parser.add_argument("--base", default="http://infinity:7997")
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--candidates", type=int, default=60)
    parser.add_argument("--rerank-runs", type=int, default=120)
    arguments = parser.parse_args()

    chunks = json.loads(arguments.chunks.read_text(encoding="utf-8"))
    texts = [chunk["text"] for chunk in chunks]
    tokens = [chunk["token_count"] for chunk in chunks]
    print(
        f"corpus: {len(texts)} chunks, "
        f"tokens min {min(tokens)} / median {int(statistics.median(tokens))} / max {max(tokens)}"
    )

    warm(arguments.base, texts)
    embedding = embedding_throughput(arguments.base, texts, arguments.batch, arguments.rounds)
    rerank = rerank_latency(arguments.base, texts, arguments.candidates, arguments.rerank_runs)

    print(json.dumps({"embedding": embedding, "rerank": rerank}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

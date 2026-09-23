#!/usr/bin/env bash
# T-4.1-08 — VRAM in use with BGE-M3 and the reranker both resident.
#
# Runs on the host, not in a container: WSL2 answers
# `nvidia-smi --query-compute-apps=pid,used_memory` with `[N/A]`, so there is no per-process figure
# to read and the card's total is the only honest number. The baseline is therefore measured with
# infinity stopped and subtracted by hand, and it is printed rather than folded in silently.
#
# Three cycles, because a measurement that changes between identical runs has not been made.
set -euo pipefail

COMPOSE="${COMPOSE:-infra/compose/docker-compose.yml}"
CYCLES="${CYCLES:-3}"

used() { nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits; }

wait_healthy() {
  for _ in $(seq 1 60); do
    case "$(docker compose -f "$COMPOSE" ps --format '{{.Service}} {{.Health}}' | grep '^infinity ')" in
      *healthy*) return 0 ;;
    esac
    sleep 5
  done
  echo "infinity did not become healthy" >&2
  return 1
}

printf 'cycle\tbaseline_MiB\tboth_models_MiB\tinfinity_share_MiB\n'
for cycle in $(seq 1 "$CYCLES"); do
  docker compose -f "$COMPOSE" stop infinity >/dev/null 2>&1
  sleep 8
  baseline="$(used)"

  docker compose -f "$COMPOSE" start infinity >/dev/null 2>&1
  wait_healthy
  # The models load lazily on the first request for each; a health check alone can leave the
  # reranker unloaded, and then the number is for one model, not two.
  docker compose -f "$COMPOSE" exec -T api node -e '
    const call = (path, body) =>
      fetch("http://infinity:7997" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.ok || Promise.reject(new Error(path + " -> " + r.status)));
    Promise.all([
      call("/embeddings", { model: "BAAI/bge-m3", input: ["khởi động"] }),
      call("/rerank", { model: "BAAI/bge-reranker-v2-m3", query: "khởi động", documents: ["a", "b"] }),
    ]).then(() => console.error("both models touched"), (e) => { console.error(e.message); process.exit(1); });
  ' >/dev/null
  sleep 5
  both="$(used)"

  printf '%d\t%s\t%s\t%s\n' "$cycle" "$baseline" "$both" "$((both - baseline))"
done

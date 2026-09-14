# Ei-AI

A self-hosted agentic knowledge assistant. It answers questions from documents you own,
cites the exact passage behind every claim, and refuses rather than invents when the
answer is not in the corpus.

**Phase 1 is the foundation, and it generates no text.** The screen is "Search documents",
not "Ask a question": upload Markdown, watch it reach `indexed`, search, and get back the
passages that contain the answer, with file name and position. Generation arrives in Phase 2.

- Design — [docs/design/ei-ai-agentic-knowledge-assistant.md](docs/design/ei-ai-agentic-knowledge-assistant.md)
- Plan — [docs/plan/ei-ai-implementation-plan.md](docs/plan/ei-ai-implementation-plan.md)
- Status — [docs/plan/ei-ai-progress.md](docs/plan/ei-ai-progress.md) is the only place status lives
- How we work — [CLAUDE.md](CLAUDE.md)

---

## What you need on the machine

Everything else runs in Docker, so the host stays clean. **There is deliberately no Node
and no Python on the host** (ADR-13): the versions are guaranteed by the images, not by a
reminder to install the right one.

| Requirement | Verified with | Notes |
| --- | --- | --- |
| Docker Engine 29.4.3 | `docker --version` | Docker Desktop with WSL integration enabled, or native Docker in the distro |
| Docker Compose 5.1.3 | `docker compose version` | v2 syntax throughout |
| NVIDIA GPU, ≥4 GB VRAM | `nvidia-smi` | RTX 3050 Ti (4096 MiB, driver 581.95) is the reference machine |
| NVIDIA Container Toolkit | `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi` | the embedding server reserves the card |
| ~40 GB free disk | `df -h .` | images ≈ 24 GB (the Infinity image alone is 11.6 GB), volumes ≈ 8 GB |
| Source on a Linux filesystem | `df -T .` → `ext4` | **not** `9p`/`drvfs`. On WSL2 keep the tree in `~`, never under `/mnt/c` |

## Versions inside the stack

Every image is pinned **by digest**, so these do not drift. Two of them do not match what
their own tag says, which is exactly why the digest is the pin:

| Component | Version | Pinned as |
| --- | --- | --- |
| Node | 22.13.1 | `node@sha256:83fdfa2a…` |
| pnpm | 10.34.5 | `packageManager` in [package.json](package.json) |
| TypeScript | 5.7.3 | workspace dependency |
| NestJS | 11.0.5 | workspace dependency |
| Vite | 6.0.7 | workspace dependency |
| PostgreSQL | **17.6** | `pgvector/pgvector:0.8.0-pg17@sha256:40b40496…` — the tag names the major only |
| pgvector | 0.8.0 | same image |
| Redis | 7.4.11 | `redis:7.4-alpine@sha256:ff02b58f…` |
| Infinity (embeddings) | 0.0.76 | `michaelf34/infinity:0.0.76@sha256:90bd83ec…` |
| Squid | **6.13** | `ubuntu/squid:6.6-24.04_beta@sha256:6a097f68…` — Canonical publishes squid only on `_beta`/`_edge`; the suffix is the image channel, not the state of Squid |
| nginx (ingress) | 1.27.5 | `nginx:1.27-alpine@sha256:65645c7b…` |
| Python (parser) | 3.12.14 | `python:3.12-slim-bookworm@sha256:782412e8…` |
| Tesseract | 5.3.0, langs `eng osd vie` | installed in the parser image |
| Docling | 2.15.1 (with `docling-core` 2.14.0) | pinned together; an open `docling-core` makes pip backtrack without terminating |
| Models | `BAAI/bge-m3` · `BAAI/bge-reranker-v2-m3` | 4.3 GB, cached in the `models` volume |

---

## Running it

### 1. Configure

```bash
cp .env.example .env
```

Then set `JWT_SECRET` in `.env`:

```bash
openssl rand -base64 48
```

`.env` is the **only** environment file and it is gitignored. Boot fails with a named error
listing what is missing, rather than starting on silent defaults.

### 2. Fetch the model weights — before the network is locked

The backend network is `internal: true`, so once the stack is up nothing on it can reach the
internet. The embedding server must therefore download its weights first, once:

```bash
docker run --rm --gpus all -v ei-ai_models:/models -e HF_HOME=/models \
  michaelf34/infinity:0.0.76 \
  v2 --model-id BAAI/bge-m3 --model-id BAAI/bge-reranker-v2-m3
```

Wait for `Application startup complete`, then Ctrl-C. Skip this if the `ei-ai_models`
volume already exists; repeat it after any `down -v`.

### 3. Start

```bash
docker compose -f infra/compose/docker-compose.yml up -d
```

First run builds the images and pulls the rest. Budget time and disk: the parser image takes
several minutes because Docling pulls CPU-only torch, and the Infinity image is 11.6 GB on
its own. `docker system df` shows where the space went.

### 4. Open

| URL | What |
| --- | --- |
| http://localhost:4173 | Web app |
| http://localhost:4180/health | API health |

Ports 3000 and 8080 are commonly taken by other projects, so the host side uses 4173 and
4180 instead. Inside the stack the services still listen on their conventional ports.

### 5. Stop

```bash
docker compose -f infra/compose/docker-compose.yml down     # keeps volumes
docker compose -f infra/compose/docker-compose.yml down -v  # also drops the 4.3 GB of weights
```

---

## The two network boundaries

```
        host
          │  4173 / 4180
     ┌────▼─────┐
     │ ingress  │  nginx — the only way IN
     └────┬─────┘
          │
  ═══════ backend (internal: true) ═══════
   api · ingest-worker · web · parser
   postgres · redis · infinity
  ════════════════┬══════════════════════
                  │
             ┌────▼─────┐
             │  squid   │  the only way OUT, allowlist ships empty
             └────┬─────┘
                  │  egress
               internet
```

No product container has a default route. Verify it:

```bash
C="docker compose -f infra/compose/docker-compose.yml"
$C exec api sh -c 'ip route | grep -c default'   # → 0
$C exec ingress sh -c 'ip route | grep -c default'   # → 1, and only this one
```

`allowlist.conf` ships empty **and that is the working configuration**: with nothing listed,
every outbound request is refused and logged as `TCP_DENIED`. See
[infra/squid/README.md](infra/squid/README.md).

---

## Development

### Lint, typecheck, test

The host has no Node, so run them through the pinned image:

```bash
docker run --rm -v "$PWD":/workspace -w /workspace -e HOME=/tmp \
  node:22.13.1-bookworm-slim \
  sh -c 'npm i -g corepack@latest >/dev/null 2>&1 && corepack enable \
         && pnpm -r lint && pnpm -r typecheck && pnpm -r test'
```

`npm i -g corepack@latest` is not optional: the corepack bundled with Node 22.13.1 cannot
verify current npm signing keys and refuses to activate pnpm.

### Dev Container

Open the folder in VS Code and run **Dev Containers: Reopen in Container**. It starts only
`api`, `postgres` and `redis`, so opening the IDE does not demand the GPU. The debugger
attaches on 9229 through the `Attach to API` configuration in
[.vscode/launch.json](.vscode/launch.json).

### Layout

```
apps/api        NestJS 11 — modular monolith; the API and the worker share one image
apps/web        React + Vite
apps/parser     Python — skeleton in Phase 1, used out-of-band for the OCR spike
packages/       shared tsconfig and eslint config
infra/compose   the stack
infra/squid     egress: the only way out
infra/ingress   the only way in
docs/           design, plan, progress, working notes
```

---

## Licence and data

The repository is public on purpose — it is a personal research project. Nothing that is not
intended for publication belongs in the tree: no document corpus, no customer data, no real
customer names. `uploads/`, `storage/`, `models/` and `.env*` are ignored, and any new
corpus directory gets its `.gitignore` entry in the same commit that creates it.

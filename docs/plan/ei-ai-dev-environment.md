# Ei-AI — Development Environment

> Operational companion to the [Implementation Plan](./ei-ai-implementation-plan.md). Records the two environment decisions and the setup detail behind them.
>
> **These decisions survive the 2026-09-09 design rewrite unchanged** — they concern how the team works, not what the product does. Their ADRs were renumbered 07→12 and 08→13 to fit the single global ADR sequence in the [design document](../design/ei-ai-agentic-knowledge-assistant.md).

| Field | Value |
| --- | --- |
| Version | 2.0 (English) |
| Date | 2026-09-09 |
| Status | Decisions locked · setup partly executed |

---

## 1. ADR-12 — Develop on the demo machine with the `dev-hybrid` profile

**Context.** The design assumes a server with a 48 GB GPU running a ~32B model locally. The actual machine is a laptop with an RTX 3050 Ti and **4 GB of VRAM**. That is enough for embedding and reranking, and not enough for generation at any useful model size. At the same time there are no real customer documents yet, so the development corpus is public legal texts and sample `.md` files — nothing confidential.

**Decision.** Develop Phases 1 and 2 on the demo machine using the `dev-hybrid` profile: embedding and reranking run locally on the GPU, generation goes to the Anthropic API through `ModelProviderPort`. A `dev-local` profile (generation via Qwen3-4B on CPU) exists alongside it and runs at every phase gate to prove the local path has not rotted.

**Consequences.**

| | |
| --- | --- |
| **Good** | No hardware ceiling while building the answering, verifier and citation logic — the hardest part of the product. `ModelProviderPort` is exercised for real from week 1, so it is a proven seam rather than a theoretical abstraction |
| **Good** | Retrieval — where answer quality is actually decided — runs locally exactly as it will in production. There is no dev/prod difference here at all |
| **Bad** | Risk of tuning prompts for a strong model and then falling over on a weaker one. Mitigated by the three controls in section 7 |
| **Bad** | NFR-01 and NFR-02 cannot be measured against a local model until real hardware exists. **Latency figures from Phases 1–2 prove nothing about production** |
| **Neutral** | An outbound network path exists from week 1, before Squid is built. This is why the plan moves Squid into Phase 1 |

**When this decision expires.** Once real hardware exists (milestone: before week 16), `prod` becomes the profile of record for all measurement. `dev-hybrid` stays for the daily loop because it is faster.

---

## 2. ADR-13 — Run the entire system in Docker

**Context.** The demo machine has Node v14.21.3 (end-of-life since April 2023), no pnpm, and Python 3.11 rather than 3.12. Installing the toolchain on the host means every developer machine has to get the versions right independently, and drift between machines is a classic source of bugs. Separately, the product ships to customers as a Docker Compose stack, so developing on that same stack has value of its own.

**Decision.** **Yes — run everything in Docker, as a Dev Container.** The host needs only Docker Desktop, VS Code and Git. No Node, pnpm or Python installed on Windows.

This carries **one mandatory condition: the source must live on a Linux filesystem, not on the Windows `D:` drive.** Without it, this decision turns the inner development loop into a slog and the version-consistency benefit does not cover the cost.

### 2.1 Why that condition is mandatory

Docker Desktop on Windows runs containers inside a WSL2 virtual machine. Bind-mounting a Windows directory into a container routes every file read and write through the 9p/drvfs bridge between Windows and Linux. That bridge is several times slower than a native filesystem — and the three most file-heavy operations in this project are the three done all day long:

| Operation | Files involved | Effect across the bridge |
| --- | --- | --- |
| `pnpm install` | tens of thousands of small files in `node_modules` | Several times slower |
| Vite HMR on a component edit | few files, but the whole tree is watched | HMR goes from tens of milliseconds to seconds |
| `tsc --watch` / `nest start --watch` | the whole project | Every save becomes a wait |

Worse: **inotify events do not propagate reliably** across the bridge, so watchers fall back to polling — rescanning the tree on a timer, burning CPU continuously and still lagging.

Putting the source on a Linux filesystem removes all three problems at once: native ext4 speed, and inotify works correctly.

### 2.2 Where the source lives — decided

The machine has **only the `docker-desktop` distro; no Ubuntu is installed**, so option A needs one extra setup step.

| | Location | Speed | Assessment |
| --- | --- | --- | --- |
| **A** | Inside an Ubuntu WSL2 distro at `~/ei-ai`, opened via VS Code Remote-WSL | Native | **✅ CHOSEN** (2026-09-08). Git works normally, the folder is still reachable from Windows via `\\wsl$\Ubuntu\home\...`. One-off cost ~15 minutes |
| B | Inside a Docker named volume (Dev Containers "Clone Repository in Container Volume") | Native | Not chosen. Fast and needs no Ubuntu, but the source lives inside the vhdx — adding pressure to an already tight `C:` — and git operations outside the container are awkward |
| C | Keep `D:\Data\Ei-AI`, bind-mount into containers | **Slow** | Not chosen. It works, but the loop is slow enough to wear the team down |

**Note for a possible retreat to C.** Keep `node_modules` in a named volume rather than bind-mounted. The hottest path then avoids the bridge entirely — `pnpm install` recovers, only watching stays slow. The Compose configuration in section 5 already does this, so no change would be needed.

### 2.3 Consequences of ADR-13

| | |
| --- | --- |
| **Good** | **Versions are guaranteed by the image, not by a reminder.** Node 22.13, pnpm 10, Python 3.12, Postgres 17.2, pgvector 0.8 are all pinned in Dockerfiles. A new machine needs only Docker and VS Code |
| **Good** | **The team runs the same stack the customer receives.** The installation path is rehearsed daily instead of only in Phase 4, which directly de-risks NFR-17 ("someone outside the build team installs it from documentation in under 4 hours") |
| **Good** | No need to upgrade Node on the host, no version conflicts with the other projects on this machine |
| **Bad** | **Needs real setup work** — Dev Container, debugger path mapping, WSL2 configuration. Roughly 2–3 days in week 1, and it has to be done properly |
| **Bad** | Adding a dependency means rebuilding the image or `exec`-ing into the container. A longer loop than running on the host |
| **Bad** | Uses more RAM. WSL2 must be capped explicitly — see section 4.3 |
| **Neutral** | The IDE must run *inside* the container (Dev Containers) so the TypeScript language server can see `node_modules`. Missing this is the single most common trap with this approach |

**What does not change.** Production and CI were fully dockerised from the start; that was never in question. Version guarantees for *what ships* come from the images regardless of how developers run things locally. ADR-13 decides only the **inner development loop** — and the argument that carried it is version consistency *across the team's machines*.

---

## 3. Demo machine inventory

Measured 2026-09-08 and 2026-09-09.

| Item | Actual | Assessment |
| --- | --- | --- |
| CPU | Intel i7-12700H · 14 cores / 20 threads | Adequate. Can run Qwen3-4B on CPU for `dev-local` |
| RAM | 31.7 GB | Adequate, but WSL2 must be capped explicitly |
| GPU (compute) | NVIDIA RTX 3050 Ti Laptop · **4 GB VRAM** · driver 581.95 · compute 8.6 | Enough for embedding + rerank. Not enough for generation |
| GPU (display) | Intel Iris Xe | **Good news:** the iGPU drives the display, so nearly all 4 GB of the 3050 Ti is available for compute |
| Docker | 29.4.3 · Compose v5.1.3 · WSL2 backend | Ready |
| **NVIDIA container runtime** | **`nvidia-container-runtime` registered** | **The biggest unknown, already solved** — GPU passthrough into containers works |
| **WSL distro** | **Only `docker-desktop`** | **No Ubuntu yet.** Needed for option A |
| **`.wslconfig`** | **Written, not yet applied** | WSL2 would otherwise take up to 50% of RAM (~16 GB) and be slow to release it |
| WSL version | 2.7.3 | Supports `--location` when installing a distro |
| Node on host | v14.21.3 | **No longer relevant** under ADR-13 — the toolchain lives in the image |
| pnpm / Python on host | absent / 3.11.15 | **Not needed** under ADR-13 |
| Git | 2.50.1 | Fine |
| **Physical disk** | **Samsung PM991a NVMe 512 GB — a single disk, Disk 0** | **`C:` and `D:` are two partitions of the same drive.** Moving data between them is neither faster nor space-creating |
| Partition `C:` | **50.0 GB free** / 358.2 GB | Docker's vhdx lives here at 73.2 GB, of which only ~5.7 GB is in use after cleanup |
| Partition `D:` | 90.4 GB free / 117.2 GB | The smaller partition. Not needed |
| Sparse VHD | **Blocked by WSL** — data-corruption warning | To shrink the vhdx use `diskpart compact vdisk`, **never** `--set-sparse --allow-unsafe` |

> **This machine is shared with other projects.** `marlin-dev` and `eerp-dev` (Laravel, bind-mounted from `D:\Data\ERP-Team\EERP`) are running, together with four of their volumes: `marlin_marlin_node_modules`, `e-erp_eerp_vendor`, `e-erp_eerp_storage_framework`, `e-erp_eerp_bootstrap_cache`.
>
> Every Docker cleanup operation must **target specific objects**. Never use a sweeping command, and in particular **never `docker volume prune`**. A lesson already paid for: the 2026-09-09 cleanup via Docker Desktop destroyed `e-erp_eerp_mysql_data` and `eerp-dev_db-data`, because neither was attached to a running container and both therefore counted as "unused". The e-erp source code was unaffected (it is bind-mounted); the dev database has to be rebuilt from Laravel migrations and seeders.

---

## 4. Environment preparation

Under ADR-13 this list is shorter than it would otherwise be: no Node upgrade, no pnpm install on the host.

### 4.1 Disk requirement

Ei-AI needs roughly **35–45 GB** on `C:`:

| Component | Size |
| --- | --- |
| Infinity image on a CUDA base | ~6–8 GB |
| Model weights (BGE-M3 + reranker + Qwen3-4B GGUF) | ~7 GB |
| Postgres and its data, Redis, `node_modules` volumes, build cache | ~12–20 GB |
| Ubuntu WSL2 distro + repository | ~8–10 GB |

Because `C:` and `D:` are partitions of one physical NVMe, moving data between them is neither faster nor space-creating — **leave everything in its default location on `C:`**.

**Current state after the 2026-09-09 cleanup:** Docker occupies ~5.7 GB inside a 73.2 GB vhdx, so roughly **67 GB is free inside the vhdx** and available for Ei-AI's images and volumes without the file growing at all. `C:` itself has 50 GB free, which covers the Ubuntu distro and the repository. **No vhdx compaction is required.**

### 4.2 Install Ubuntu WSL2 and move the repository — step B3

> **Finish B0c first.** The repository has commits and a remote, but **nothing has been pushed yet**. Moving a directory whose only copy is local is the easiest way to lose work. Push before touching anything else.
>
> This is also the honest answer to "is code safe inside a WSL vhdx?" — it is safe because it has a remote, not because of which drive holds it.

**Where the distro lives.** WSL installs to `C:\Users\<user>\AppData\Local\Packages\CanonicalGroupLimited...\LocalState\ext4.vhdx` by default. Since `C:` and `D:` are partitions of one disk (section 3), this has **no effect on speed**, and `C:` has room. So: **leave the default.**

If you want the distro on `D:` anyway, WSL 2.7.3 supports `--location`:

```powershell
wsl --install -d Ubuntu --location D:\wsl\Ubuntu
```

For an existing distro, export and re-import:

```powershell
wsl --export Ubuntu D:\wsl\ubuntu-backup.tar
wsl --unregister Ubuntu
wsl --import Ubuntu D:\wsl\Ubuntu D:\wsl\ubuntu-backup.tar
```

**Install and move:**

```bash
# On Windows (PowerShell)
wsl --install -d Ubuntu
# Reboot if prompted, then set the Ubuntu username and password

# Inside Ubuntu
sudo apt update && sudo apt install -y git
git config --global user.email "howie@cal-se.com"
git config --global core.autocrlf input      # avoids CRLF/LF churn across the boundary

git clone https://github.com/nguyenchiemhao/Ei-AI.git ~/ei-ai
cd ~/ei-ai && code .        # opens VS Code in Remote-WSL mode
```

The folder stays reachable from Windows Explorer at `\\wsl$\Ubuntu\home\<user>\ei-ai` — but **do not edit files through that path while containers are running**, because that is exactly the slow bridge ADR-13 exists to avoid.

Once `git log` inside `~/ei-ai` shows the full history, rename the old directory rather than deleting it:

```powershell
Rename-Item "D:\Data\Ei-AI" "Ei-AI.moved"
```

Keep it for a few days. And note that **this Claude Code session is rooted at `d:\Data\Ei-AI`** — after the move, restart it at `~/ei-ai` inside WSL.

### 4.3 Cap WSL2 memory — step B2

Without a `.wslconfig`, WSL2 takes up to 50% of RAM (~16 GB) and is slow to release it. With Infinity, Postgres, Node and Vite all running in containers, plus Windows, the IDE and a browser, the machine will thrash.

`C:\Users\<user>\.wslconfig`:

```ini
[wsl2]
memory=18GB
processors=12
swap=4GB

[experimental]
# Return RAM to Windows gradually when WSL is not using it
autoMemoryReclaim=gradual
```

Then `wsl --shutdown` to apply. 18 GB leaves ~13 GB for Windows, the IDE and a browser — adjust once measured.

**Deliberately omitted: `sparseVhd=true`.** That is the same feature WSL refuses on existing distros because of a data-corruption risk (section 3). If the vhdx ever needs shrinking, use `diskpart compact vdisk` instead.

### 4.4 Execution log

| Step | Status | Date | Notes |
| --- | --- | --- | --- |
| **B0a** — `git init` + commit | ✅ **Done** | 09-09 | Commits on `main`; `core.autocrlf=input` set |
| **B0b** — attach remote | ✅ **Done** | 09-09 | `origin` → `github.com/nguyenchiemhao/Ei-AI` |
| **B0c** — first push | 🔴 **Not done** | | **Blocked on one answer: is the repository public or private?** The content includes the full system design, effort estimates and pilot-customer information |
| **B1** — free ≥45 GB on `C:` | ✅ **Done** | 09-09 | Images 47.1 → 4.6 GB (32 → 2), volumes 25.7 → 0.9 GB (52 → 4), build cache 28.4 → 0 GB. `C:` at 50 GB free |
| **B2** — `.wslconfig` | 🟡 **Written, not applied** | 09-09 | Needs one `wsl --shutdown` |
| **B3** — install Ubuntu, move repository | 🔴 **Not done** | | ~15 minutes. Do B0c first |
| **B4** — Dev Containers + Remote-WSL | 🔴 **Not done** | | Two VS Code extensions, then open `~/ei-ai` |

---

## 5. Compose stack for `dev-hybrid`

Seven services. Only `infinity` is given the GPU.

```yaml
# infra/compose/docker-compose.yml (abridged — core services only)
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: eiai
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ../postgres/init:/docker-entrypoint-initdb.d:ro   # CREATE EXTENSION vector, unaccent
    ports: ['5432:5432']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d eiai']
      interval: 10s

  redis:
    image: redis:7.4-alpine
    command: redis-server --save 60 1 --appendonly no
    ports: ['6379:6379']

  infinity:
    image: michaelf34/infinity:0.0.76          # pin the exact patch at setup time
    command: >
      v2
      --model-id BAAI/bge-m3
      --model-id BAAI/bge-reranker-v2-m3
      --batch-size 8
      --port 7997
    environment:
      HF_HOME: /models
    volumes:
      - models:/models                          # cache weights, avoid re-downloading
    ports: ['7997:7997']
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  squid:
    image: ubuntu/squid:6.6-24.04_beta          # Phase 1 — the only route out
    volumes:
      - ../squid/squid.conf:/etc/squid/squid.conf:ro
      - squidlogs:/var/log/squid
    ports: ['3128:3128']

  api:
    build: { context: ../.., dockerfile: apps/api/Dockerfile, target: dev }
    command: pnpm --filter api start:dev
    env_file: ../../.env
    volumes:
      - ../..:/workspace                        # source
      - api_node_modules:/workspace/node_modules        # NOT bind-mounted
      - api_pkg_modules:/workspace/apps/api/node_modules
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    ports:
      - '3000:3000'
      - '9229:9229'                             # Node inspector for the debugger
    # Phase 1 onward: no default route. All egress goes through squid.
    environment:
      HTTP_PROXY: http://squid:3128
      HTTPS_PROXY: http://squid:3128

  ingest-worker:
    build: { context: ../.., dockerfile: apps/api/Dockerfile, target: dev }
    command: pnpm --filter api start:worker     # same image, different entrypoint
    env_file: ../../.env
    volumes:
      - ../..:/workspace
      - api_node_modules:/workspace/node_modules
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }

  parser:
    build: { context: ../.., dockerfile: apps/parser/Dockerfile }
    env_file: ../../.env
    volumes:
      - ../../apps/parser:/app
    depends_on:
      redis: { condition: service_started }

  web:
    build: { context: ../.., dockerfile: apps/web/Dockerfile, target: dev }
    command: pnpm --filter web dev --host 0.0.0.0
    volumes:
      - ../..:/workspace
      - web_node_modules:/workspace/node_modules
      - web_pkg_modules:/workspace/apps/web/node_modules
    ports: ['5173:5173']

  # Profile `dev-local` only. Not started by default.
  llamacpp:
    profiles: ['dev-local']
    image: ghcr.io/ggml-org/llama.cpp:server
    command: >
      -m /models/qwen3-4b-instruct-q4_k_m.gguf
      --host 0.0.0.0 --port 8080
      --ctx-size 8192
      --threads 12
      --jinja
    volumes:
      - models:/models                          # GGUF must be downloaded here first
    ports: ['8080:8080']

volumes:
  pgdata:
  models:
  squidlogs:
  api_node_modules:
  api_pkg_modules:
  web_node_modules:
  web_pkg_modules:
```

**Two Compose profiles, and what each is for:**

| Command | Services started | Profile |
| --- | --- | --- |
| `docker compose up` | postgres, redis, infinity, squid, api, ingest-worker, parser, web | `dev-hybrid` (default) |
| `docker compose --profile dev-local up` | the above **plus** llamacpp | `dev-local` |
| `docker compose -f docker-compose.yml -f compose.gpu.yml up` | the above **plus** vllm | `prod` — fails on the laptop, correctly |

The GGUF for `dev-local` has to be fetched once into the `models` volume:

```bash
docker compose run --rm --entrypoint sh infinity -c \
  'wget -O /models/qwen3-4b-instruct-q4_k_m.gguf \
   https://huggingface.co/Qwen/Qwen3-4B-Instruct-GGUF/resolve/main/Qwen3-4B-Instruct-Q4_K_M.gguf'
```

**A detail that matters for the agentic loop:** `dev-local` must produce **schema-valid tool actions**, not just fluent prose. llama.cpp does this with grammar-constrained decoding (GBNF) plus `--jinja` for the tool-call template. `ModelProviderPort`'s `chooseAction()` contract is therefore satisfied locally by passing a grammar derived from the tool's `input_schema` — the same contract Anthropic satisfies with structured outputs. Neither adapter leaks its mechanism upward.

### 5.1 Squid configuration

The point of Squid in Phase 1 is that **the allowlist starts empty**, which makes FR-45 testable on day one.

```conf
# infra/squid/squid.conf
http_port 3128

# Allowlist is a separate file the API regenerates whenever allowlist_entries changes.
# It ships EMPTY. An empty allowlist means nothing gets out — that is the default posture,
# not a misconfiguration.
include /etc/squid/allowlist.conf

# Default deny. Must be the last rule.
http_access deny all

# Every request logged with destination and byte counts — feeds egress reconciliation (FR-46).
access_log /var/log/squid/access.log squid
logformat squid %ts.%03tu %6tr %>a %Ru %ssl::>sni %<st %>st
```

```conf
# infra/squid/allowlist.conf — generated, starts empty.
# After an Administrator adds api.anthropic.com, the API writes:
#
#   acl allowed_dst dstdomain api.anthropic.com
#   http_access allow allowed_dst
```

For `dev-hybrid` to reach the Anthropic API, `api.anthropic.com` must be seeded into `allowlist_entries` — deliberately, so that even the development environment exercises the allowlist path rather than bypassing it.

**Three details that are easy to miss, and all three hurt if missed:**

1. **`node_modules` must be a named volume, never bind-mounted.** Leave it bind-mounted and the container writes tens of thousands of files across the filesystem bridge. This is the number-one cause of "Docker is so slow" on Windows.
2. **Port 9229 must be exposed** so VS Code can attach a debugger to Node inside the container, with `remoteRoot: /workspace` in `launch.json`.
3. **If the source ever sits on `D:` (option C)**, polling must be enabled or HMR simply will not fire:
   ```bash
   CHOKIDAR_USEPOLLING=true
   WATCHPACK_POLLING=true
   ```
   With the source in WSL2 or a volume, **do not** set these — polling then only wastes CPU.

**The GPU profile** (`compose.gpu.yml`) is used only with real hardware; it adds `vllm` and switches `MODEL_PROFILE` to `prod`. On the laptop it cannot start, and **that is correct behaviour, not a bug**.

### 5.2 Dev Container

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "Ei-AI",
  "dockerComposeFile": ["../infra/compose/docker-compose.yml"],
  "service": "api",
  "workspaceFolder": "/workspace",
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-python.python",
        "bradlc.vscode-tailwindcss"
      ],
      "settings": {
        "typescript.tsdk": "/workspace/node_modules/typescript/lib"
      }
    }
  },
  "forwardPorts": [3000, 5173, 5432, 7997],
  "postCreateCommand": "pnpm install"
}
```

Pointing `typescript.tsdk` at the in-container `node_modules` is what gives the IDE working autocomplete and correct type errors. Omitting that line is the most common trap with this approach.

---

## 6. The 4 GB VRAM budget

| Component | VRAM | Notes |
| --- | --- | --- |
| BGE-M3 weights (fp16) | ~1.15 GB | 568M parameters |
| BGE-reranker-v2-m3 weights (fp16) | ~1.15 GB | 568M parameters |
| Activation + batch buffer | ~0.5–0.8 GB | Depends on batch size |
| CUDA context overhead | ~0.3 GB | |
| **Total** | **~3.1–3.4 GB** | Fits within 4 GB, but **tight** |

**Three things keep it from overflowing:**

1. Keep the batch size low: `--batch-size 8` for Infinity. Throughput is not a concern on a small development corpus.
2. If it still overflows: load the reranker at int8 (~0.6 GB), or move it to CPU — acceptable at development corpus size.
3. **Do not run games, Stable Diffusion or any other GPU tool at the same time.** 4 GB does not divide.

The first measurement of week 1 is the real number: `nvidia-smi --query-gpu=memory.used --format=csv` with both models loaded. Record it.

---

## 7. Environment variables

```bash
# .env.example — commit this file, never commit .env

# --- Database & queue (service names, not localhost — everything runs in Docker) ---
DATABASE_URL=postgresql://postgres:changeme@postgres:5432/eiai
REDIS_URL=redis://redis:6379

# --- Egress (Phase 1 onward: the only route out) ---
HTTP_PROXY=http://squid:3128
HTTPS_PROXY=http://squid:3128
NO_PROXY=postgres,redis,infinity,parser,localhost,127.0.0.1

# --- Retrieval (always local, every profile) ---
EMBEDDING_BASE_URL=http://infinity:7997
EMBEDDING_MODEL=BAAI/bge-m3
RERANK_MODEL=BAAI/bge-reranker-v2-m3
RETRIEVAL_CANDIDATE_LIMIT=60
RETRIEVAL_KEEP_TOP=8
RETRIEVAL_RELEVANCE_FLOOR=0.35

# --- Agent loop ---
AGENT_BUDGET_MS=120000
AGENT_BUDGET_STEPS=12
AGENT_LOOP_DETECT_THRESHOLD=3
AGENT_INVALID_ACTION_RETRIES=2

# --- Generation ---
# dev-hybrid | dev-local | prod
MODEL_PROFILE=dev-hybrid

# dev-hybrid: Anthropic via ModelProviderPort
ANTHROPIC_API_KEY=              # NEVER commit
GENERATION_MODEL=claude-haiku-4-5
VERIFIER_MODEL=claude-haiku-4-5
CEILING_MODEL=claude-sonnet-5   # only for ceiling measurement

# dev-local: llama.cpp, also a Compose service
LOCAL_GENERATION_BASE_URL=http://llamacpp:8080
LOCAL_GENERATION_MODEL=qwen3-4b-instruct-q4_k_m

# --- Approval ---
APPROVAL_EXPIRY_MS=900000

# --- Auth ---
JWT_SECRET=                     # generate with: openssl rand -base64 48
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=8h

# --- Internal tools (always available, cannot be disabled) ---
# The three internal tools of Phase 2. They need no network and no configuration,
# which is what makes the `document-only` operating mode possible (ADR-10).
TOOL_SEARCH_DOCUMENTS_ENABLED=true
TOOL_READ_DOCUMENT_PAGE_ENABLED=true
TOOL_LIST_WORKSPACE_DOCUMENTS_ENABLED=true

# --- Optional tools (off by default — ADR-10) ---
# web_search additionally requires an allowlist_entries row for the search provider.
TOOL_WEB_SEARCH_ENABLED=false
# MCP tools are discovered, never configured here. Zero registered servers is a
# supported configuration, not a degraded one (FR-75).

# --- Feature flags ---
FEATURE_AGENT_LOOP=coming_soon
FEATURE_VERIFIED_ANSWERS=coming_soon
FEATURE_APPROVALS=coming_soon
FEATURE_CONNECTORS=coming_soon
```

**Operating mode is derived, never configured.** There is no `OPERATING_MODE` variable. The Tool registry computes the mode at the start of every turn from which tools are actually enabled and reachable, so it always reflects reality rather than an operator's intention. With the values above the mode is `document-only`, which is the default install and the default CI scenario.

### 7.1 Why `claude-haiku-4-5` is the development default rather than Sonnet or Opus

This is counter-intuitive and important.

The production target is a locally hosted ~32B model. Developing against the strongest available model means writing prompts that lean on capability production will not have, turning the Phase 4 swap into a cliff. Choosing a capability tier closer to a local 32B model makes that swap a step instead.

`claude-sonnet-5` has one job: **ceiling measurement**. Run the golden set against it whenever you need to know whether a weak result is the prompt or the model. If Sonnet fails in the same place, the fault is in retrieval or in the prompt — and that is far more useful information than a high score.

We do not guess the gap between models. **The eval harness measures it**, from week 10, across all three options.

### 7.2 Three mandatory controls on the "strong in dev, weak in prod" risk

1. **Every phase gate runs the golden set on both `dev-hybrid` and `dev-local`.** The gap between them is a continuously tracked metric, not a week-20 surprise.
2. **No prompt may depend on a provider-specific feature.** The verifier returns JSON against a schema we define. Using one provider's citation API would leak provider detail into the business layer and make the swap painful.
3. **Phase 1–2 latency figures are never used to draw conclusions about production.** Every eval report states which profile produced which number.

---

## 8. Performance expectations — and what must not be concluded from them

| Metric | On the demo machine (`dev-hybrid`) | On real hardware (`prod`) |
| --- | --- | --- |
| Embedding throughput | Measure in week 1. Estimate 40–80 chunks/second at batch 8 | Considerably higher — bigger GPU, bigger batches |
| Rerank of 60 candidates | ~200–400 ms | ~50–100 ms |
| First agent step visible | Dominated by network and API, not by this machine | **The only number that means anything for NFR-01, and only measurable on `prod`** |
| Complete turn | Depends on step count and API latency | The real NFR-02 measurement |
| Ingest a 400-page PDF | Slow — the parser and OCR are CPU-bound, and the CPU is also running everything else | Faster, and parallelisable |

**Do not use demo-machine figures to:** conclude whether NFR-01 or NFR-02 is met; promise ingest times to a customer; or size the GPU for the pilot. All three become possible only once real hardware exists — **milestone: before week 16**.

---

## 9. Verification

Every check below is a command with an expected result. A check that cannot be run is not a check — if you cannot produce the expected output, the environment is not ready, regardless of how it looks.

### 9.1 Prerequisites — run in order

| # | Command | Expected |
| --- | --- | --- |
| **B0c** | `git push -u origin main` | Push succeeds. **Blocked until the repository visibility question is answered** |
| **B1** | `Get-PSDrive C` | ✅ Already done — ≥45 GB free (measured 50 GB on 09-09) |
| **B2** | `wsl --shutdown` then `wsl --list --verbose` | All distros `Stopped`; on next start the `.wslconfig` limits apply |
| **B3** | `wsl --install -d Ubuntu` | Ubuntu appears in `wsl --list --verbose` as `Running`, `VERSION 2` |
| **B3** | In Ubuntu: `git clone … ~/ei-ai && cd ~/ei-ai && git log --oneline` | Full commit history present |
| **B3** | `df -T ~/ei-ai \| tail -1` | Filesystem type is `ext4`, **not** `9p` or `drvfs`. This is the check that ADR-13's condition actually holds |
| **B4** | `code ~/ei-ai` | VS Code opens; bottom-left shows `WSL: Ubuntu` |
| — | `docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu24.04 nvidia-smi` | The RTX 3050 Ti is listed with 4096 MiB |

### 9.2 Stack brings itself up

```bash
cd ~/ei-ai
docker compose up -d postgres redis infinity squid
docker compose ps
```

| Check | Expected |
| --- | --- |
| `docker compose ps` | All four services `running`; postgres shows `healthy` |
| `docker compose exec postgres psql -U postgres -d eiai -c "\dx"` | Extensions `vector` and `unaccent` both listed |
| `docker compose exec postgres psql -U postgres -d eiai -c "\dt"` | Every table from the migrations, including `agent_steps`, `tools`, `allowlist_entries`, `write_snapshots` |

### 9.3 Retrieval services answer

```bash
# Embedding — expect a 1024-dimension vector
curl -s http://localhost:7997/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"BAAI/bge-m3","input":["hợp đồng nhà cung cấp hết hạn"]}' \
  | jq '.data[0].embedding | length'

# Rerank — expect descending scores, contract first
curl -s http://localhost:7997/rerank \
  -H 'Content-Type: application/json' \
  -d '{"model":"BAAI/bge-reranker-v2-m3",
       "query":"hợp đồng hết hạn khi nào",
       "documents":["Hợp đồng này có thời hạn đến 31/12/2026","Quy trình nghỉ phép hàng năm"]}' \
  | jq '.results[].relevance_score'
```

| Check | Expected |
| --- | --- |
| Embedding dimension | `1024` |
| Rerank ordering | The contract sentence scores higher than the leave-policy sentence |
| **Real VRAM in use** | `nvidia-smi --query-gpu=memory.used --format=csv` with both models loaded. **Record the number** — the budget in section 6 predicts 3.1–3.4 GB of 4096 MiB |

### 9.4 Egress default-deny actually denies

This is the single most important check of Phase 1, because it proves FR-45 at the network layer rather than in application code.

```bash
# From inside the api container, with an EMPTY allowlist
docker compose exec api sh -c 'curl -s -o /dev/null -w "%{http_code}\n" https://api.anthropic.com/v1/messages'

# Then read the proxy log
docker compose exec squid tail -5 /var/log/squid/access.log
```

| Check | Expected |
| --- | --- |
| Request from `api` | **Fails** — Squid returns `403`, not a connection to Anthropic |
| Squid access log | A `TCP_DENIED` line naming `api.anthropic.com` |
| After seeding `api.anthropic.com` into `allowlist_entries` and regenerating | Same request succeeds; the log shows an allowed entry with byte counts |

**If the first request succeeds against an empty allowlist, the environment is wrong** — the `api` container still has a default route, and the product's core promise is not being enforced.

### 9.5 The development loop is actually fast

These are the checks that decide whether ADR-13's condition was met, and they are the reason option A was chosen over option C.

| Check | Command / action | Expected |
| --- | --- | --- |
| **HMR latency** | Edit a string in a React component, watch the browser | **Under 1 second.** Over 3 seconds means the source is not on ext4 — re-check 9.1's `df -T` |
| No polling needed | `docker compose exec web env \| grep -i polling` | **Empty.** If `CHOKIDAR_USEPOLLING` is set, the source is on the Windows side |
| Debugger attaches | VS Code attach to `localhost:9229`, set a breakpoint in a controller, hit the endpoint | Execution stops at the breakpoint with correct source mapping |
| IDE type checking | Hover a typed symbol; introduce a deliberate type error | Autocomplete works and the error appears inline. If not, check `typescript.tsdk` in `devcontainer.json` |
| Case sensitivity | `touch Foo.ts` then `ls foo.ts` | **Fails** — ext4 is case-sensitive like production, so import-casing bugs surface locally rather than in CI |

### 9.6 `document-only` operating mode

The default install must be a working product with no MCP server and no web search. This is a Phase 2 gate criterion (plan §5.5) but the check belongs here because it is an environment property.

```bash
# Confirm zero MCP servers and no web search
docker compose exec postgres psql -U postgres -d eiai \
  -c "SELECT count(*) FROM mcp_servers;"
docker compose exec postgres psql -U postgres -d eiai \
  -c "SELECT name, enabled, classification FROM tools ORDER BY name;"
```

| Check | Expected |
| --- | --- |
| `mcp_servers` count | `0` — and nothing is broken because of it |
| `tools` | Exactly three rows, all `read`, all `enabled`: `list_workspace_documents`, `read_document_page`, `search_documents` |
| `GET /me` | Reports operating mode `document-only` |
| Health endpoint | MCP indicator reads `not_configured`, **not** `unreachable`. No alert fires, no email is sent (FR-78) |
| All 19 screens | Open without error; unbuilt ones show a "Coming soon" panel |

### 9.7 `dev-local` profile starts and produces valid actions

Run at every phase gate, not only once.

```bash
docker compose --profile dev-local up -d llamacpp
curl -s http://localhost:8080/health
```

| Check | Expected |
| --- | --- |
| `llamacpp` health | `{"status":"ok"}` |
| A schema-constrained completion | Returns JSON that validates against a tool's `input_schema`. **This is the check that matters** — fluent prose from a 4B model is not the point; a schema-valid action is |
| Golden set on `dev-local` vs `dev-hybrid` | Both scores recorded. **The gap is the tracked metric**, per section 7.2 |

### 9.8 Corpus and week-1 measurements

- [ ] Build the proxy corpus: 30–50 scanned legal PDFs (Vietnamese diacritics, stamps, multi-column), 10–20 report documents with real tabular layout, a set of `.md` files
- [ ] Run Docling + Tesseract over it out-of-band; record accuracy against a hand-transcribed reference
- [ ] Record actual embedding throughput in chunks/second

### 9.9 End-of-week-1 report

Five numbers. **They decide whether anything in the plan has to change.**

| # | Number | Where it came from | What it changes |
| --- | --- | --- | --- |
| 1 | Real VRAM in use with both models loaded | 9.3 | If over ~3.6 GB, drop the reranker to int8 or move it to CPU |
| 2 | Embedding throughput, chunks/second | 9.8 | Sets the realistic ingest time for the proxy corpus |
| 3 | OCR accuracy on the proxy corpus | 9.8 | **Below 90% triggers the R-01 fallback** — commercial OCR, or a narrower v1 format list |
| 4 | HMR latency | 9.5 | Over 3 seconds means the source is on the wrong filesystem |
| 5 | Empty-allowlist denial confirmed | 9.4 | If it does not deny, Phase 1 cannot close |

---

## 10. Still open

| # | Item | Status | Needed by |
| --- | --- | --- | --- |
| — | ~~Where the source lives~~ | **Decided: option A** (Ubuntu WSL2, `~/ei-ai`) · 2026-09-08 | — |
| 1 | **Is the GitHub repository public or private?** | Blocking B0c | **Now** |
| 2 | **Anthropic API key** for the development environment | Not available | **Week 1** |
| 3 | Execute B2, B3, B4 | Not started | **Week 1** |
| 4 | Real customer documents to close R-01 | Not available | **Week 8** |
| 5 | Real ERP MCP tool catalogue | Not available | Week 10 |
| 6 | Hardware tier and budget for the pilot | Not decided | **Week 16** |

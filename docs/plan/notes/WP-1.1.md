# WP-1.1 · Repo, toolchain, Compose stack, Dev Container

Opened 2026-09-12. Authorities: [Detail](../ei-ai-phase-1-detail.md) §2 · [Tasks](../ei-ai-phase-1-tasks.md) §3 · [Progress](../ei-ai-progress.md) §4.3.

## Contradictions found on opening

- 2026-09-12 — E-4 stood ✅ in [Progress §2.1](../ei-ai-progress.md) while `docker ps` failed: Docker Desktop was stopped, and with it stopped `docker` is absent from the distro entirely — only the Windows shim on PATH. Re-verified green the same day (29.4.3, Compose v5.1.3, GPU visible); the row now states the dependency on Docker Desktop running, against a plan that reads E-4 as a one-time condition.
- 2026-09-12 — no Node and no pnpm inside the Ubuntu distro, and `npm` on PATH resolves to a dead Windows path, against `T-1.1-01`'s "Done when" of `pnpm install` at the root — while ADR-13 promises a machine needing only Docker and VS Code and the Dev Container that would supply pnpm is `T-1.1-12`, the last task of the package.
- 2026-09-12 — the Anthropic key is "needed by Week 1" in [dev env §10](../ei-ai-dev-environment.md), against week 7 in [overview §9](../ei-ai-phase-1-overview.md) and `Q-04`; concretely, `.env.example` ships `ANTHROPIC_API_KEY=` empty with `MODEL_PROFILE=dev-hybrid` as the default, against `T-1.1-04`'s fail-fast boot on any missing variable.
- 2026-09-12 — `T-1.1-08` and [detail §2](../ei-ai-phase-1-detail.md) pin "postgres 17.2 + pgvector 0.8.0", against the `pgvector/pgvector` tag scheme, which publishes against the Postgres major (`0.8.0-pg17`) and not the patch. Unverified against the registry at the time of writing.
- 2026-09-12 — `.gitignore` is listed as a deliverable of `T-1.1-01` but already exists, and its comments are Vietnamese, against CLAUDE.md's "comments in English".

- 2026-09-14 — the images contradict their own tags, confirmed by running them: `pgvector/pgvector:0.8.0-pg17` contains **PostgreSQL 17.6**, not the 17.2 the plan names, and `ubuntu/squid:6.6-24.04_beta` contains **Squid 6.13**, not 6.6. Both are pinned by digest, which is what makes the versions knowable at all.
- 2026-09-14 — `T-1.1-09` requires Infinity to answer with a 1024-dimension vector, but `T-1.1-10` puts it on an `internal: true` network where it cannot fetch its weights; the plan warns about this in WP-1.1's "Watch for" without giving it a task. Weights were fetched by running the pinned image once on the default network before the lock.

- 2026-09-14 — **Docker silently refuses to publish host ports for a container attached only to an `internal: true` network.** `docker inspect` shows `HostConfig.PortBindings` carrying 3000 and 9229 while `NetworkSettings.Ports` is empty, with no warning anywhere. T-1.1-10 puts `web` and `api` on that network, and the Phase 1 milestone requires a browser on the host to reach both — the two cannot hold at once. Raised as an open question rather than resolved, because the answer changes the shape of an interface.

## Interpretations

- 2026-09-14 — `ubuntu/squid` publishes only `_beta` and `_edge` tags (all 11, from 5.6 to 7.2), so "Squid 6.x stable" in detail §2 cannot be met by that image. Read the suffix as the image's publication channel rather than the state of Squid — 6.6 is an upstream stable release — and take C-2's real intent to be "no floating tag", satisfied by pinning `6.6-24.04_beta@sha256:6a097f68…`.
- 2026-09-14 — `pgvector/pgvector` tags name the Postgres **major** (`0.8.0-pg17`), never the patch, so "postgres 17.2" is not expressible. Pin the digest instead and record the real patch from `SELECT version()`.
- 2026-09-14 — `T-1.1-06` must serve on 5173 in wave 1 while the Vite app is created by `T-3.6-01` in wave 2, so `T-1.1-06` creates the minimal Vite app it needs and `T-3.6-01` adds React 19, Tailwind and shadcn on top of it.
- 2026-09-14 — `infra/postgres/init/` and `001_extensions.sql` both create extensions; both are written `IF NOT EXISTS`, the init script so a bare `docker compose up` yields a usable database, the migration remaining the single source of truth.
- 2026-09-14 — `ANTHROPIC_API_KEY` is `z.string().optional()` in Phase 1 because no code path reads it; `T-1.1-04`'s fail-fast proof uses `DATABASE_URL`, as its "Done when" already specifies. It tightens in week 7.
- 2026-09-14 — the corepack bundled with Node 22.13.1 cannot verify current npm signing keys (`Cannot find matching keyid`), so every image that needs pnpm runs `npm install -g corepack@latest` before `corepack enable`.
- 2026-09-14 — `pnpm` is pinned exactly (`packageManager: pnpm@10.34.5`) rather than to the `10` range, so the version is a property of the repository and not of whoever runs corepack.
- 2026-09-14 — `iproute2` is installed in the api image's **dev** target only. Without `ip`, the C-1 proof `ip route | grep -c default` prints 0 because grep read empty input — a false green on the invariant the check exists to defend. The prod target stays clean.
- 2026-09-14 — Squid drops privileges to user `proxy` and cannot open `/dev/stdout`, so `access_log` writes to `/var/log/squid/access.log`, which the image's own entrypoint tails to stdout.
- 2026-09-14 — `docling==2.15.1` with an open `docling-core` makes pip walk backwards through every docling-core release without terminating, so `docling-core[chunking]==2.14.0` is pinned alongside it.
- 2026-09-14 — the first `pnpm install` runs in a throwaway `node:22.13.1-bookworm-slim` container with corepack, so nothing is installed into the distro and ADR-13 holds while the Dev Container (`T-1.1-12`) does not yet exist.
- 2026-09-14 — `tsBuildInfoFile` points inside `dist`. Left at the package root it outlives a wiped `dist`, and `tsc` then reports "Found 0 errors" while emitting nothing, so the app dies on a missing `main.js` — a failure that reads as a compile success.

## Deviations

- 2026-09-14 — `T-2.2-02` and `T-2.2-03` (Squid service and empty allowlist, 6 h, both wave 1) are executed inside this package because WP-1.1's proving command starts `squid` and cannot pass without them. Their hours stay accounted to WP-2.2.
- 2026-09-14 — WP-1.1's proving command is amended to start `api` as well: as written it runs `docker compose exec api` after an `up` that never started `api`.
- 2026-09-14 — `apps/api/dist` is a named volume rather than part of the bind mount, because emitting across the WSL2 boundary lands after the watcher has already tried to start the app.
- 2026-09-14 — a single `ingress` service (nginx, pinned by digest) on both `backend` and a new `ingress` network is the answer to the internal-network port problem: `web` and `api` stay internal with no default route, and the only container that straddles the boundary inward is not product code — the mirror image of Squid straddling it outward. Host ports are **4173** (web) and **4180** (api), chosen because 3000 and 8080 are taken by other projects on this machine.
- 2026-09-14 — nginx resolves `proxy_pass` names once at startup, so upstreams are held in variables with `resolver 127.0.0.11 valid=10s`; without it a recreated container keeps receiving traffic at its old address.
- 2026-09-14 — a signal handler does not keep Node's event loop alive: the worker exited 0 immediately after boot, looking like a crash. It now holds a ref'd timer until SIGTERM.
- 2026-09-14 — `nest --watch` reaps its child through `ps`, absent from `node:*-slim`, so the watcher died on the first file change and took the app with it. `procps` joins `iproute2` in the dev target.

## Tradeoffs

- 2026-09-14 — `llamacpp` runs the CPU `:server` build with `-c 4096`, dropping the CUDA build and the model's full 262k context: the card already carries both embedding models, and sizing the KV cache to the advertised context OOM-kills the container under the 18 GB WSL cap (exit 137).

- 2026-09-14 — chose to drop `${...}` interpolation from compose and hand postgres the root `.env` through `env_file`, dropped an interpolated `POSTGRES_PASSWORD`, because the Dev Container starts compose with no `--env-file` and an interpolated secret makes the whole file fail to parse before a single service is created. The cost is that the postgres container sees variables it does not need; the alternative was a second `.env`, which is exactly the drift C-4 was raised against.

- 2026-09-14 — chose to pin `ubuntu/squid:6.6-24.04_beta` by digest, dropped building Squid from `ubuntu:24.04` with an apt-pinned version, because the second costs about 4 h outside the plan to remove a word from a tag rather than a risk from the image.
- 2026-09-14 — chose to keep pgvector at the planned 0.8.0 by digest, dropped upgrading to the available 0.8.6, because a version bump is scope the package was not given.

## Open questions

- 2026-09-12 — how is the first `pnpm install` proved before the Dev Container exists: a throwaway `node:22.13` container, or corepack installed in the distro? · needed by `T-1.1-01`
- 2026-09-12 — is `ANTHROPIC_API_KEY` optional in the zod schema, or required only when generation is actually enabled? · needed by `T-1.1-04`
- 2026-09-12 — which exact `pgvector/pgvector` tag and digest pins Postgres 17.2, and if none does, is the pin the major plus a digest? · needed by `T-1.1-08`
- 2026-09-12 — `docs/plan/tools/task-order.py` is referenced by [Tasks §2](../ei-ai-phase-1-tasks.md) but absent, so the wave order cannot be recomputed after a task split: written here, or is the claim dropped? · needed before the first `a`/`b` split
- 2026-09-14 — detail §7's tree names `infra/compose/compose.gpu.yml`, and the gate asks that **both profiles start, default and `--profile dev-local`**, but no Phase 1 task creates the `llamacpp` service or fills that file. The GPU reservation now sits in the service itself (a plain `docker compose up` is what the gate runs, and an overlay would hand it a CPU-bound embedder), and the file was removed. · needed before the Phase 1 gate
- 2026-09-14 — `T-1.1-12`'s "Done when" is a GUI action — open the folder in the container, hit a breakpoint. It cannot be proved from a shell and stays manual, like dev env steps B4a/B4b. · needed before WP-1.1 closes
- 2026-09-14 — how does a browser on the host reach `web` (5173) and `api` (3000) when both sit on an `internal: true` network that silently drops published ports? The milestone says clone, `docker compose up`, log in. **Resolved 2026-09-14 by adding the ingress service** — the second of the three options. It is new scope no Phase 1 task named, so it needs confirming at the gate: either `T-1.1-10` grows to cover ingress, or it becomes a task of its own with an id.

---

## Gate · closed 2026-09-14

Reviewed and accepted: 12 tasks of WP-1.1 plus T-2.2-02 and T-2.2-03, borrowed. Dev Container
confirmed by hand. The `ingress` service accepted provisionally.

**Promoted to [CLAUDE.md](../../../CLAUDE.md)** — two new sections, six rules, in force from the
next package: a check that can pass for the wrong reason, "Up" is not "working", pin by digest,
pin what your pin drags in, pulling a task forward for a proving command, and unnamed scope
being provisional until a gate.

**Promoted to [Progress §3](../ei-ai-progress.md)** — Q-07 the ingress service, Q-08 the missing
`task-order.py`, Q-09 the `dev-local` profile with no task behind it.

Nothing else moved.

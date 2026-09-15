# WP-2.2 · Egress default-deny

Opened 2026-09-15. Authorities: [Detail §3](../ei-ai-phase-1-detail.md) · [Tasks §4](../ei-ai-phase-1-tasks.md) · [Detail §11](../ei-ai-phase-1-detail.md) test plan · [Progress §4.3](../ei-ai-progress.md).

`T-2.2-02` and `T-2.2-03` were executed early inside WP-1.1 and closed at its gate. Four tasks remain.

## Contradictions found on opening

- 2026-09-15 — **the package's proving command cannot run, and it fails in the direction that looks like success.** [Detail §3](../ei-ai-phase-1-detail.md) calls it "the single most important check in Phase 1" and writes it with `curl`, which **is not installed in the api image** (`node:*-slim` carries neither `curl` nor `ip`). `curl: not found` exits non-zero, the `|| echo BLOCKED` fires, and the check prints `BLOCKED` while having tested nothing. This is the same shape as the C-1 defect the project already learned from — `ip route | grep -c default` printing `0` on empty input — now sitting on the invariant Phase 1 cannot close without.
- 2026-09-15 — **`T-2.2-02` was closed without its log volume.** Its "Done when" asks for the Squid service "with a log volume"; the service as written mounts only the two config files, so `/var/log/squid/access.log` lives in the container's writable layer and a `docker compose down` destroys it. The log exists and grows (12 099 bytes today), so half the check passed and the other half was not looked at. FR-46 reconciles egress against approvals from that log.
- 2026-09-15 — **no CI stage has a home for the network test.** `T-2.2-06` says "wire the network test into CI" and [detail §11](../ei-ai-phase-1-detail.md) records it as "1 test, in CI", but the nine stages of design §11.2 have no network stage. The only plausible host is stage 7, which is `T-5.4-01` in **G5 — the pre-agreed cut**, the same collision WP-1.3 hit with stage 6 and resolved by not depending on G5.
- 2026-09-15 — the `squid.conf` in the tree is the minimum needed to boot and deny, written while borrowing `T-2.2-02`. The custom log format of **C-3** and the full ACL set are still `T-2.2-01`'s work, as its README already states.

## Open questions

- 2026-09-15 — what does the proving command use instead of `curl`? Installing `curl` in the api image widens the attack surface of the container the invariant protects; using Node's own `fetch` tests the runtime that actually makes requests but not the shell path the plan wrote. · **blocks `T-2.2-04`**
- 2026-09-15 — where does the network test run in CI, given stage 7 belongs to G5? A tenth stage contradicts design §11.2's numbering; folding it into stage 6 mixes migrations with networking. · **blocks `T-2.2-06`**
- 2026-09-15 — does `T-2.2-02` reopen for its log volume, or does the volume land in `T-2.2-01` with the rest of the logging configuration? · needed before the package closes
- 2026-09-15 — the allowlist API is Administrator-only, but `RolesGuard` is `T-3.2-02` in WP-3.2, wave 10. What enforces the role for `POST /egress/allowlist` in the meantime? · **blocks `T-2.2-05`**

## Interpretations

- 2026-09-15 — the proving command runs Node's `fetch` inside `api` plus a throwaway `curlimages/curl` container on the backend network, rather than `curl` inside `api`. `curl` is not in `node:*-slim`, so the command as written in detail §3 prints `BLOCKED` from `command not found` — and `fetch` is the path the product itself takes, which is what C-1 is about.
- 2026-09-15 — the network check rides in CI as **stage 6b** rather than a tenth stage or stage 7. Design §11.2 numbers nine stages and none is a network stage; stage 7 belongs to G5, the pre-agreed cut, and an invariant in G2 must not depend on it.
- 2026-09-15 — `verify-egress.sh` asserts only that internal DNS resolves the services the invocation actually runs (`RESOLVE_NAMES`, default `postgres redis`). Whether every backend service resolves is `T-1.1-10`'s check, closed at the WP-1.1 gate; asserting it here made the script fail on CI purely because the job starts `api` and `squid` alone.

## Deviations

- 2026-09-15 — Compose mounts `infra/squid/` as a **directory** at `/etc/squid/eiai` and Squid runs with `-f /etc/squid/eiai/squid.conf`, instead of bind-mounting the two config files. **A single-file bind mount pins an inode:** an edit that writes a new file and renames it — `git checkout`, `sed -i`, most editors — leaves the container reading the old content, so a reload reports success while a destination just removed is still permitted. Observed directly: with a clean `allowlist.conf` on disk the proxy still logged `TCP_MISS/200` for `example.com`. The boundary failed open and nothing reported it.
- 2026-09-15 — `T-2.2-05` is not built; the allowlist routes answer `501` until `T-3.2-02` provides a guard over an authenticated principal.

## Tradeoffs

- 2026-09-15 — the https path is judged by Squid's own log verdict rather than by curl's status code, dropping the simpler single-check design. A denied `CONNECT` never yields an origin status, so curl reports `000` whether the refusal worked or the proxy was unreachable — a code that cannot distinguish success from failure is not worth asserting on.

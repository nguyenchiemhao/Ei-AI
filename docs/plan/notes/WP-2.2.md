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

- none yet

## Deviations

- none yet

## Tradeoffs

- none yet

# Squid — the only route out

The backend network is `internal: true`, so no container on it has a default route.
Squid is the single service joined to both networks and is therefore the only path
to anything outside the machine (ADR-09, FR-45).

## Empty means deny

`allowlist.conf` ships empty **and that is the working configuration**, not a
placeholder. With no destination listed, every outbound request is refused at the
network and Squid logs `TCP_DENIED`. Phase 1 closes only if that is demonstrably true
with the proxy environment variables removed — the denial must come from the network,
not from a client honouring `HTTP_PROXY`.

## Adding a destination

Until `T-5.2-01` generates this file from `allowlist_entries`, a destination is added
by hand and Squid reloaded:

```bash
docker compose exec squid squid -k parse        # validate before reloading
docker compose exec squid squid -k reconfigure
```

## What is not here yet

`squid.conf` currently carries the minimum needed to boot and deny. The custom log
format (**C-3** — Squid 6 refuses to start when `logformat` redefines a built-in name)
and the full ACL set belong to `T-2.2-01`.

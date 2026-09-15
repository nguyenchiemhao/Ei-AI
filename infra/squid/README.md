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

## The log format

`logformat eiai` carries a **distinct name** on purpose: redefining a built-in name such as
`squid` or `combined` makes Squid 6 refuse to start (**C-3**). The destination comes from `%ru`,
which holds the CONNECT target for tunnelled requests; `%ssl::>sni` is empty without `ssl_bump`
and is deliberately absent.

A refusal and a permitted request look like this:

```
… TCP_DENIED/403 CONNECT example.com:443 bytes_in=3394 bytes_out=114 peer=HIER_NONE/-
… TCP_MISS/200   GET http://example.com/ bytes_in=953  bytes_out=123 peer=HIER_DIRECT/104.20.23.154
```

The byte counts are what FR-46 reconciles against approvals, which is why the log lives in the
`squid-logs` volume and outlives the container.

## Adding a destination

Until `T-5.2-01` generates this file from `allowlist_entries`, a destination is added
by hand and Squid reloaded:

Add an `http_access allow` pair to `allowlist.conf` — the file holds complete rules, not bare
acl names, so an empty file matches nothing and the final `http_access deny all` catches
everything:

```
acl allow_example dstdomain .example.com
http_access allow allow_example
```

Then validate and reload, in that order. `squid -k parse` on a bad file leaves the running
configuration untouched:

```bash
docker compose exec squid squid -k parse        # validate before reloading
docker compose exec squid squid -k reconfigure
bash infra/scripts/verify-egress.sh             # must now fail — the boundary moved
```

Removing the lines and reloading closes it again.

## What is not here yet

`squid.conf` currently carries the minimum needed to boot and deny. The custom log
format (**C-3** — Squid 6 refuses to start when `logformat` redefines a built-in name)
and the full ACL set belong to `T-2.2-01`.

#!/usr/bin/env bash
# Proves the egress boundary from outside the application: no default route out of the backend
# network, service names still resolve, and a direct request fails at the network rather than
# at a convention. Exits non-zero the moment any of that stops being true.
set -uo pipefail

COMPOSE="docker compose -f ${COMPOSE_FILE:-infra/compose/docker-compose.yml}"
BACKEND_NETWORK="${BACKEND_NETWORK:-ei-ai_backend}"
CURL_IMAGE="curlimages/curl:8.11.1"
failures=0

check() {
  local name=$1 expected=$2 actual=$3
  if [ "$actual" = "$expected" ]; then
    printf '  ok    %-42s %s\n' "$name" "$actual"
  else
    printf '  FAIL  %-42s expected %s, got %s\n' "$name" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

# `ip` must exist or `grep -c default` counts an empty stream and reports a false zero.
assert_ip_present() {
  if ! $COMPOSE exec -T api sh -c 'command -v ip' >/dev/null 2>&1; then
    echo "  FAIL  iproute2 missing in api: the default-route check cannot run"
    exit 2
  fi
}

default_routes() { $COMPOSE exec -T api sh -c 'ip route | grep -c default' 2>/dev/null | tr -d '\r'; }

# Only that internal DNS works at all, against services this invocation actually runs. Whether
# every backend service resolves is T-1.1-10's check, proven at the WP-1.1 gate; asserting it
# here would make the egress script fail whenever the stack is brought up in part, as CI does.
RESOLVE_NAMES="${RESOLVE_NAMES:-postgres redis}"

resolvable_names() {
  $COMPOSE exec -T api sh -c "getent hosts $RESOLVE_NAMES | wc -l" 2>/dev/null | tr -d '\r'
}

# Node's fetch, not curl: undici ignores HTTP_PROXY unless a ProxyAgent is set (C-1), so this is
# the path the product itself would take, with the proxy variables deliberately unset.
direct_egress() {
  $COMPOSE exec -T -e HTTP_PROXY= -e HTTPS_PROXY= -e NO_PROXY= api node -e "
    fetch('https://api.anthropic.com/v1/messages', { signal: AbortSignal.timeout(5000) })
      .then((r) => console.log('LEAKED:' + r.status))
      .catch(() => console.log('BLOCKED'));
  " 2>/dev/null | tr -d '\r'
}

# Plain HTTP returns the refusal as a response curl can read. HTTPS is refused at CONNECT, where
# curl never sees an origin status at all, so that path is judged by Squid's own verdict instead.
proxied_http_egress() {
  docker run --rm --network "$BACKEND_NETWORK" "$CURL_IMAGE" \
    -s -o /dev/null -m 10 -w '%{http_code}' -x http://squid:3128 http://example.com 2>/dev/null
}

proxied_https_denied() {
  docker run --rm --network "$BACKEND_NETWORK" "$CURL_IMAGE" \
    -s -o /dev/null -m 10 -x http://squid:3128 https://example.com >/dev/null 2>&1
  if $COMPOSE exec -T squid tail -20 /var/log/squid/access.log 2>/dev/null \
     | grep -q 'TCP_DENIED[^ ]* CONNECT example.com:443'; then
    echo DENIED
  else
    echo NOT_DENIED
  fi
}

echo "egress verification"
assert_ip_present
check "api has no default route"            "0"       "$(default_routes)"
check "internal DNS resolves"               "$(echo $RESOLVE_NAMES | wc -w)" "$(resolvable_names)"
check "direct egress with proxy env removed" "BLOCKED" "$(direct_egress)"
check "proxied http refused by squid"        "403"     "$(proxied_http_egress)"
check "proxied https denied at CONNECT"      "DENIED"  "$(proxied_https_denied)"

if [ "$failures" -ne 0 ]; then
  echo "egress boundary is open in $failures place(s)"
  exit 1
fi
echo "egress boundary holds"

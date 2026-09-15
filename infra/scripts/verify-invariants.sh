#!/usr/bin/env bash
# The difference between "the constraint exists" and "the constraint refuses" is the whole
# point, so every check here breaks a rule on purpose and demands an error back. Each runs
# inside a transaction that is rolled back, so the script is repeatable against a live database.
set -uo pipefail

PSQL=${PSQL:-docker compose -f infra/compose/docker-compose.yml exec -T postgres psql -U postgres -d eiai}
failures=0

# A statement that silently affects nothing is the v1 failure mode this package exists to kill,
# so success here means an error was raised — never "UPDATE 0".
# Every check builds its own rows. Selecting from seeded tables instead made the whole suite
# depend on `seed` having run: against a migrated-but-unseeded database the inserts matched
# nothing, touched no constraint, and reported that the invariants had stopped holding.
FIXTURES="
  INSERT INTO users (email, display_name, password_hash, system_role)
    VALUES ('probe@invariants.local','Probe','x','Administrator');
"

expect_error() {
  local name=$1 sql=$2
  local out
  out=$($PSQL -v ON_ERROR_STOP=1 -c "BEGIN; $FIXTURES $sql ROLLBACK;" 2>&1)
  if printf '%s' "$out" | grep -q '^ERROR:'; then
    printf '  ok    %-46s %s\n' "$name" "$(printf '%s' "$out" | grep -m1 '^ERROR:' | cut -c1-58)"
  else
    printf '  FAIL  %-46s accepted, no error raised\n' "$name"
    failures=$((failures + 1))
  fi
}

expect_present() {
  local name=$1 sql=$2
  if [ "$($PSQL -tAc "$sql" 2>/dev/null | tr -d '\r')" = "1" ]; then
    printf '  ok    %-46s present\n' "$name"
  else
    printf '  FAIL  %-46s missing\n' "$name"
    failures=$((failures + 1))
  fi
}

echo "database invariants"

# S-3 was written in WP-1.2; it has no violation to provoke, only a shape to confirm.
expect_present "S-3 · approval_requests.decided_at" \
  "select count(*) from information_schema.columns where table_name='approval_requests' and column_name='decided_at'"
expect_present "S-3 · index predicate carries no subquery" \
  "select count(*) from pg_indexes where indexname='approval_requests_open' and indexdef like '%decided_at IS NULL%'"

expect_error "S-2 · two active pre-auths for one tool" "
  INSERT INTO tools (name, description, input_schema, classification, enabled, min_system_role)
    VALUES ('probe_read','probe','{}'::jsonb,'read',TRUE,'Member');
  INSERT INTO pre_authorisations (tool_id, classification, created_by, justification)
    SELECT t.id,'read',u.id,'one' FROM tools t, users u WHERE t.name='probe_read' AND u.email='probe@invariants.local' LIMIT 1;
  INSERT INTO pre_authorisations (tool_id, classification, created_by, justification)
    SELECT t.id,'read',u.id,'two' FROM tools t, users u WHERE t.name='probe_read' AND u.email='probe@invariants.local' LIMIT 1;"

expect_error "BR-05 · enabling a write tool" "
  INSERT INTO tools (name, description, input_schema, classification, enabled, min_system_role)
    VALUES ('probe_write','probe','{}'::jsonb,'write',TRUE,'Administrator');"

expect_error "S-4 · FR-44 · pre-auth for a write tool" "
  INSERT INTO tools (name, description, input_schema, classification, enabled, min_system_role)
    VALUES ('probe_w2','probe','{}'::jsonb,'write',FALSE,'Administrator');
  INSERT INTO pre_authorisations (tool_id, classification, created_by, justification)
    SELECT t.id,'write',u.id,'should be refused' FROM tools t, users u WHERE t.name='probe_w2' AND u.email='probe@invariants.local' LIMIT 1;"

# The CHECK above refuses classification='write' outright, so the composite key is proven
# separately: a 'read' pre-authorisation pointing at a write tool has no (id,'read') row to
# reference. Without this the FK could be absent and the suite would still pass.
expect_error "S-4 · FK · read pre-auth on a write tool" "
  INSERT INTO tools (name, description, input_schema, classification, enabled, min_system_role)
    VALUES ('probe_w3','probe','{}'::jsonb,'write',FALSE,'Administrator');
  INSERT INTO pre_authorisations (tool_id, classification, created_by, justification)
    SELECT t.id,'read',u.id,'no matching parent' FROM tools t, users u WHERE t.name='probe_w3' AND u.email='probe@invariants.local' LIMIT 1;"

# Disabled on purpose: an enabled tool would trip tools_no_write_in_v1 first and the check would
# pass without the foreign key ever being consulted.
expect_error "S-4 · reclassifying a pre-authorised tool" "
  INSERT INTO tools (name, description, input_schema, classification, enabled, min_system_role)
    VALUES ('probe_r2','probe','{}'::jsonb,'read',FALSE,'Member');
  INSERT INTO pre_authorisations (tool_id, classification, created_by, justification)
    SELECT t.id,'read',u.id,'held' FROM tools t, users u WHERE t.name='probe_r2' AND u.email='probe@invariants.local' LIMIT 1;
  UPDATE tools SET classification='write' WHERE name='probe_r2';"

expect_error "S-5 · UPDATE audit_events" "
  INSERT INTO audit_events (action, object_kind, correlation_id, hash)
    VALUES ('probe','probe',gen_random_uuid(),'\\x00'::bytea);
  UPDATE audit_events SET action='changed' WHERE action='probe';"

expect_error "S-5 · DELETE audit_events" "
  INSERT INTO audit_events (action, object_kind, correlation_id, hash)
    VALUES ('probe2','probe',gen_random_uuid(),'\\x00'::bytea);
  DELETE FROM audit_events WHERE action='probe2';"

if [ "$failures" -ne 0 ]; then
  echo "$failures invariant(s) do not hold"
  exit 1
fi
echo "all invariants refuse"

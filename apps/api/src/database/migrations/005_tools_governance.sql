-- Tool catalogue and the approval machinery. The constraints that make FR-44 real belong
-- to WP-2.1 and are added there; this file creates the shapes they attach to.

CREATE TABLE mcp_servers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,
    transport             TEXT NOT NULL CHECK (transport IN ('stdio', 'http', 'sse')),
    endpoint              TEXT NOT NULL,
    credential_enc        BYTEA,
    status                TEXT NOT NULL DEFAULT 'unknown'
                          CHECK (status IN ('unknown', 'healthy', 'unhealthy', 'disabled')),
    timeout_ms            INTEGER NOT NULL DEFAULT 10000
                          CHECK (timeout_ms BETWEEN 1000 AND 120000),
    rate_limit_per_minute INTEGER CHECK (rate_limit_per_minute > 0),
    last_seen_at          TIMESTAMPTZ,
    created_by            UUID NOT NULL REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mcp_servers_name_unique UNIQUE (name)
);

-- classification defaults to 'write': BR-08 fail-safe, an unclassified tool is the dangerous kind.
CREATE TABLE tools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mcp_server_id   UUID REFERENCES mcp_servers(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    input_schema    JSONB NOT NULL,
    classification  tool_classification NOT NULL DEFAULT 'write',
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    min_system_role TEXT NOT NULL DEFAULT 'Administrator'
                    CHECK (min_system_role IN ('Administrator', 'Knowledge Manager',
                                               'Approver', 'Member', 'Auditor')),
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (mcp_server_id, name)
);

ALTER TABLE agent_steps
    ADD CONSTRAINT agent_steps_tool_fk FOREIGN KEY (tool_id) REFERENCES tools(id);

CREATE TABLE pre_authorisations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id       UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    created_by    UUID NOT NULL REFERENCES users(id),
    justification TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at    TIMESTAMPTZ
);

-- decided_at is written by the decision path so the open-requests index needs no subquery (S-3).
CREATE TABLE approval_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turn_id       UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    agent_step_id UUID NOT NULL REFERENCES agent_steps(id) ON DELETE CASCADE,
    tool_id       UUID NOT NULL REFERENCES tools(id),
    payload       JSONB NOT NULL,
    reason        TEXT NOT NULL,
    requested_by  UUID NOT NULL REFERENCES users(id),
    expires_at    TIMESTAMPTZ NOT NULL,
    decided_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agent_step_id)
);

CREATE TABLE approval_decisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL UNIQUE REFERENCES approval_requests(id),
    decided_by          UUID NOT NULL REFERENCES users(id),
    decision            TEXT NOT NULL CHECK (decision IN ('approved', 'denied', 'expired')),
    reason              TEXT,
    decided_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Snapshot of the target system's object taken before a write tool runs, so the write can be
-- undone (Phase 3). Created empty now: an empty table costs nothing, a schema change in
-- week 20 costs days.
CREATE TABLE write_snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_step_id UUID NOT NULL REFERENCES agent_steps(id) ON DELETE CASCADE,
    tool_id       UUID NOT NULL REFERENCES tools(id),
    target_kind   TEXT NOT NULL,
    target_id     TEXT NOT NULL,
    before_state  JSONB NOT NULL,
    captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    reverted_at   TIMESTAMPTZ,
    reverted_by   UUID REFERENCES users(id),
    CONSTRAINT write_snapshots_step_unique UNIQUE (agent_step_id)
);

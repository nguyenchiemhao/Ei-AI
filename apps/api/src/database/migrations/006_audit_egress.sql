-- Audit and the egress boundary. The triggers that make audit_events append-only belong to
-- WP-2.1; the chain columns they protect are here.

CREATE TABLE audit_events (
    id             BIGSERIAL PRIMARY KEY,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_user_id  UUID REFERENCES users(id),
    actor_ip       INET,
    action         TEXT NOT NULL,
    object_kind    TEXT NOT NULL,
    object_id      TEXT,
    workspace_id   UUID REFERENCES workspaces(id),
    correlation_id UUID NOT NULL,
    detail         JSONB NOT NULL DEFAULT '{}'::JSONB,
    prev_hash      BYTEA,
    hash           BYTEA NOT NULL
);

-- FR-45. An empty table means deny everything; that is the shipped configuration, not a gap.
CREATE TABLE allowlist_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host       TEXT NOT NULL,
    port       INTEGER NOT NULL DEFAULT 443 CHECK (port BETWEEN 1 AND 65535),
    protocol   TEXT NOT NULL DEFAULT 'https' CHECK (protocol IN ('http', 'https')),
    purpose    TEXT NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT allowlist_entries_unique UNIQUE (host, port, protocol)
);

CREATE TABLE egress_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination         TEXT NOT NULL,
    user_id             UUID REFERENCES users(id),
    approval_request_id UUID REFERENCES approval_requests(id),
    bytes_out           BIGINT NOT NULL DEFAULT 0,
    bytes_in            BIGINT NOT NULL DEFAULT 0,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FR-47, FR-48. The acknowledgement is not a checkbox in the UI: the database refuses to
-- enable an external provider until someone has signed for document text leaving the network.
CREATE TABLE model_provider_settings (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider             TEXT NOT NULL,
    model_id             TEXT NOT NULL,
    api_key_enc          BYTEA,
    enabled              BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by      UUID REFERENCES users(id),
    acknowledged_at      TIMESTAMPTZ,
    acknowledgement_text TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT model_provider_settings_unique UNIQUE (provider),
    CONSTRAINT mps_enabled_requires_acknowledgement CHECK (
        enabled = FALSE
        OR (acknowledged_by IS NOT NULL AND acknowledged_at IS NOT NULL)
    )
);

-- Identity. Roles are TEXT with a CHECK rather than an enum: the permission matrix moves
-- more often than the schema, and ALTER TYPE takes a lock the matrix does not deserve.

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT NOT NULL,
    display_name   TEXT NOT NULL,
    password_hash  TEXT,
    auth_source    TEXT NOT NULL DEFAULT 'local'
                   CHECK (auth_source IN ('local', 'oidc')),
    system_role    TEXT NOT NULL DEFAULT 'Member'
                   CHECK (system_role IN ('Administrator', 'Knowledge Manager',
                                          'Approver', 'Member', 'Auditor')),
    status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'disabled')),
    locked_until   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email),
    -- FR-58: a local account must carry an Argon2id hash, an OIDC account never does.
    CONSTRAINT users_password_matches_source CHECK (
        (auth_source = 'local' AND password_hash IS NOT NULL)
        OR (auth_source = 'oidc' AND password_hash IS NULL)
    )
);

-- FR-64. Tokens are stored hashed, so a database leak hands nobody a usable refresh token.
-- family_id ties a rotation chain together: replaying any member revokes the whole family.
CREATE TABLE refresh_tokens (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id      UUID NOT NULL,
    token_hash     TEXT NOT NULL,
    issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    used_at        TIMESTAMPTZ,
    revoked_at     TIMESTAMPTZ,
    revoked_reason TEXT CHECK (revoked_reason IN ('rotated', 'reuse_detected',
                                                  'logout', 'account_disabled')),
    replaced_by    UUID REFERENCES refresh_tokens(id),
    CONSTRAINT refresh_tokens_hash_unique UNIQUE (token_hash),
    CONSTRAINT refresh_tokens_expiry_after_issue CHECK (expires_at > issued_at)
);

-- FR-65. The email is recorded rather than only a user id: attempts against an account that
-- does not exist must count too, or the rate limit becomes an account-enumeration oracle.
CREATE TABLE login_attempts (
    id           BIGSERIAL PRIMARY KEY,
    email        TEXT NOT NULL,
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    succeeded    BOOLEAN NOT NULL,
    ip           INET,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FR-59. Identity-provider group to system role.
CREATE TABLE group_mappings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    TEXT NOT NULL DEFAULT 'oidc',
    group_name  TEXT NOT NULL,
    system_role TEXT NOT NULL
                CHECK (system_role IN ('Administrator', 'Knowledge Manager',
                                       'Approver', 'Member', 'Auditor')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT group_mappings_unique UNIQUE (provider, group_name)
);

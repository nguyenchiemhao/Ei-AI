-- The agent loop's record. agent_steps is the centre of the design: every row is written
-- before the step it describes executes (BR-03), so a crash leaves an explainable trace.

CREATE TABLE conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- workspace_ids is an array with no foreign key on purpose: it records the scope a question
-- was asked under, and that history must survive a workspace being archived or removed.
CREATE TABLE turns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    question        TEXT NOT NULL,
    workspace_ids   UUID[] NOT NULL,
    status          turn_status NOT NULL DEFAULT 'planning',
    budget_ms       INTEGER NOT NULL DEFAULT 120000,
    budget_steps    SMALLINT NOT NULL DEFAULT 12,
    steps_used      SMALLINT NOT NULL DEFAULT 0,
    model_id        TEXT,
    prompt_version  TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    CONSTRAINT turns_budget_sane CHECK (budget_ms BETWEEN 5000 AND 600000),
    CONSTRAINT turns_steps_sane  CHECK (budget_steps BETWEEN 1 AND 50)
);

CREATE TABLE agent_steps (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turn_id        UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    seq            SMALLINT NOT NULL,
    type           step_type NOT NULL,
    tool_id        UUID,
    tool_name      TEXT,
    tool_input     JSONB,
    rationale      TEXT,
    status         step_status NOT NULL DEFAULT 'pending',
    result_summary TEXT,
    result_ref     JSONB,
    latency_ms     INTEGER,
    error_code     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at     TIMESTAMPTZ,
    ended_at       TIMESTAMPTZ,
    UNIQUE (turn_id, seq)
);

CREATE TABLE answers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turn_id        UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    text           TEXT NOT NULL,
    model_id       TEXT,
    prompt_version TEXT,
    is_refusal     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT answers_turn_unique UNIQUE (turn_id)
);

CREATE TABLE claims (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id        UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    seq              SMALLINT NOT NULL,
    text             TEXT NOT NULL,
    verdict          TEXT NOT NULL DEFAULT 'unverified'
                     CHECK (verdict IN ('supported', 'unsupported', 'unverified')),
    supporting_quote TEXT,
    CONSTRAINT claims_unique UNIQUE (answer_id, seq)
);

CREATE TABLE citations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id            UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    document_version_id UUID NOT NULL REFERENCES document_versions(id),
    page_no             INTEGER,
    char_start          INTEGER NOT NULL,
    char_end            INTEGER NOT NULL,
    CONSTRAINT citations_span_valid CHECK (char_end > char_start)
);

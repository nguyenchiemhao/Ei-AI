-- Part A · workspaces, membership, documents and per-document grants.

CREATE TABLE workspaces (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    description             TEXT,
    language_hint           TEXT NOT NULL DEFAULT 'auto',
    model_provider_override TEXT,
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'archived')),
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT workspaces_name_unique UNIQUE (name)
);

-- FR-62. Composite key: one person holds exactly one role in a workspace.
CREATE TABLE workspace_members (
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_role TEXT NOT NULL CHECK (workspace_role IN ('Owner', 'Editor', 'Reader')),
    added_by       UUID REFERENCES users(id),
    added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE documents (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id       UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
    title              TEXT NOT NULL,
    source_filename    TEXT NOT NULL,
    content_type       TEXT NOT NULL,
    current_version_id UUID,
    restricted         BOOLEAN NOT NULL DEFAULT FALSE,
    created_by         UUID NOT NULL REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FR-14. Only meaningful where documents.restricted is true; the permission predicate reads it.
CREATE TABLE document_grants (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by  UUID NOT NULL REFERENCES users(id),
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (document_id, user_id)
);

-- Part B · versions, pages and chunks.

CREATE TABLE document_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_no      INTEGER NOT NULL,
    storage_key     TEXT NOT NULL,
    byte_size       BIGINT NOT NULL CHECK (byte_size > 0 AND byte_size <= 209715200),
    sha256          TEXT NOT NULL,
    page_count      INTEGER,
    status          version_status NOT NULL DEFAULT 'uploaded',
    status_reason   TEXT,
    parser_version  TEXT,
    chunker_version TEXT,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    indexed_at      TIMESTAMPTZ,
    CONSTRAINT dv_version_unique UNIQUE (document_id, version_no),
    CONSTRAINT dv_content_unique UNIQUE (document_id, sha256)
);

-- Added after document_versions exists, which is why documents did not declare it inline.
ALTER TABLE documents
    ADD CONSTRAINT documents_current_version_fk
    FOREIGN KEY (current_version_id) REFERENCES document_versions(id);

CREATE TABLE pages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    page_no             INTEGER NOT NULL CHECK (page_no > 0),
    text                TEXT NOT NULL,
    extraction_method   TEXT NOT NULL
                        CHECK (extraction_method IN ('text_layer', 'ocr', 'markdown')),
    CONSTRAINT pages_unique UNIQUE (document_version_id, page_no)
);

-- text_search is generated from immutable_unaccent (001), not unaccent: Postgres refuses a
-- generated column whose expression is only STABLE.
CREATE TABLE chunks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    chunk_no            INTEGER NOT NULL,
    text                TEXT NOT NULL,
    token_count         INTEGER NOT NULL CHECK (token_count BETWEEN 1 AND 1024),
    page_from           INTEGER NOT NULL,
    page_to             INTEGER NOT NULL,
    char_start          INTEGER NOT NULL,
    char_end            INTEGER NOT NULL,
    heading_path        TEXT,
    embedding           HALFVEC(1024),
    text_search         TSVECTOR GENERATED ALWAYS AS (
                            to_tsvector('simple', immutable_unaccent(text))
                        ) STORED,
    CONSTRAINT chunks_unique UNIQUE (document_version_id, chunk_no),
    CONSTRAINT chunks_span_valid CHECK (char_end > char_start),
    CONSTRAINT chunks_pages_valid CHECK (page_to >= page_from)
);

-- Nine indexes. agent_steps (turn_id, seq) is deliberately absent: the UNIQUE constraint
-- on the table already builds exactly that index.

CREATE INDEX chunks_embedding_hnsw ON chunks USING hnsw (embedding halfvec_cosine_ops);
CREATE INDEX chunks_text_search_gin ON chunks USING gin (text_search);
CREATE INDEX chunks_version_idx ON chunks (document_version_id);

CREATE INDEX agent_steps_pending ON agent_steps (status)
    WHERE status IN ('pending', 'awaiting_approval');

CREATE INDEX turns_user_recent ON turns (user_id, started_at DESC);

-- S-3: an index predicate cannot contain a subquery, so openness is a column, not a lookup.
CREATE INDEX approval_requests_open ON approval_requests (expires_at)
    WHERE decided_at IS NULL;

CREATE INDEX tools_enabled_role ON tools (enabled, min_system_role) WHERE enabled = TRUE;

-- The chain is ordered by the BIGSERIAL id; the design's `seq` column never existed.
CREATE INDEX audit_events_chain ON audit_events (id);
CREATE INDEX audit_events_search ON audit_events
    USING gin (to_tsvector('simple', detail::text));

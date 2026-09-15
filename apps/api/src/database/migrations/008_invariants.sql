-- The constraints that make the promises enforceable. They are a separate numbered file, not
-- edits to 001-007: migrations are forward-only and those files are applied and checksummed.

-- S-2. A table constraint cannot carry a WHERE clause, so one active pre-authorisation per tool
-- is a partial unique index. A revoked row plus a new one stays legal.
CREATE UNIQUE INDEX pre_auth_one_active
    ON pre_authorisations (tool_id)
    WHERE revoked_at IS NULL;

-- BR-05. A write tool is never enabled in v1.
ALTER TABLE tools
    ADD CONSTRAINT tools_no_write_in_v1
    CHECK (classification = 'read' OR enabled = FALSE);

-- Redundant against the primary key on its own, and deliberately so: a composite foreign key
-- needs a unique constraint covering exactly the columns it references.
ALTER TABLE tools
    ADD CONSTRAINT tools_id_classification UNIQUE (id, classification);

-- S-4 · FR-44. A write tool can never be pre-authorised, and the database is what refuses.
-- classification is carried on the row and tied to the tool's own by the composite key, so the
-- two cannot disagree; the CHECK then rules out the only value that would be dangerous.
-- ON UPDATE NO ACTION is intended: reclassifying a tool that holds a pre-authorisation is
-- refused until that pre-authorisation is revoked, which is a deliberate act rather than a
-- side effect.
ALTER TABLE pre_authorisations
    ADD COLUMN classification tool_classification NOT NULL DEFAULT 'read';

ALTER TABLE pre_authorisations
    ALTER COLUMN classification DROP DEFAULT;

ALTER TABLE pre_authorisations
    ADD CONSTRAINT pre_auth_read_only CHECK (classification = 'read');

ALTER TABLE pre_authorisations
    ADD CONSTRAINT pre_auth_tool_classification_fk
    FOREIGN KEY (tool_id, classification) REFERENCES tools (id, classification);

-- S-5. An attempt to modify an append-only row fails loudly and lands in the caller's error
-- path. The v1 design used RULE ... DO INSTEAD NOTHING, which discards the write silently —
-- the worst possible behaviour on an audit table. No rule is created anywhere in this schema.
CREATE FUNCTION reject_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'append-only table: % does not allow %', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_immutable
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER approval_decisions_immutable
    BEFORE UPDATE OR DELETE ON approval_decisions
    FOR EACH ROW EXECUTE FUNCTION reject_mutation();

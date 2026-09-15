-- Extensions, the five enum types, and the one function a generated column depends on.
-- Numbered forward-only SQL: a customer's IT generalist has to read this at 2 a.m.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- T-2.1-01 · defect S-1. Postgres requires a generated column's expression to be IMMUTABLE,
-- and unaccent() is only STABLE because it resolves a dictionary by name at call time.
-- Naming the dictionary explicitly makes the result reproducible, so the wrapper can be
-- declared IMMUTABLE and chunks.text_search can be generated from it. Query paths keep
-- calling unaccent() directly.
CREATE FUNCTION immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT unaccent('unaccent', $1) $$;

CREATE TYPE version_status AS ENUM (
    'uploaded', 'parsing', 'parsed', 'chunking', 'embedding',
    'indexed', 'failed', 'quarantined', 'superseded', 'purged'
);

CREATE TYPE turn_status AS ENUM (
    'planning', 'acting', 'awaiting_approval', 'observing',
    'synthesising', 'verifying', 'answered', 'refused',
    'cancelled', 'budget_exhausted', 'loop_detected', 'failed'
);

CREATE TYPE step_type AS ENUM ('tool_call', 'synthesis', 'verification');

CREATE TYPE step_status AS ENUM (
    'pending', 'awaiting_approval', 'running',
    'succeeded', 'failed', 'timed_out', 'denied', 'denied_expired', 'skipped'
);

CREATE TYPE tool_classification AS ENUM ('read', 'write');

-- Runs once on first boot so a bare `docker compose up` yields a usable database.
-- Migration 001_extensions.sql repeats these, also IF NOT EXISTS: the migration
-- remains the single source of truth, this file only removes a manual first step.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

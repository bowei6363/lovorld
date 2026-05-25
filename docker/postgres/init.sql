-- Enable the pgvector extension so vector(...) columns work out of the box.
-- Idempotent: safe to re-run if the container is recreated.
CREATE EXTENSION IF NOT EXISTS vector;

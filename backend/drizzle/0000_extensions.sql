-- Trigram matching for typo-tolerant search on names (SRS 11.3).
-- pg_trgm is a trusted extension, so the database owner can create it (Neon included).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

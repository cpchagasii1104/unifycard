-- ============================================================
-- 0069: concepts (SSOT semântico) + categories.concept_id
-- ============================================================
-- Extensão uuid-ossp: genesis 0001 (não repetir aqui — forward-only).
-- ============================================================

BEGIN;

-- CONCEPT = identidade semântica (SSOT)
-- slug e domain são auxiliares (bootstrap, não normativos)

CREATE TABLE concepts (
  concept_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT concepts_domain_slug_key UNIQUE (domain, slug)
);

CREATE INDEX idx_concepts_domain ON concepts (domain);

ALTER TABLE categories
  ADD COLUMN concept_id UUID NULL REFERENCES concepts (concept_id) ON DELETE SET NULL;

CREATE INDEX idx_categories_concept_id ON categories (concept_id);

COMMIT;

-- 006_reviews_and_reputation.sql

-- ============================================
-- UNIVERSAL REVIEWS (core/reviews)
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,            -- ex: 'worker', 'client_user', 'company', 'service'
  entity_id UUID NOT NULL,              -- quem está sendo avaliado
  author_user_id UUID NOT NULL,         -- quem avaliou
  source_module TEXT NOT NULL,          -- 'work', 'rides', 'food', etc
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  quality_rating SMALLINT CHECK (quality_rating BETWEEN 1 AND 5),
  punctuality_rating SMALLINT CHECK (punctuality_rating BETWEEN 1 AND 5),
  professionalism_rating SMALLINT CHECK (professionalism_rating BETWEEN 1 AND 5),
  context JSONB,                        -- assignment_id, job_id, ride_id etc
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_tenant_entity
  ON reviews (tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_reviews_author
  ON reviews (tenant_id, author_user_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_tenant_isolation
  ON reviews
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- ============================================
-- UNIVERSAL REPUTATION (core/reputation)
-- ============================================
CREATE TABLE IF NOT EXISTS reputation_scores (
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  global_score NUMERIC(3,2) NOT NULL DEFAULT 0,     -- 0.00 - 5.00
  rating_count INTEGER NOT NULL DEFAULT 0,
  last_rating_at TIMESTAMPTZ,
  quality_score NUMERIC(3,2),
  punctuality_score NUMERIC(3,2),
  professionalism_score NUMERIC(3,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_reputation_entity
  ON reputation_scores (tenant_id, entity_type, entity_id);

ALTER TABLE reputation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY reputation_tenant_isolation
  ON reputation_scores
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

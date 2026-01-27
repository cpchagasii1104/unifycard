/*
Arquivo: 006_reviews_and_reputation.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Avaliações genéricas e reputação

Objetivo:
- Centralizar reviews independentes de módulo
- Consolidar scores de reputação reutilizáveis

Dependências:
- pgcrypto
Observações:
- Complementa, não substitui, reviews específicas de domínio
*/


CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS reviews (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  author_user_id UUID NOT NULL,
  source_module TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  quality_rating SMALLINT CHECK (quality_rating BETWEEN 1 AND 5),
  punctuality_rating SMALLINT CHECK (punctuality_rating BETWEEN 1 AND 5),
  professionalism_rating SMALLINT CHECK (professionalism_rating BETWEEN 1 AND 5),
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_tenant_entity
  ON reviews (tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_reviews_author
  ON reviews (tenant_id, author_user_id);

ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='reviews' AND policyname='reviews_tenant_isolation'
  ) THEN
    CREATE POLICY reviews_tenant_isolation
      ON reviews
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS reputation_scores (
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  global_score NUMERIC(3,2) NOT NULL DEFAULT 0,
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

ALTER TABLE IF EXISTS reputation_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='reputation_scores' AND policyname='reputation_tenant_isolation'
  ) THEN
    CREATE POLICY reputation_tenant_isolation
      ON reputation_scores
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
  END IF;
END $$;
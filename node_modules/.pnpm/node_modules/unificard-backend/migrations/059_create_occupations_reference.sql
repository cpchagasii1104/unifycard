-- Migration: Criar tabela de referência de ocupações (CBO)
-- FASE 3.8: Category Input Gate - ETAPA 3

CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- pgvector será criado em migration separada se necessário
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS occupations_reference (
  occupation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cbo_code VARCHAR(10) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  normalized_title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  synonyms TEXT[] DEFAULT '{}',
  family VARCHAR(100),
  major_group VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX idx_occupations_title_trgm ON occupations_reference 
  USING gin (normalized_title gin_trgm_ops);

CREATE INDEX idx_occupations_slug ON occupations_reference (slug);

CREATE INDEX idx_occupations_synonyms_gin ON occupations_reference 
  USING gin (synonyms);

CREATE INDEX idx_occupations_cbo_code ON occupations_reference (cbo_code);

-- Tabela de cache de embeddings
CREATE TABLE IF NOT EXISTS embeddings_cache (
  cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id UUID REFERENCES occupations_reference(occupation_id) ON DELETE CASCADE,
  input_text VARCHAR(500) NOT NULL,
  normalized_text VARCHAR(500) NOT NULL,
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(occupation_id, normalized_text)
);

-- Tabela de auditoria de inputs
CREATE TABLE IF NOT EXISTS category_input_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_original VARCHAR(500) NOT NULL,
  normalized VARCHAR(500) NOT NULL,
  context VARCHAR(50) NOT NULL, -- professional | hobby | interest | education
  decision VARCHAR(20) NOT NULL, -- ALLOW | DENY | REVIEW
  reason_code VARCHAR(100),
  confidence DECIMAL(3,2),
  canonical_id UUID REFERENCES occupations_reference(occupation_id),
  lexical_decision VARCHAR(20),
  form_check_decision VARCHAR(20),
  cbo_match_code VARCHAR(10),
  embedding_similarity DECIMAL(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tenant_id UUID,
  actor_id UUID,
  global_user_id UUID
);

CREATE INDEX idx_category_input_audit_context ON category_input_audit (context);
CREATE INDEX idx_category_input_audit_decision ON category_input_audit (decision);
CREATE INDEX idx_category_input_audit_created_at ON category_input_audit (created_at DESC);
CREATE INDEX idx_category_input_audit_normalized ON category_input_audit (normalized);

COMMENT ON TABLE occupations_reference IS 'Referência oficial de ocupações (CBO) para validação';
COMMENT ON TABLE embeddings_cache IS 'Cache de embeddings semânticos para busca por similaridade';
COMMENT ON TABLE category_input_audit IS 'Auditoria completa de todas as validações de input de categorias';
















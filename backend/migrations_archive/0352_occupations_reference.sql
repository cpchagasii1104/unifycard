-- ============================================================
-- UNIFICARD — MIGRATION 059
-- Arquivo: 059_occupations_reference_and_category_input_gate.sql
-- Tipo: ESTRUTURAL / GOVERNANÇA / IA
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration introduz a base canônica de ocupações (CBO)
-- e o sistema de auditoria e validação de inputs de categorias,
-- compondo a ETAPA 3 do Category Input Gate (FASE 3.8).
--
-- O objetivo é impedir criação caótica de categorias,
-- oferecendo:
-- • validação lexical
-- • normalização semântica
-- • matching com referência oficial (CBO)
-- • rastreabilidade total para decisões humanas ou por IA
--
-- ARQUITETURA
-- • occupations_reference
--     → Fonte GLOBAL e canônica de ocupações
-- • embeddings_cache
--     → Cache derivado para busca semântica (descartável)
-- • category_input_audit
--     → Ledger de auditoria (append-only)
--
-- GOVERNANÇA
-- • Estas tabelas NÃO usam RLS
-- • Não são multi-tenant por design
-- • tenant_id / actor_id são apenas CONTEXTO
-- • Nenhuma regra de decisão é aplicada no banco
--
-- RELAÇÃO COM MIGRATIONS ANTERIORES
-- • categories (040+)
-- • categories governance (055–058)
-- • Este módulo NÃO cria categorias
-- • Apenas valida, referencia e audita inputs
--
-- IDEMPOTÊNCIA
-- • Todas as criações usam IF NOT EXISTS
-- • Extensões garantidas explicitamente
--
-- ============================================================

-- ============================================================
-- EXTENSÕES NECESSÁRIAS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- pgvector será introduzido em migration futura, se necessário


-- ============================================================
-- 1) REFERÊNCIA CANÔNICA DE OCUPAÇÕES (CBO)
-- ============================================================

CREATE TABLE IF NOT EXISTS occupations_reference (
  occupation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cbo_code VARCHAR(10) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  normalized_title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,

  synonyms TEXT[] DEFAULT '{}',

  family VARCHAR(100),
  major_group VARCHAR(100),
  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de busca
CREATE INDEX IF NOT EXISTS idx_occupations_title_trgm
  ON occupations_reference USING gin (normalized_title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_occupations_slug
  ON occupations_reference (slug);

CREATE INDEX IF NOT EXISTS idx_occupations_synonyms_gin
  ON occupations_reference USING gin (synonyms);

CREATE INDEX IF NOT EXISTS idx_occupations_cbo_code
  ON occupations_reference (cbo_code);

-- Trigger updated_at
CREATE TRIGGER trg_occupations_reference_updated_at
  BEFORE UPDATE ON occupations_reference
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2) CACHE DE EMBEDDINGS (DERIVADO / DESCARTÁVEL)
-- ============================================================

CREATE TABLE IF NOT EXISTS embeddings_cache (
  cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  occupation_id UUID
    REFERENCES occupations_reference(occupation_id)
    ON DELETE CASCADE,

  input_text VARCHAR(500) NOT NULL,
  normalized_text VARCHAR(500) NOT NULL,

  embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT embeddings_cache_unique
    UNIQUE (occupation_id, normalized_text)
);


-- ============================================================
-- 3) AUDITORIA DE INPUTS DE CATEGORIA (APPEND-ONLY)
-- ============================================================

CREATE TABLE IF NOT EXISTS category_input_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  input_original VARCHAR(500) NOT NULL,
  normalized VARCHAR(500) NOT NULL,

  context VARCHAR(50) NOT NULL,
  decision VARCHAR(20) NOT NULL,

  reason_code VARCHAR(100),
  confidence NUMERIC(3,2),

  canonical_id UUID
    REFERENCES occupations_reference(occupation_id),

  lexical_decision VARCHAR(20),
  form_check_decision VARCHAR(20),

  cbo_match_code VARCHAR(10),
  embedding_similarity NUMERIC(5,4),

  -- Contexto (não governança)
  tenant_id UUID,
  actor_id UUID,
  global_user_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_category_input_audit_context
  ON category_input_audit (context);

CREATE INDEX IF NOT EXISTS idx_category_input_audit_decision
  ON category_input_audit (decision);

CREATE INDEX IF NOT EXISTS idx_category_input_audit_created_at
  ON category_input_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_category_input_audit_normalized
  ON category_input_audit (normalized);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE occupations_reference IS
  'Fonte canônica global de ocupações (CBO) para validação de categorias';

COMMENT ON TABLE embeddings_cache IS
  'Cache derivado de embeddings semânticos para matching de ocupações';

COMMENT ON TABLE category_input_audit IS
  'Ledger append-only de auditoria de inputs de categorias (IA e humano)';

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================














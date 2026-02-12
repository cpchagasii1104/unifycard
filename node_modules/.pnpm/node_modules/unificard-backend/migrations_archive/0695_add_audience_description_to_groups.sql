-- ============================================================
-- UNIFICARD — MIGRATION 124
-- Arquivo: 124_add_audience_description_to_groups.sql
-- Adicionar campo audience_description à tabela groups
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Adicionar campo opcional audience_description para armazenar
-- descrição curta do público-alvo do grupo
--
-- ESCOPO
-- ✔ Adiciona coluna audience_description (TEXT, nullable)
-- ✔ Campo opcional, sem validações
--
-- ============================================================

BEGIN;

-- Adicionar coluna audience_description
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS audience_description TEXT;

COMMENT ON COLUMN groups.audience_description IS 'Descrição curta do público-alvo do grupo';

COMMIT;

-- ============================================================
-- FIM 124_add_audience_description_to_groups.sql
-- ============================================================

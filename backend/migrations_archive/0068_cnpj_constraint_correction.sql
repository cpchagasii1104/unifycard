-- ============================================================
-- UNIFICARD — MIGRATION 099
-- Arquivo: 099_fix_cnpj_constraint.sql
-- Tipo: CORREÇÃO (Companies)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- A constraint companies_cnpj_format esperava CNPJ formatado
-- (com pontos e barra), mas o código agora salva apenas números.
-- Esta migration corrige a constraint para aceitar apenas números.
--
-- OBJETIVO
-- Alterar constraint para aceitar CNPJ apenas com números (14 dígitos)
--
-- DEPENDÊNCIAS
-- • companies (migration 047)
--
-- IDEMPOTÊNCIA
-- • Usa IF EXISTS para remover constraint
-- • Usa IF NOT EXISTS para criar constraint
--
-- ============================================================

-- Remover constraint antiga (se existir)
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_cnpj_format;

-- Criar constraint nova: apenas números (14 dígitos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_cnpj_format'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_cnpj_format
      CHECK (cnpj ~ '^[0-9]{14}$');
  END IF;
END $$;

-- ============================================================
-- FIM DA MIGRATION 099
-- ============================================================















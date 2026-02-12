-- ============================================================
-- UNIFICARD - MIGRATION 305
-- Arquivo: 305_create_ssot_violations.sql
-- Tipo: OBSERVABILIDADE SSOT
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Criar tabela de auditoria para violações e tentativas de violação
-- de SSOT (Single Source of Truth) na leitura de categorias.
--
-- OBJETIVO
-- Registrar todas as tentativas de violação de SSOT para:
-- - Visibilidade total em produção
-- - Dívida técnica mensurável
-- - Governança operacional ativa
-- ============================================================

BEGIN;

-- Adicionar esta migration à tabela schema_migrations
INSERT INTO schema_migrations (version, name, executed_at)
VALUES ('305', 'create_ssot_violations', NOW())
ON CONFLICT (version) DO NOTHING;

-- Criar tabela ssot_violations
CREATE TABLE IF NOT EXISTS ssot_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  tenant_id UUID,
  context VARCHAR(50),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ssot_violations IS 'Auditoria de violações e tentativas de violação de SSOT na leitura de categorias';
COMMENT ON COLUMN ssot_violations.type IS 'Tipo de violação: SSOT_VIOLATION, SSOT_SMELL, LEGACY_CALL';
COMMENT ON COLUMN ssot_violations.tenant_id IS 'ID do tenant (quando disponível)';
COMMENT ON COLUMN ssot_violations.context IS 'Contexto da requisição (quando disponível)';
COMMENT ON COLUMN ssot_violations.details IS 'Detalhes adicionais da violação (JSONB)';

-- Criar índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_ssot_violations_type ON ssot_violations(type);
CREATE INDEX IF NOT EXISTS idx_ssot_violations_tenant_id ON ssot_violations(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ssot_violations_created_at ON ssot_violations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ssot_violations_type_tenant_created ON ssot_violations(type, tenant_id, created_at DESC);

COMMIT;





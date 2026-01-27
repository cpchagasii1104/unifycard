-- ============================================================
-- UNIFICARD - MIGRATION 306
-- Arquivo: 306_create_tenant_contexts.sql
-- Tipo: EXTENSÃO - PERMISSÕES POR TENANT E CONTEXT
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Criar tabela de permissões por (tenant, context) para controlar
-- acesso a categorias sem alterar o core congelado.
--
-- OBJETIVO
-- Permitir que tenants tenham permissões específicas por context:
-- - read: pode ler categorias do context
-- - write: pode criar/editar categorias do context
-- - admin: controle total do context
-- ============================================================

BEGIN;

-- Adicionar esta migration à tabela schema_migrations
INSERT INTO schema_migrations (version, name, executed_at)
VALUES ('306', 'create_tenant_contexts', NOW())
ON CONFLICT (version) DO NOTHING;

-- Criar tabela tenant_contexts
CREATE TABLE IF NOT EXISTS tenant_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  context VARCHAR(50) NOT NULL,
  permission VARCHAR(20) NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, context)
);

COMMENT ON TABLE tenant_contexts IS 'Permissões de tenants por context (extensão sobre core congelado)';
COMMENT ON COLUMN tenant_contexts.tenant_id IS 'ID do tenant';
COMMENT ON COLUMN tenant_contexts.context IS 'Contexto da categoria (ex: professional, government, infrastructure)';
COMMENT ON COLUMN tenant_contexts.permission IS 'Nível de permissão: read, write ou admin';

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_tenant_contexts_tenant_id ON tenant_contexts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_contexts_context ON tenant_contexts(context);
CREATE INDEX IF NOT EXISTS idx_tenant_contexts_tenant_context ON tenant_contexts(tenant_id, context);

COMMIT;





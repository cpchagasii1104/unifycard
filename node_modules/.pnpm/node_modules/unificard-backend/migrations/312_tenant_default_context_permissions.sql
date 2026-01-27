-- ============================================================
-- UNIFICARD - MIGRATION 312
-- Arquivo: 312_tenant_default_context_permissions.sql
-- Tipo: EXTENSÃO - PERMISSÕES PADRÃO AUTOMÁTICAS POR TENANT
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Quando um novo tenant é criado, ele não possui permissões na
-- tabela tenant_contexts, causando CONTEXT_ACCESS_DENIED ao
-- acessar /categories/tree.
--
-- OBJETIVO
-- Criar tabela tenant_contexts, backfill para tenants existentes
-- e trigger para garantir permissões padrão em novos tenants.
--
-- CONFORMIDADE
-- - Não altera core de categorias
-- - Auth não conhece categorias
-- - Permissões ficam no banco
-- ============================================================

BEGIN;

-- ============================================================
-- REGISTRO DA MIGRATION
-- ============================================================
INSERT INTO schema_migrations (filename)
VALUES ('312_tenant_default_context_permissions.sql')
ON CONFLICT (filename) DO NOTHING;

-- ============================================================
-- TABELA: tenant_contexts
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_contexts (
  tenant_id  uuid        NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  context     varchar(50) NOT NULL,
  permission  varchar(20) NOT NULL DEFAULT 'read',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, context)
);

COMMENT ON TABLE tenant_contexts IS
  'Permissões por tenant e contexto funcional';

-- ============================================================
-- BACKFILL: tenants existentes
-- ============================================================
INSERT INTO tenant_contexts (tenant_id, context, permission)
SELECT t.tenant_id, ctx.context, 'read'
FROM tenants t
CROSS JOIN (
  VALUES
    ('professional'),
    ('interest'),
    ('learning'),
    ('health'),
    ('person')
) AS ctx(context)
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_contexts tc
  WHERE tc.tenant_id = t.tenant_id
)
ON CONFLICT (tenant_id, context) DO NOTHING;

-- ============================================================
-- FUNÇÃO: permissões padrão para novo tenant
-- ============================================================
CREATE OR REPLACE FUNCTION set_default_tenant_permissions()
RETURNS trigger AS $$
BEGIN
  INSERT INTO tenant_contexts (tenant_id, context, permission)
  SELECT NEW.tenant_id, ctx.context, 'read'
  FROM (
    VALUES
      ('professional'),
      ('interest'),
      ('learning'),
      ('health'),
      ('person')
  ) AS ctx(context)
  ON CONFLICT (tenant_id, context) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_default_tenant_permissions() IS
  'Insere permissões padrão (read) em tenant_contexts para novos tenants';

-- ============================================================
-- TRIGGER
-- ============================================================
DROP TRIGGER IF EXISTS trg_tenant_default_permissions ON tenants;

CREATE TRIGGER trg_tenant_default_permissions
AFTER INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION set_default_tenant_permissions();

COMMENT ON TRIGGER trg_tenant_default_permissions ON tenants IS
  'Cria permissões padrão em tenant_contexts após criação do tenant';

COMMIT;
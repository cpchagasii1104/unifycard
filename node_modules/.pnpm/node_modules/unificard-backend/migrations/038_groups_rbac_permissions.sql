-- ============================================================
-- UNIFICARD — MIGRATION 038
-- Arquivo: 038_groups_rbac_permissions.sql
-- Tipo: SEED CONTROLADO (RBAC)
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar permissões RBAC do módulo Groups e atribuí-las
-- às roles padrão (OWNER, ADMIN, USER) quando existentes.
--
-- ESCOPO
-- ✔ Cria permissões de groups e social relacionadas a grupos
-- ✔ Atribui permissões às roles padrão por tenant
-- ✔ Executa automaticamente para todos os tenants existentes
--
-- ❌ Não cria roles
-- ❌ Não remove permissões
-- ❌ Não altera permissões já existentes
--
-- DEPENDÊNCIAS OBRIGATÓRIAS
-- • tenants
-- • roles
-- • permissions (UNIQUE tenant_id, resource, action)
-- • role_permissions (UNIQUE tenant_id, role_id, permission_id)
--
-- EFEITOS COLATERAIS IMPORTANTES
-- ⚠ Esta migration ALTERA RBAC ATIVO:
--   - novas permissões são atribuídas automaticamente
--   - roles OWNER / ADMIN / USER passam a ter novos poderes
--
-- IDEMPOTÊNCIA
-- • Todas as inserções usam ON CONFLICT DO NOTHING
-- • Pode ser executada múltiplas vezes com segurança
--
-- ============================================================

CREATE OR REPLACE FUNCTION seed_groups_permissions(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  -- =========================================================
  -- PERMISSÕES DO MÓDULO GROUPS
  -- =========================================================

  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES
    (p_tenant_id, 'groups', 'create', 'Criar novos grupos', true),
    (p_tenant_id, 'groups', 'read', 'Visualizar grupos', true),
    (p_tenant_id, 'groups', 'update', 'Atualizar grupos', true),
    (p_tenant_id, 'groups', 'delete', 'Deletar grupos', true),
    (p_tenant_id, 'groups', 'join', 'Entrar em grupos', true),
    (p_tenant_id, 'groups', 'leave', 'Sair de grupos', true),
    (p_tenant_id, 'groups', 'members:read', 'Visualizar membros de grupos', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- =========================================================
  -- PERMISSÕES SOCIAIS RELACIONADAS A GRUPOS
  -- =========================================================

  INSERT INTO permissions (tenant_id, resource, action, description, is_system_permission)
  VALUES
    (p_tenant_id, 'social', 'groups:read', 'Visualizar informações sociais de grupos', true),
    (p_tenant_id, 'social', 'groups:feed:read', 'Visualizar feed de grupos', true),
    (p_tenant_id, 'social', 'groups:post', 'Criar posts em grupos', true),
    (p_tenant_id, 'social', 'impact:read', 'Visualizar feed de impacto', true)
  ON CONFLICT (tenant_id, resource, action) DO NOTHING;

  -- =========================================================
  -- ATRIBUIÇÃO PARA ROLES PADRÃO (SE EXISTIREM)
  -- =========================================================

  -- OWNER: todas as permissões de groups
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  JOIN permissions p
    ON p.tenant_id = p_tenant_id
   AND p.resource = 'groups'
  WHERE r.tenant_id = p_tenant_id
    AND r.name = 'OWNER'
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

  -- ADMIN: create, read, update
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  JOIN permissions p
    ON p.tenant_id = p_tenant_id
   AND p.resource = 'groups'
   AND p.action IN ('create','read','update')
  WHERE r.tenant_id = p_tenant_id
    AND r.name = 'ADMIN'
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

  -- USER: read, join, leave
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  JOIN permissions p
    ON p.tenant_id = p_tenant_id
   AND p.resource = 'groups'
   AND p.action IN ('read','join','leave')
  WHERE r.tenant_id = p_tenant_id
    AND r.name = 'USER'
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

  -- USER / ADMIN: permissões sociais
  INSERT INTO role_permissions (tenant_id, role_id, permission_id, granted_by)
  SELECT p_tenant_id, r.role_id, p.permission_id, NULL
  FROM roles r
  JOIN permissions p
    ON p.tenant_id = p_tenant_id
   AND p.resource = 'social'
   AND p.action IN ('groups:read','groups:feed:read','groups:post','impact:read')
  WHERE r.tenant_id = p_tenant_id
    AND r.name IN ('USER','ADMIN')
  ON CONFLICT (tenant_id, role_id, permission_id) DO NOTHING;

END;
$$;

-- ============================================================
-- EXECUÇÃO PARA TODOS OS TENANTS EXISTENTES
-- ============================================================

DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN
    SELECT tenant_id FROM tenants
  LOOP
    PERFORM seed_groups_permissions(tenant_record.tenant_id);
  END LOOP;
END $$;

-- ============================================================
-- FIM 038_groups_rbac_permissions.sql
-- ============================================================

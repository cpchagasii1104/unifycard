-- Migration: actor_has_permission stub para desenvolvimento
-- Função RBAC que ainda não foi portada do migrations_archive para o schema Gênesis
-- DEV ONLY: retorna true para todas as permissões
-- Substituir por implementação real em FASE 6 (sessão arquitetural RBAC)

BEGIN;

CREATE OR REPLACE FUNCTION actor_has_permission(
  p_tenant_id UUID,
  p_actor_id UUID,
  p_resource TEXT,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DEV STUB: permite tudo enquanto RBAC real não está portado
  -- Ver migrations_archive para implementação completa
  RETURN TRUE;
END;
$$;

COMMIT;
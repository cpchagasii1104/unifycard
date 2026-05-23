-- ============================================================
-- 0059: tenant_contexts (permissões por tenant + contexto de categorias)
-- ============================================================
-- Referência no código: tenant-context-permission.service, categories.*
-- ON CONFLICT (tenant_id, context) exige UNIQUE composto.
-- ============================================================

BEGIN;

CREATE TABLE tenant_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  context TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_contexts_tenant_context_key UNIQUE (tenant_id, context)
);

CREATE INDEX idx_tenant_contexts_tenant_id ON tenant_contexts (tenant_id);

COMMENT ON TABLE tenant_contexts IS
  'Permissão efetiva por (tenant, contexto de categoria); usado pelo gate de categories.';

COMMIT;

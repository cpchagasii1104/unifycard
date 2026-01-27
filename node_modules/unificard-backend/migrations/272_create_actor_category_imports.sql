-- ============================================================
-- UNIFICARD - MIGRATION 272
-- Marketplace: Importação Parcial de Categorias por Actor
-- ============================================================
-- 
-- OBJETIVO:
-- Permitir que empresas/actors "ativem" apenas partes da árvore de categorias
-- sem duplicar dados nem criar nova taxonomia.
--
-- REGRAS:
-- - Apenas referências (links) às categorias CORE
-- - Nenhuma duplicação de categorias
-- - Persistido em metadata do actor/empresa
-- ============================================================

CREATE TABLE IF NOT EXISTS actor_category_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  category_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  imported_by_actor_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT actor_category_imports_unique_actor
    UNIQUE (tenant_id, actor_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_actor_category_imports_tenant
  ON actor_category_imports (tenant_id);

CREATE INDEX IF NOT EXISTS idx_actor_category_imports_actor
  ON actor_category_imports (tenant_id, actor_id);

CREATE INDEX IF NOT EXISTS idx_actor_category_imports_categories
  ON actor_category_imports USING GIN (category_ids);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_actor_category_imports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actor_category_imports_updated_at
  BEFORE UPDATE ON actor_category_imports
  FOR EACH ROW
  EXECUTE FUNCTION update_actor_category_imports_updated_at();

-- RLS
ALTER TABLE actor_category_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY actor_category_imports_rls
  ON actor_category_imports
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

-- Comentários
COMMENT ON TABLE actor_category_imports IS
  'Importação parcial de categorias por Actor/Empresa. Apenas referências, sem duplicação.';

COMMENT ON COLUMN actor_category_imports.category_ids IS
  'Array de IDs de categorias CORE importadas/ativadas por este actor.';

COMMENT ON COLUMN actor_category_imports.metadata IS
  'Metadados adicionais da importação (JSONB).';





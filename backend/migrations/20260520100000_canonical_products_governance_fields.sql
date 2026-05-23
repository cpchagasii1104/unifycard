-- §3/§17 PLANO_FASE_ATUAL: campos de governança faltantes em canonical_products.
-- version: controle de versão para mudanças industriais relevantes.
-- created_by_actor_id: trilha de autoria obrigatória (§5.2).
--
-- Nota: "governance_status" do texto normativo = concept_resolution_status no runtime.
-- Não criar campo duplicado.

BEGIN;

-- 1. version (padrão 1, incrementar em mudanças industriais: GTIN, nome, marca)
ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Constraint idempotente (ADD CONSTRAINT IF NOT EXISTS não é PG válido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'canonical_products_version_positive_chk'
      AND conrelid = 'canonical_products'::regclass
  ) THEN
    ALTER TABLE canonical_products
      ADD CONSTRAINT canonical_products_version_positive_chk
        CHECK (version >= 1)
        NOT VALID; -- não revalida linhas existentes (todas têm DEFAULT 1)
  END IF;
END $$;

-- 2. created_by_actor_id (nullable: linhas de seed/backfill sem actor explícito)
ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS created_by_actor_id UUID
    REFERENCES actors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_products_created_by
  ON canonical_products (created_by_actor_id)
  WHERE created_by_actor_id IS NOT NULL;

COMMENT ON COLUMN canonical_products.version IS
  '§3 PLANO_FASE_ATUAL: versão do canonical. Incrementar em mudanças industriais. '
  'Não confundir com concept_resolution_status.';

COMMENT ON COLUMN canonical_products.created_by_actor_id IS
  '§5.2 PLANO_FASE_ATUAL: actor que criou o canonical. NULL para seeds/backfill.';

COMMIT;

-- ============================================================
-- 20260616120100 — availability.purpose_concept_id (finalidade temporal por janela)
-- ============================================================
-- DECISION-0132. Destino canônico da finalidade temporal = coluna estrutural em `availability`
-- (SSOT temporal unified_availability, DECISION-0072). FK → concepts (SSOT semântico). NUNCA metadata.
-- Forward-only · idempotente · NULL (sem backfill; janelas pré-0132 = NULL = bookáveis por compat) ·
-- ON DELETE RESTRICT (concept de finalidade em uso não pode ser apagado) · SEM is_bookable ·
-- SEM tabela paralela. row_count atual (dev) > 0 → coluna NULLABLE (seguro, sem backfill).
-- ============================================================

ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS purpose_concept_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_availability_purpose_concept') THEN
    ALTER TABLE availability
      ADD CONSTRAINT fk_availability_purpose_concept
      FOREIGN KEY (purpose_concept_id) REFERENCES concepts(concept_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_availability_purpose_concept
  ON availability (tenant_id, purpose_concept_id);

-- ============================================================
-- 0081: Deprecar CONTEXT `nutricao` (alinhamento plano 21 v3.0.1)
-- ============================================================
-- `nutricao` não é CONTEXT estrutural — INTENT/facet (norma 20/21).
-- Remoção física: script governado remove-deprecated-context-nutricao (tsx).
-- Escrita em context_nodes exige app.n2_governance (0080); mesmo padrão que 0082/0083.
-- ============================================================

BEGIN;

SELECT set_config('app.n2_governance', 'true', true);

ALTER TABLE context_nodes
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;

COMMENT ON COLUMN context_nodes.deprecated_at IS
  'CONTEXT descontinuado; leitura deve ignorar quando NOT NULL (plano 21).';

UPDATE context_nodes
SET
  deprecated_at = now(),
  is_active = false
WHERE context_slug = 'nutricao';

COMMIT;

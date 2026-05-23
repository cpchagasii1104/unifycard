-- ============================================================
-- 0090: tenants.city_id (opcional, geografia do tenant)
-- ============================================================
-- Constituição base (0002_identity): tenants sem city_id.
-- Serviços (tenant.service, região) e código legado esperam a coluna.
-- Não FK para cities: tabela world pode não existir em instalações mínimas.
-- Ontologia N0–N3 (categories): não usa esta coluna na leitura canónica da árvore.
-- ============================================================

BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS city_id UUID;

COMMENT ON COLUMN tenants.city_id IS
  'Opcional: cidade de referência do tenant; separado da taxonomia categories (N0–N3).';

COMMIT;

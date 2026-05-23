-- Preparação semântica: rides_vehicles → concepts (SSOT).
--
-- Regras desta fase (norma / ontologia de veículo):
-- - Coluna nullable; sem FK para concepts (fase posterior, após seeds e backfill).
-- - Não remove brand/model; sem backfill automático; sem NOT NULL.
-- - Tabela pode não existir em ambientes que só aplicaram genesis parcial — no-op seguro.

BEGIN;

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'rides_vehicles'
  ) THEN
    ALTER TABLE public.rides_vehicles
      ADD COLUMN IF NOT EXISTS concept_id UUID NULL;

    EXECUTE format(
      'COMMENT ON COLUMN public.rides_vehicles.concept_id IS %L',
      'Ligação opcional a public.concepts (SSOT semântico). '
        || 'TODO: obrigatório após migração de ontologia de veículo e backfill. '
        || 'FK para concepts(concept_id) será adicionada em fase posterior. '
        || 'brand/model permanecem até a transição estar completa.'
    );
  END IF;
END
$mig$;

COMMIT;

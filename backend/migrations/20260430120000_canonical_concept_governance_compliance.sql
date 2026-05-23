-- Conformidade normativa: INDUSTRIAL sem concept_id só existe com fila `pending`;
-- `confirmed` exige concept_id. Alinhado a SSOT_REGISTRY / 18_DOMAIN_ONTOLOGY / 07.

BEGIN;

-- 1) Backfill: garantir fila pending para canónicos INDUSTRIAL sem concept (estado inválido persistente).
INSERT INTO canonical_concept_resolution_queue (canonical_product_id, status, created_at)
SELECT cp.id, 'pending', NOW()
FROM canonical_products cp
WHERE cp.type = 'INDUSTRIAL'
  AND cp.concept_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM canonical_concept_resolution_queue q
    WHERE q.canonical_product_id = cp.id
      AND q.status = 'pending'
  );

-- 2) Estado confirmado exige SSOT semântico preenchido.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'canonical_products_confirmed_requires_concept_chk'
  ) THEN
    ALTER TABLE canonical_products
      ADD CONSTRAINT canonical_products_confirmed_requires_concept_chk
      CHECK (
        concept_resolution_status IS DISTINCT FROM 'confirmed'
        OR concept_id IS NOT NULL
      );
  END IF;
END $$;

-- 3) Trigger DEFERRABLE: ao COMMIT, INDUSTRIAL + concept_id NULL ⇒ existe fila pending.
CREATE OR REPLACE FUNCTION assert_canonical_industrial_concept_governance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.type = 'INDUSTRIAL' AND NEW.concept_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM canonical_concept_resolution_queue q
      WHERE q.canonical_product_id = NEW.id
        AND q.status = 'pending'
    ) THEN
      RAISE EXCEPTION
        'GOVERNANCE: canonical_products INDUSTRIAL % sem concept_id exige entrada pending em canonical_concept_resolution_queue',
        NEW.id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_canonical_industrial_concept_governance ON canonical_products;

CREATE CONSTRAINT TRIGGER trg_canonical_industrial_concept_governance
AFTER INSERT OR UPDATE OF concept_id, type, concept_resolution_status ON canonical_products
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_canonical_industrial_concept_governance();

COMMENT ON FUNCTION assert_canonical_industrial_concept_governance() IS
  'Lei catálogo: INDUSTRIAL sem concept_id só válido com fila pending (transação única INSERT+fila).';

COMMIT;

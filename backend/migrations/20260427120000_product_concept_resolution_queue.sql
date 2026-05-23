-- Fase 3: fila de governança humana para ligação canonical → product_concepts.
-- system sugere (futuro); humano aprova/rejeita. Sem auto-create de concept.

BEGIN;

CREATE TABLE product_concept_resolution_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_product_id UUID NOT NULL
    REFERENCES canonical_products(id) ON DELETE CASCADE,
  suggested_concept_id UUID
    REFERENCES product_concepts(id) ON DELETE SET NULL,
  suggested_confidence NUMERIC(5, 4),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

ALTER TABLE product_concept_resolution_queue
  DROP CONSTRAINT IF EXISTS product_concept_resolution_queue_status_chk;

ALTER TABLE product_concept_resolution_queue
  ADD CONSTRAINT product_concept_resolution_queue_status_chk
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE product_concept_resolution_queue
  DROP CONSTRAINT IF EXISTS product_concept_resolution_queue_suggested_confidence_chk;

ALTER TABLE product_concept_resolution_queue
  ADD CONSTRAINT product_concept_resolution_queue_suggested_confidence_chk
  CHECK (suggested_confidence IS NULL OR (suggested_confidence >= 0 AND suggested_confidence <= 1));

CREATE INDEX idx_product_concept_resolution_queue_status
  ON product_concept_resolution_queue (status);

CREATE INDEX idx_product_concept_resolution_queue_canonical_product_id
  ON product_concept_resolution_queue (canonical_product_id);

-- No máximo um item pendente por canónico (idempotência de enqueue).
CREATE UNIQUE INDEX uidx_pcrq_canonical_pending
  ON product_concept_resolution_queue (canonical_product_id)
  WHERE status = 'pending';

COMMENT ON TABLE product_concept_resolution_queue IS
  'Human governance queue for linking canonical_products to product_concepts; no automatic concept creation.';

COMMENT ON COLUMN product_concept_resolution_queue.suggested_concept_id IS
  'Optional future automatic suggestion; NULL until suggestion pipeline exists.';

COMMENT ON COLUMN product_concept_resolution_queue.resolved_by IS
  'Actor or operator id (text) when status is approved/rejected.';

COMMIT;

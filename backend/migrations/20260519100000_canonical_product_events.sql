-- §5A PLANO_FASE_ATUAL: tabela append-only de eventos canônicos.
-- Sem esta tabela o gate §17 não pode ser aberto ("pronto é ilusório para debug").
-- Ref: PLANO_FASE_ATUAL.md §5A

BEGIN;

CREATE TABLE IF NOT EXISTS canonical_product_events (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_product_id  UUID        NOT NULL
    REFERENCES canonical_products(id) ON DELETE CASCADE,
  event_type            TEXT        NOT NULL,
  payload               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  actor_id              UUID        REFERENCES actors(id) ON DELETE SET NULL,
  tenant_id             UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cpe_event_type_chk CHECK (
    event_type IN (
      'created',
      'concept_resolved',
      'concept_resolution_pending',
      'concept_suggestion_auto',
      'governance_status_changed',
      'gtin_collision_blocked',
      'backfill_category'
    )
  )
);

-- Append-only: bloquear UPDATE e DELETE por trigger
CREATE OR REPLACE FUNCTION trg_canonical_product_events_immutable()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION
    'canonical_product_events é append-only. Operação proibida. id=%', OLD.id
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_cpe_immutable ON canonical_product_events;
CREATE TRIGGER trg_cpe_immutable
  BEFORE UPDATE OR DELETE ON canonical_product_events
  FOR EACH ROW EXECUTE FUNCTION trg_canonical_product_events_immutable();

CREATE INDEX IF NOT EXISTS idx_cpe_canonical_product_id
  ON canonical_product_events (canonical_product_id);
CREATE INDEX IF NOT EXISTS idx_cpe_event_type
  ON canonical_product_events (event_type);
CREATE INDEX IF NOT EXISTS idx_cpe_created_at
  ON canonical_product_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpe_tenant_id
  ON canonical_product_events (tenant_id)
  WHERE tenant_id IS NOT NULL;

COMMENT ON TABLE canonical_product_events IS
  '§5A PLANO_FASE_ATUAL: eventos append-only de canonical_products. '
  'Rastreia ciclo de vida, resolução de conceito e colisões GTIN. '
  'Bloqueador do gate §17.';

COMMENT ON COLUMN canonical_product_events.event_type IS
  'Valores: created | concept_resolved | concept_resolution_pending | '
  'concept_suggestion_auto | governance_status_changed | '
  'gtin_collision_blocked | backfill_category. '
  'concept_suggestion_auto: status auto_suggested ativado. '
  'governance_status_changed: qualquer outro UPDATE em concept_resolution_status.';

COMMIT;

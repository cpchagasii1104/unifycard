-- inventory_movements.actor_id — unidade operacional (actor no tenant).
-- SSOT físico por (tenant_id, actor_id, product_variant_id); idempotência alargada.
-- Append-only mantido (sem UPDATE/DELETE nas linhas existentes).

BEGIN;

-- Backfill exige UPDATE; trigger append-only bloqueia por defeito (0102).
ALTER TABLE inventory_movements DISABLE TRIGGER prevent_inventory_movements_update;

-- 1) Coluna (nullable até backfill)
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS actor_id UUID;

-- 2) Backfill: fulfillment OUT → vendedor do pedido
UPDATE inventory_movements im
SET actor_id = o.seller_actor_id
FROM fulfillment_orders fo
JOIN orders o ON o.tenant_id = fo.tenant_id AND o.id = fo.order_id
WHERE im.tenant_id = fo.tenant_id
  AND im.reference_type = 'fulfillment_order'
  AND im.reference_id = fo.id
  AND im.actor_id IS NULL;

-- 3) Stock transfer: OUT na origem, IN no destino
UPDATE inventory_movements im
SET actor_id = st.from_actor_id
FROM stock_transfers st
WHERE im.tenant_id = st.tenant_id
  AND im.reference_type = 'stock_transfer'
  AND im.reference_id = st.id
  AND im.movement_type = 'OUT'
  AND im.actor_id IS NULL;

UPDATE inventory_movements im
SET actor_id = st.to_actor_id
FROM stock_transfers st
WHERE im.tenant_id = st.tenant_id
  AND im.reference_type = 'stock_transfer'
  AND im.reference_id = st.id
  AND im.movement_type = 'IN'
  AND im.actor_id IS NULL;

-- 4) Purchase order IN → actor que criou a PO (contexto operacional do tenant)
UPDATE inventory_movements im
SET actor_id = po.created_by_actor_id
FROM purchase_orders po
WHERE im.tenant_id = po.tenant_id
  AND im.reference_type = 'purchase_order'
  AND im.reference_id = po.id
  AND im.actor_id IS NULL;

-- 5) Ajustes (se a tabela existir neste ambiente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_adjustments'
  ) THEN
    UPDATE inventory_movements im
    SET actor_id = ia.actor_id
    FROM inventory_adjustments ia
    WHERE im.tenant_id = ia.tenant_id
      AND im.reference_type = 'inventory_adjustment'
      AND im.reference_id = ia.id
      AND im.actor_id IS NULL;
  END IF;
END $$;

-- 6) Oferta ativa por variante → merchant_id
-- Coluna canónica: is_active (ver 20260331150000_product_offers_nomenclature.sql; antigo nome: active)
UPDATE inventory_movements im
SET actor_id = sub.merchant_id
FROM (
  SELECT DISTINCT ON (im2.id)
    im2.id AS movement_id,
    po.merchant_id
  FROM inventory_movements im2
  JOIN product_variants pv ON pv.tenant_id = im2.tenant_id AND pv.id = im2.product_variant_id
  JOIN product_offers po ON po.tenant_id = pv.tenant_id AND po.product_id = pv.product_id AND po.is_active = true
  WHERE im2.actor_id IS NULL
  ORDER BY im2.id, po.id
) sub
WHERE im.id = sub.movement_id AND sub.merchant_id IS NOT NULL;

-- 7) Qualquer oferta (fallback) se ainda sem actor
UPDATE inventory_movements im
SET actor_id = sub.merchant_id
FROM (
  SELECT DISTINCT ON (im2.id)
    im2.id AS movement_id,
    po.merchant_id
  FROM inventory_movements im2
  JOIN product_variants pv ON pv.tenant_id = im2.tenant_id AND pv.id = im2.product_variant_id
  JOIN product_offers po ON po.tenant_id = pv.tenant_id AND po.product_id = pv.product_id
  WHERE im2.actor_id IS NULL
  ORDER BY im2.id, po.is_active DESC NULLS LAST, po.id
) sub
WHERE im.id = sub.movement_id AND sub.merchant_id IS NOT NULL;

-- 8) Último recurso: primeiro actor company do tenant
-- (Sem FROM LATERAL referenciando `im`: PostgreSQL não permite na cláusula FROM do UPDATE.)
UPDATE inventory_movements im
SET actor_id = (
  SELECT a2.id
  FROM actors a2
  WHERE a2.tenant_id = im.tenant_id AND a2.actor_type = 'company'
  ORDER BY a2.created_at
  LIMIT 1
)
WHERE im.actor_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM actors a2
    WHERE a2.tenant_id = im.tenant_id AND a2.actor_type = 'company'
  );

-- 9) Legado / dev: tenant sem actor `company` — atribuir primeiro actor do tenant (preferência já foi 8)
UPDATE inventory_movements im
SET actor_id = (
  SELECT a2.id
  FROM actors a2
  WHERE a2.tenant_id = im.tenant_id
  ORDER BY a2.created_at
  LIMIT 1
)
WHERE im.actor_id IS NULL
  AND EXISTS (SELECT 1 FROM actors a2 WHERE a2.tenant_id = im.tenant_id);

DO $$
DECLARE
  n_left int;
BEGIN
  SELECT count(*)::int INTO n_left FROM inventory_movements WHERE actor_id IS NULL;
  IF n_left > 0 THEN
    RAISE EXCEPTION 'inventory_movements.actor_id backfill incompleto: % linhas sem actor (crie actor company no tenant ou corrija dados)', n_left;
  END IF;
END $$;

ALTER TABLE inventory_movements
  ALTER COLUMN actor_id SET NOT NULL;

ALTER TABLE inventory_movements
  ADD CONSTRAINT fk_inventory_movements_actor
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION inventory_movements_enforce_actor_tenant()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM actors a
    WHERE a.id = NEW.actor_id AND a.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'inventory_movements.actor_id must belong to the same tenant_id as the row';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_movements_actor_tenant ON inventory_movements;
CREATE TRIGGER trg_inventory_movements_actor_tenant
  BEFORE INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION inventory_movements_enforce_actor_tenant();

DROP INDEX IF EXISTS uidx_inventory_movements_reference;

CREATE UNIQUE INDEX uidx_inventory_movements_reference
  ON inventory_movements (tenant_id, reference_type, reference_id, product_variant_id, actor_id)
  WHERE reference_type IS NOT NULL
    AND reference_id IS NOT NULL;

COMMENT ON INDEX uidx_inventory_movements_reference IS
  'Idempotência: uma entrada por (tenant, ref_type, ref_id, variante, unidade actor).';

CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_actor_variant
  ON inventory_movements (tenant_id, actor_id, product_variant_id);

COMMENT ON COLUMN inventory_movements.actor_id IS
  'Unidade operacional (actor elegível no tenant). SSOT físico por tenant + actor + variante.';

ALTER TABLE inventory_movements ENABLE TRIGGER prevent_inventory_movements_update;

COMMIT;

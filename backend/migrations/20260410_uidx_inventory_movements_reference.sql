BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_inventory_movements_reference
ON inventory_movements (tenant_id, reference_type, reference_id, product_variant_id)
WHERE reference_type IS NOT NULL
AND reference_id IS NOT NULL;

COMMENT ON INDEX uidx_inventory_movements_reference IS
'Idempotência: uma entrada por (tenant, ref_type, ref_id, variante). '
'Evita movimentos duplicados em retry de fulfillment/purchase_order/stock_transfer.';

COMMIT;

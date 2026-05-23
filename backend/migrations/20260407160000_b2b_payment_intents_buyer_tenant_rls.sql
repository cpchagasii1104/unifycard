-- buyer_tenant_id + RLS (comprador); fornecedor marca ready via função SECURITY DEFINER.
BEGIN;

ALTER TABLE b2b_payment_intents
  ADD COLUMN IF NOT EXISTS buyer_tenant_id UUID;

UPDATE b2b_payment_intents pi
SET buyer_tenant_id = o.buyer_tenant_id
FROM b2b_orders o
WHERE pi.b2b_order_id = o.id
  AND pi.buyer_tenant_id IS NULL;

ALTER TABLE b2b_payment_intents
  ALTER COLUMN buyer_tenant_id SET NOT NULL;

ALTER TABLE b2b_payment_intents
  DROP CONSTRAINT IF EXISTS b2b_payment_intents_buyer_tenant_fk;

ALTER TABLE b2b_payment_intents
  ADD CONSTRAINT b2b_payment_intents_buyer_tenant_fk
  FOREIGN KEY (buyer_tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

COMMENT ON COLUMN b2b_payment_intents.buyer_tenant_id IS 'Tenant comprador; RLS com app.current_tenant.';

ALTER TABLE b2b_payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS b2b_payment_intents_select ON b2b_payment_intents;
CREATE POLICY b2b_payment_intents_select ON b2b_payment_intents
  FOR SELECT
  USING (
    buyer_tenant_id = current_setting('app.current_tenant', true)::uuid
    OR EXISTS (
      SELECT 1
      FROM b2b_orders o
      WHERE o.id = b2b_payment_intents.b2b_order_id
        AND o.supplier_tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );

DROP POLICY IF EXISTS b2b_payment_intents_insert ON b2b_payment_intents;
CREATE POLICY b2b_payment_intents_insert ON b2b_payment_intents
  FOR INSERT
  WITH CHECK (buyer_tenant_id = current_setting('app.current_tenant', true)::uuid);

DROP POLICY IF EXISTS b2b_payment_intents_update ON b2b_payment_intents;
CREATE POLICY b2b_payment_intents_update ON b2b_payment_intents
  FOR UPDATE
  USING (buyer_tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (buyer_tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE OR REPLACE FUNCTION b2b_payment_intent_mark_ready(
  p_intent_id UUID,
  p_order_id UUID,
  p_supplier_tenant_id UUID
)
RETURNS SETOF b2b_payment_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  UPDATE b2b_payment_intents pi
  SET status = 'ready', updated_at = now()
  FROM b2b_orders o
  WHERE pi.id = p_intent_id
    AND pi.b2b_order_id = p_order_id
    AND o.id = pi.b2b_order_id
    AND o.supplier_tenant_id = p_supplier_tenant_id
    AND pi.status = 'pending'
  RETURNING pi.*;
END;
$$;

COMMIT;

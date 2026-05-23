BEGIN;

-- ============================================================
-- C18: FORCE ROW LEVEL SECURITY nas tabelas com ENABLE mas sem FORCE
-- Derivado do MIGRATIONS_FULL: 30 tabelas identificadas.
-- Tabelas financeiras core (bank_*, actors) já têm FORCE — não incluídas.
-- Guard por pg_class.relforcerowsecurity = false garante idempotência.
-- ============================================================

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'actor_category_imports',
    'b2b_payment_intents',
    'categories',
    'event_idempotency_tracking',
    'event_log',
    'feature_flags',
    'fulfillment_items',
    'fulfillment_orders',
    'inventory_balances',
    'inventory_lots',
    'inventory_movements',
    'inventory_reservations',
    'order_items',
    'pdv_sessions',
    'permissions',
    'product_offers',
    'product_prices',
    'product_variants',
    'promotions',
    'purchase_order_items',
    'purchase_orders',
    'role_permissions',
    'roles',
    'service_discovery_requests',
    'stock_transfer_items',
    'stock_transfer_receipt_items',
    'stock_transfer_receipts',
    'stock_transfers',
    'suppliers',
    'user_roles'
  ]) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
        AND c.relrowsecurity = true
        AND c.relforcerowsecurity = false
    ) THEN
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

COMMIT;

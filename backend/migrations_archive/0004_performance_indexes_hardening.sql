-- ============================================================
-- UNIFICARD - PERFORMANCE HARDENING (SAFE FORWARD-ONLY)
-- Compatível com execução fora de ordem (criação tardia de tabelas)
-- ============================================================

-- ============================================================
-- ORDERS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN

    CREATE INDEX IF NOT EXISTS idx_orders_seller_status_created
      ON orders (tenant_id, seller_actor_id, status, created_at DESC)
      WHERE status IN ('SUBMITTED', 'DRAFT');

    CREATE INDEX IF NOT EXISTS idx_orders_buyer_status_created
      ON orders (tenant_id, buyer_actor_id, status, created_at DESC)
      WHERE status IN ('SUBMITTED', 'DRAFT');

    CREATE INDEX IF NOT EXISTS idx_orders_metadata_pdv_session
      ON orders (tenant_id, (metadata->>'pdv_session_id'))
      WHERE metadata->>'pdv_session_id' IS NOT NULL;

  END IF;
END $$;

-- ============================================================
-- PAYMENT_TRANSACTIONS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN

    CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_created
      ON payment_transactions (tenant_id, status, created_at DESC)
      WHERE status IN ('PENDING', 'SUCCESS', 'FAILED');

    CREATE INDEX IF NOT EXISTS idx_payment_transactions_intent_status
      ON payment_transactions (tenant_id, payment_intent_id, status)
      WHERE status IN ('PENDING', 'SUCCESS');

    CREATE INDEX IF NOT EXISTS idx_payment_transactions_idempotency
      ON payment_transactions (tenant_id, payment_intent_id, (metadata->>'idempotency_key'))
      WHERE metadata->>'idempotency_key' IS NOT NULL;

  END IF;
END $$;

-- ============================================================
-- PAYOUT_TRANSACTIONS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_transactions') THEN

    CREATE INDEX IF NOT EXISTS idx_payout_transactions_status_created
      ON payout_transactions (tenant_id, status, created_at DESC)
      WHERE status IN ('PENDING', 'SUCCESS', 'FAILED');

    CREATE INDEX IF NOT EXISTS idx_payout_transactions_intent_status
      ON payout_transactions (tenant_id, payment_intent_id, status)
      WHERE status IN ('PENDING', 'SUCCESS');

    CREATE INDEX IF NOT EXISTS idx_payout_transactions_idempotency
      ON payout_transactions (tenant_id, payment_intent_id, payment_split_id, (metadata->>'idempotency_key'))
      WHERE metadata->>'idempotency_key' IS NOT NULL;

  END IF;
END $$;

-- ============================================================
-- INVENTORY_MOVEMENTS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_movements') THEN

    CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_type_created
      ON inventory_movements (tenant_id, product_variant_id, movement_type, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference_type_id
      ON inventory_movements (tenant_id, reference_type, reference_id)
      WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

  END IF;
END $$;

-- ============================================================
-- INVENTORY_RESERVATIONS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_reservations') THEN

    CREATE INDEX IF NOT EXISTS idx_inventory_reservations_variant_active
      ON inventory_reservations (tenant_id, product_variant_id, status, created_at)
      WHERE status = 'ACTIVE';

    CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_status
      ON inventory_reservations (tenant_id, order_id, status)
      WHERE status IN ('ACTIVE', 'RELEASED', 'CONSUMED');

    CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expired
      ON inventory_reservations (tenant_id, status, expires_at)
      WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

  END IF;
END $$;

-- ============================================================
-- PAYMENT_INTENTS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_intents') THEN

    CREATE INDEX IF NOT EXISTS idx_payment_intents_status_created
      ON payment_intents (tenant_id, status, created_at DESC)
      WHERE status IN ('CREATED', 'AUTHORIZED', 'FAILED', 'CANCELLED');

    CREATE INDEX IF NOT EXISTS idx_payment_intents_order_status
      ON payment_intents (tenant_id, order_id, status)
      WHERE status IN ('CREATED', 'AUTHORIZED');

  END IF;
END $$;

-- ============================================================
-- ALERTS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts') THEN

    CREATE INDEX IF NOT EXISTS idx_alerts_status_severity_created
      ON alerts (tenant_id, status, severity, created_at DESC)
      WHERE status IN ('OPEN', 'ACK');

    CREATE INDEX IF NOT EXISTS idx_alerts_entity
      ON alerts (tenant_id, entity_type, entity_id)
      WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

  END IF;
END $$;

-- ============================================================
-- PDV_SESSIONS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pdv_sessions') THEN

    CREATE INDEX IF NOT EXISTS idx_pdv_sessions_status_created
      ON pdv_sessions (tenant_id, actor_id, status, created_at DESC)
      WHERE status IN ('OPEN', 'CLOSED');

  END IF;
END $$;

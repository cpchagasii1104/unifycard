-- ============================================================
-- UNIFICARD - MIGRATION 187
-- SPRINT 52: PERFORMANCE, ESCALA E HARDENING
-- Índices de Performance para Tabelas Grandes
-- ============================================================
--
-- OBJETIVO:
-- Adicionar índices compostos e partial indexes para otimizar
-- queries em tabelas grandes (orders, payments, inventory).
--
-- REGRAS:
-- - Índices compostos para queries comuns
-- - Partial indexes para reduzir tamanho (status ACTIVE/PENDING)
-- - Não altera schema nem dados
-- ============================================================

-- ============================================================
-- ORDERS - Índices Compostos
-- ============================================================

-- Listagem por seller + status + data (query comum)
CREATE INDEX IF NOT EXISTS idx_orders_seller_status_created
  ON orders (tenant_id, seller_actor_id, status, created_at DESC)
  WHERE status IN ('SUBMITTED', 'DRAFT');

-- Listagem por buyer + status + data
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status_created
  ON orders (tenant_id, buyer_actor_id, status, created_at DESC)
  WHERE status IN ('SUBMITTED', 'DRAFT');

-- Busca por metadata (pdv_session_id) - usado em relatórios
CREATE INDEX IF NOT EXISTS idx_orders_metadata_pdv_session
  ON orders (tenant_id, (metadata->>'pdv_session_id'))
  WHERE metadata->>'pdv_session_id' IS NOT NULL;

-- ============================================================
-- PAYMENT_TRANSACTIONS - Índices Compostos
-- ============================================================

-- Listagem por status + data (queries de relatório)
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_created
  ON payment_transactions (tenant_id, status, created_at DESC)
  WHERE status IN ('PENDING', 'SUCCESS', 'FAILED');

-- Busca por payment_intent + status
CREATE INDEX IF NOT EXISTS idx_payment_transactions_intent_status
  ON payment_transactions (tenant_id, payment_intent_id, status)
  WHERE status IN ('PENDING', 'SUCCESS');

-- Busca por idempotency_key (usado em idempotência)
CREATE INDEX IF NOT EXISTS idx_payment_transactions_idempotency
  ON payment_transactions (tenant_id, payment_intent_id, (metadata->>'idempotency_key'))
  WHERE metadata->>'idempotency_key' IS NOT NULL;

-- ============================================================
-- PAYOUT_TRANSACTIONS - Índices Compostos
-- ============================================================

-- Listagem por status + data
CREATE INDEX IF NOT EXISTS idx_payout_transactions_status_created
  ON payout_transactions (tenant_id, status, created_at DESC)
  WHERE status IN ('PENDING', 'SUCCESS', 'FAILED');

-- Busca por payment_intent + status
CREATE INDEX IF NOT EXISTS idx_payout_transactions_intent_status
  ON payout_transactions (tenant_id, payment_intent_id, status)
  WHERE status IN ('PENDING', 'SUCCESS');

-- Busca por idempotency_key
CREATE INDEX IF NOT EXISTS idx_payout_transactions_idempotency
  ON payout_transactions (tenant_id, payment_intent_id, payment_split_id, (metadata->>'idempotency_key'))
  WHERE metadata->>'idempotency_key' IS NOT NULL;

-- ============================================================
-- INVENTORY_MOVEMENTS - Índices Compostos
-- ============================================================

-- Cálculo de saldo por variante (query mais comum)
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_type_created
  ON inventory_movements (tenant_id, product_variant_id, movement_type, created_at DESC);

-- Busca por referência (order_id, etc)
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference_type_id
  ON inventory_movements (tenant_id, reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

-- ============================================================
-- INVENTORY_RESERVATIONS - Índices Compostos
-- ============================================================

-- Busca reservas ativas por variante (query crítica para concorrência)
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_variant_active
  ON inventory_reservations (tenant_id, product_variant_id, status, created_at)
  WHERE status = 'ACTIVE';

-- Busca reservas por order (usado em release/consume)
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_status
  ON inventory_reservations (tenant_id, order_id, status)
  WHERE status IN ('ACTIVE', 'RELEASED', 'CONSUMED');

-- Busca reservas expiradas (para limpeza)
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expired
  ON inventory_reservations (tenant_id, status, expires_at)
  WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

-- ============================================================
-- PAYMENT_INTENTS - Índices Compostos
-- ============================================================

-- Listagem por status + data
CREATE INDEX IF NOT EXISTS idx_payment_intents_status_created
  ON payment_intents (tenant_id, status, created_at DESC)
  WHERE status IN ('CREATED', 'AUTHORIZED', 'FAILED', 'CANCELLED');

-- Busca por order + status
CREATE INDEX IF NOT EXISTS idx_payment_intents_order_status
  ON payment_intents (tenant_id, order_id, status)
  WHERE status IN ('CREATED', 'AUTHORIZED');

-- ============================================================
-- ALERTS - Índices Compostos
-- ============================================================

-- Listagem por status + severidade + data
CREATE INDEX IF NOT EXISTS idx_alerts_status_severity_created
  ON alerts (tenant_id, status, severity, created_at DESC)
  WHERE status IN ('OPEN', 'ACK');

-- Busca por entidade (entity_type + entity_id)
CREATE INDEX IF NOT EXISTS idx_alerts_entity
  ON alerts (tenant_id, entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

-- ============================================================
-- PDV_SESSIONS - Índices Compostos
-- ============================================================

-- Listagem por status + data
CREATE INDEX IF NOT EXISTS idx_pdv_sessions_status_created
  ON pdv_sessions (tenant_id, actor_id, status, created_at DESC)
  WHERE status IN ('OPEN', 'CLOSED');

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON INDEX idx_orders_seller_status_created IS
  'Otimiza listagem de pedidos por vendedor, status e data (queries de relatório)';

COMMENT ON INDEX idx_payment_transactions_idempotency IS
  'Otimiza busca por idempotency_key para evitar duplicação de pagamentos';

COMMENT ON INDEX idx_inventory_reservations_variant_active IS
  'Otimiza busca de reservas ativas por variante (crítico para concorrência)';

COMMENT ON INDEX idx_inventory_reservations_expired IS
  'Otimiza busca de reservas expiradas para limpeza automática';








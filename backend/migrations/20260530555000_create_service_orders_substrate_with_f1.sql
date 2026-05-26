-- ============================================================
-- Materializa service_orders no schema vivo + campos da Camada 1 F1
-- ============================================================
-- Sessão: 2026-05-26 (Camada 1 — fatia F1, decisão Clayton K0)
--
-- Contexto material:
--   Auditoria de READ-FIRST (sessão Camada 1 F1) revelou que a tabela
--   `service_orders` NÃO EXISTIA no banco vivo (unificard_dev) — apesar
--   de todo o módulo `services/service-order.*.ts` operar sobre ela em
--   código. A migration histórica que a criava está em
--   `backend/migrations_archive/0610_service_orders.sql` e nunca foi
--   re-aplicada como ativa após o reset do schema canônico.
--
--   Esta migration MATERIALIZA a tabela no schema atual, com adaptações:
--
--   (a) Status enum em LOWERCASE — bate com o uso real no
--       service-order.repository.ts (`WHERE status='in_progress'`).
--       O archived 0610 usava UPPERCASE ('DRAFT', 'CONFIRMED'). Adoção
--       lowercase é convergência com 07_NOMENCLATURA_CANONICA §4.11.
--       Adiciona o status NOVO `seller_pending` exigido pela F1 (Camada 1
--       saída — prestador conclui serviço de preço-fechado).
--
--   (b) `service_bookings` referenciada pelo archived 0610 NÃO EXISTE
--       no schema vivo (auditoria confirmou); a tabela viva de booking
--       é `bookings`. Para não criar FK quebrada, `booking_id` fica
--       NULLABLE sem FK ativa nesta migration (a FK pode ser adicionada
--       em fatia posterior quando o contrato bookings × service_orders
--       for materializado).
--
--   (c) Campos da F1 (Camada 1 saída) desde o nascimento — evita
--       segunda migration por ALTER TABLE em sequência:
--         - settlement_flow TEXT NOT NULL DEFAULT 'none'
--           CHECK (settlement_flow IN ('none', 'fixed_price_escrow'))
--           Discriminador explícito do fluxo econômico (decisão Clayton
--           K1 atualizado): pricing_type não é critério primário; o
--           service_order carrega seu próprio discriminador.
--         - buyer_confirmation_deadline_at TIMESTAMPTZ NULL
--         - buyer_confirmed_completion_at  TIMESTAMPTZ NULL
--         - release_eligible_at            TIMESTAMPTZ NULL
--         - disputed_at                    TIMESTAMPTZ NULL
--         - dispute_id                     UUID NULL (sem FK — não há
--           tabela canônica única de disputas; `financial_disputes`
--           existe mas é específica do plano bank, não obrigatória aqui).
--
--   (d) `decision_id UUID` — coluna referenciada pelo repository vivo
--       (service-order.repository.ts:17) mas ausente do archived 0610.
--       Adicionada agora; sem FK formal a `service_booking_decisions`
--       (existe, mas mantemos nullable + sem FK para tolerar criações
--       sem decision vinculada).
--
--   (e) RLS pattern alinhado com o set_config canônico do pool
--       (`app.current_tenant`, não `app.current_tenant_id` do archived).
--       Pattern idêntico a service_payment_executions.
--
--   Pivôs decididos (decisão Clayton, NÃO inferência):
--     - K0: materializar service_orders agora (em vez de pivotar F1
--           para outra entidade viva como service_payment_requests).
--     - K1: discriminador via `settlement_flow` em service_orders, NÃO
--           via services.pricing_type (drift documentado em
--           DT-SERVICES-PRICING-TYPE-DRIFT).
--     - K2: F1 ignora escrow_accounts / payment_milestones / agreement
--           escrow (Opção 1). DT-DOUBLE-ESCROW-PLANES rastreia.
--
-- Reversibilidade: ALTA — DROP TABLE service_orders + DROP TYPE
-- service_order_status. Zero dado vivo a migrar (auditoria confirmou
-- 0 rows; tabela inexistente).
-- Blast: BAIXO — código vivo JÁ espera a tabela; criar a tabela
-- materializa o que o código pressupunha.
-- ============================================================

BEGIN;

-- ============================================================
-- ENUM: service_order_status (lowercase canônico)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_order_status') THEN
    CREATE TYPE service_order_status AS ENUM (
      'draft',
      'confirmed',
      'in_progress',
      'completed',
      'seller_pending',  -- F1 (Camada 1 saída): prestador concluiu serviço fixed_price_escrow
      'cancelled'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: service_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS service_orders (
  -- Identificação
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,

  -- Relacionamentos canônicos
  service_id UUID NOT NULL
    REFERENCES services(service_id) ON DELETE CASCADE,
  worker_actor_id UUID NOT NULL
    REFERENCES actors(id) ON DELETE CASCADE,
  customer_actor_id UUID NOT NULL
    REFERENCES actors(id) ON DELETE CASCADE,

  -- Vínculos opcionais (nullable; FKs adicionais ficam para fatias
  -- futuras quando o contrato canônico bookings↔service_orders e
  -- service_booking_decisions↔service_orders for materializado).
  booking_id  UUID,  -- aponta para `bookings` (tabela viva)
  decision_id UUID,  -- aponta para `service_booking_decisions` (existe)

  -- Status canônico
  status service_order_status NOT NULL DEFAULT 'draft',

  -- ============================================================
  -- Camada 1 — F1 (decisão Clayton K1 atualizado)
  -- ============================================================
  -- Discriminador explícito de fluxo econômico. F1 só aplica
  -- `seller_pending` quando settlement_flow='fixed_price_escrow'.
  -- 'none' = ordem sem fluxo Camada 1 (default — preserva legado).
  settlement_flow TEXT NOT NULL DEFAULT 'none'
    CHECK (settlement_flow IN ('none', 'fixed_price_escrow')),

  -- F1: deadline para buyer confirmar conclusão (now()+7d, configurável).
  buyer_confirmation_deadline_at TIMESTAMPTZ,
  -- F1: timestamp da confirmação do buyer (D2 caminho rápido — futuro).
  buyer_confirmed_completion_at  TIMESTAMPTZ,
  -- F1: momento a partir do qual release-worker pode mover seller_pending
  -- → seller_available. Materializado para indexação eficiente.
  release_eligible_at            TIMESTAMPTZ,
  -- F1: disputa abre, pausa release (D2 — futuro). dispute_id sem FK.
  disputed_at                    TIMESTAMPTZ,
  dispute_id                     UUID,

  -- Agendamento
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ,
  estimated_duration_minutes INTEGER
    CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0),

  -- Localização opcional
  location_address TEXT,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),

  -- Notas
  description TEXT,
  customer_notes TEXT,
  worker_notes TEXT,

  -- Criação + ciclo de vida
  created_by_actor_id UUID NOT NULL
    REFERENCES actors(id) ON DELETE CASCADE,
  created_by_user_id UUID,
  confirmed_at TIMESTAMPTZ,
  confirmed_by_actor_id UUID
    REFERENCES actors(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Metadata + timestamps
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT check_scheduled_end_after_start
    CHECK (scheduled_end IS NULL OR scheduled_end > scheduled_start)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_service_orders_tenant_id
  ON service_orders(tenant_id);

CREATE INDEX IF NOT EXISTS idx_service_orders_service_id
  ON service_orders(tenant_id, service_id);

CREATE INDEX IF NOT EXISTS idx_service_orders_worker
  ON service_orders(tenant_id, worker_actor_id, status);

CREATE INDEX IF NOT EXISTS idx_service_orders_customer
  ON service_orders(tenant_id, customer_actor_id, status);

CREATE INDEX IF NOT EXISTS idx_service_orders_status
  ON service_orders(tenant_id, status, scheduled_start);

CREATE INDEX IF NOT EXISTS idx_service_orders_scheduled
  ON service_orders(tenant_id, scheduled_start)
  WHERE status IN ('confirmed', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_service_orders_booking
  ON service_orders(tenant_id, booking_id)
  WHERE booking_id IS NOT NULL;

-- F1 — claim futuro do release-worker por release_eligible_at + sem disputa:
CREATE INDEX IF NOT EXISTS idx_service_orders_release_eligible
  ON service_orders(tenant_id, release_eligible_at)
  WHERE status = 'seller_pending' AND disputed_at IS NULL;

-- F1 — segregação rápida por fluxo econômico:
CREATE INDEX IF NOT EXISTS idx_service_orders_settlement_flow
  ON service_orders(tenant_id, settlement_flow)
  WHERE settlement_flow <> 'none';

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_service_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_service_orders_updated_at ON service_orders;
CREATE TRIGGER trigger_update_service_orders_updated_at
  BEFORE UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_service_orders_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Pattern alinhado com service_payment_executions (set_config
-- 'app.current_tenant' aplicado pelo pool.ts:176 / getClientWithTenant).
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY service_orders_tenant_isolation ON service_orders
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE service_orders IS
  'Ordens de Serviço — ciclo operacional. Append-only por status.
   NÃO move dinheiro. Campos F1 (settlement_flow + buyer_confirmation_*
   + release_eligible_at + disputed_at) governam o ciclo Camada 1 saída
   mas NÃO substituem o substrato financeiro (bank_ledger,
   payment_intents). Materializado em 2026-05-26 (decisão Clayton K0).';

COMMENT ON COLUMN service_orders.settlement_flow IS
  'Discriminador de fluxo econômico explícito (decisão K1 atualizado).
   none = ordem sem fluxo Camada 1 (default).
   fixed_price_escrow = ordem cujo pagamento entrou na custódia
     escrow_payments via createExecution refatorado (commit 62771db9).
   F1 só aplica seller_pending para fixed_price_escrow.';

COMMENT ON COLUMN service_orders.buyer_confirmation_deadline_at IS
  'F1 (Camada 1 saída — D2): now()+7d (configurável) carimbado quando
   prestador conclui serviço fixed_price_escrow. Após esse instante,
   release-worker pode mover seller_pending → seller_available, salvo
   disputa.';

COMMENT ON COLUMN service_orders.release_eligible_at IS
  'F1: momento mínimo para release elegível. Hoje = deadline; em
   futuras fatias, pode ser antecipado por buyer_confirmed_completion_at.
   Materializado para indexação eficiente do claim.';

COMMENT ON COLUMN service_orders.disputed_at IS
  'F1: timestamp de abertura de disputa (D2 — futura fatia). Quando
   preenchido, release-worker DEVE pular a row no claim.';

COMMIT;

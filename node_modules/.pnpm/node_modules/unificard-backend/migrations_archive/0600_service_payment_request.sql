-- ============================================================
-- UNIFICARD — SERVICE PAYMENT REQUEST DOMAIN
-- Arquivo: 140_service_payment_request.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o domínio de PAGAMENTO (Payment Request / Payment Intent)
-- Usando dinheiro fictício para testes
--
-- REGRAS CANÔNICAS:
-- * Pagamento nasce APÓS booking aceito
-- * Pagamento é um PEDIDO de pagamento, não execução automática
-- * Nenhum dinheiro real
-- * Nenhum split ainda
-- * Nenhuma confirmação automática
-- * Só pode criar payment se existir booking_decision = accepted
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_request_status') THEN
    CREATE TYPE payment_request_status AS ENUM (
      'pending',   -- Pedido de pagamento pendente
      'cancelled', -- Pedido de pagamento cancelado
      'expired'    -- Pedido de pagamento expirado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: SERVICE_PAYMENT_REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS service_payment_requests (
  payment_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: Pagamento nasce APÓS booking aceito
  -- 🔴 BLINDAGEM: Pagamento é um PEDIDO de pagamento, não execução automática
  booking_id UUID NOT NULL REFERENCES service_bookings(booking_id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
  payer_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor que paga
  receiver_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor que recebe (dono do service)
  
  -- Status
  status payment_request_status NOT NULL DEFAULT 'pending',
  
  -- Informações Financeiras
  amount NUMERIC(18, 2) NOT NULL, -- Valor do pagamento
  currency VARCHAR(3) NOT NULL DEFAULT 'FIC', -- Moeda fictícia (ex: FIC = Fictícia)
  
  -- Informações do Pedido
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ, -- Quando foi cancelado (se status = 'cancelled')
  expired_at TIMESTAMPTZ, -- Quando expirou (se status = 'expired')
  
  -- Constraints
  CONSTRAINT service_payment_requests_amount_positive CHECK (amount > 0)
    -- 🔴 BLINDAGEM: Apenas um pedido de pagamento por booking
    -- Booking e Decision continuam imutáveis
);

-- Índice único: apenas um pedido de pagamento por booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_payment_requests_unique_per_booking
  ON service_payment_requests(booking_id);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_service_payment_requests_booking_id ON service_payment_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_requests_service_id ON service_payment_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_requests_payer_actor_id ON service_payment_requests(payer_actor_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_requests_receiver_actor_id ON service_payment_requests(receiver_actor_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_requests_tenant_id ON service_payment_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_requests_status ON service_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_payment_requests_requested_at ON service_payment_requests(requested_at);

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_service_payment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_payment_requests_updated_at
  BEFORE UPDATE ON service_payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_service_payment_requests_updated_at();

-- ============================================================
-- TRIGGER: SET cancelled_at ou expired_at quando status muda
-- ============================================================

CREATE OR REPLACE FUNCTION set_service_payment_requests_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Se status mudou para 'cancelled' e cancelled_at ainda é NULL, definir
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at = now();
  END IF;
  
  -- Se status mudou para 'expired' e expired_at ainda é NULL, definir
  IF NEW.status = 'expired' AND OLD.status != 'expired' AND NEW.expired_at IS NULL THEN
    NEW.expired_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_payment_requests_timestamps
  BEFORE UPDATE ON service_payment_requests
  FOR EACH ROW
  WHEN (NEW.status != OLD.status)
  EXECUTE FUNCTION set_service_payment_requests_timestamps();

COMMIT;

-- ============================================================
-- FIM 140_service_payment_request.sql
-- ============================================================


-- ============================================================
-- UNIFICARD — SERVICE BOOKING DOMAIN
-- Arquivo: 138_service_booking.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o domínio de BOOKING / RESERVA para serviços
-- Booking é um PEDIDO
-- Booking NÃO confirma
-- Booking NÃO cobra
-- Booking NÃO bloqueia agenda
-- Booking NÃO escolhe prioridade
-- Booking NÃO faz matching
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM (
      'requested',   -- Pedido solicitado (aguardando resposta)
      'cancelled',   -- Pedido cancelado (pelo solicitante ou provedor)
      'expired'      -- Pedido expirado (sem resposta dentro do prazo)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: SERVICE_BOOKINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS service_bookings (
  booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: Booking é um PEDIDO, não confirmação
  service_id UUID NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
  availability_id UUID NOT NULL REFERENCES service_availability(availability_id) ON DELETE CASCADE,
  requester_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor que solicita o booking
  
  -- Status
  status booking_status NOT NULL DEFAULT 'requested',
  
  -- Informações do Pedido
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT, -- Notas opcionais do solicitante
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ, -- Quando foi cancelado (se status = 'cancelled')
  expired_at TIMESTAMPTZ -- Quando expirou (se status = 'expired')

  -- Constraints
  -- 🔴 BLINDAGEM: Apenas um pedido ativo por disponibilidade por solicitante
  -- Validação de unicidade será feita via índice único parcial abaixo
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_service_bookings_service_id ON service_bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_availability_id ON service_bookings(availability_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_requester_actor_id ON service_bookings(requester_actor_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_tenant_id ON service_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_bookings_status ON service_bookings(status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_requested_at ON service_bookings(requested_at);

-- Índice único parcial: apenas um pedido 'requested' por disponibilidade por solicitante
-- 🔴 BLINDAGEM: Evita múltiplos pedidos ativos para mesma disponibilidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_bookings_unique_request_per_availability
  ON service_bookings(tenant_id, availability_id, requester_actor_id)
  WHERE status = 'requested';

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_service_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_bookings_updated_at
  BEFORE UPDATE ON service_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_service_bookings_updated_at();

-- ============================================================
-- TRIGGER: SET cancelled_at ou expired_at quando status muda
-- ============================================================

CREATE OR REPLACE FUNCTION set_service_bookings_timestamps()
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

CREATE TRIGGER trg_service_bookings_timestamps
  BEFORE UPDATE ON service_bookings
  FOR EACH ROW
  WHEN (NEW.status != OLD.status)
  EXECUTE FUNCTION set_service_bookings_timestamps();

COMMIT;

-- ============================================================
-- FIM 138_service_booking.sql
-- ============================================================


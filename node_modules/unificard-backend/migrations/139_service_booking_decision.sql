-- ============================================================
-- UNIFICARD — SERVICE BOOKING DECISION DOMAIN
-- Arquivo: 139_service_booking_decision.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o domínio de CONFIRMAÇÃO / DECISÃO DE BOOKING
-- Booking Decision = decisão humana explícita
-- Nunca automática
-- Nunca baseada em score, educação, aprendizado ou reputação
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_decision_status') THEN
    CREATE TYPE booking_decision_status AS ENUM (
      'accepted',  -- Booking aceito (decisão humana explícita)
      'rejected'   -- Booking rejeitado (decisão humana explícita)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: SERVICE_BOOKING_DECISIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS service_booking_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: Decision é decisão humana explícita, nunca automática
  booking_id UUID NOT NULL REFERENCES service_bookings(booking_id) ON DELETE CASCADE,
  decided_by_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor que decide (dono do service)
  
  -- Status da Decisão
  status booking_decision_status NOT NULL,
  
  -- Informações da Decisão
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT, -- Motivo da decisão (opcional)
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  -- 🔴 BLINDAGEM: Apenas uma decisão por booking
  -- Booking continua existindo mesmo se rejeitado
  -- Decisão não apaga booking
  -- Nada é sobrescrito
  CONSTRAINT service_booking_decisions_unique_per_booking UNIQUE (booking_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_service_booking_decisions_booking_id ON service_booking_decisions(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_booking_decisions_decided_by_actor_id ON service_booking_decisions(decided_by_actor_id);
CREATE INDEX IF NOT EXISTS idx_service_booking_decisions_tenant_id ON service_booking_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_booking_decisions_status ON service_booking_decisions(status);
CREATE INDEX IF NOT EXISTS idx_service_booking_decisions_decided_at ON service_booking_decisions(decided_at);

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_service_booking_decisions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_booking_decisions_updated_at
  BEFORE UPDATE ON service_booking_decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_service_booking_decisions_updated_at();

COMMIT;

-- ============================================================
-- FIM 139_service_booking_decision.sql
-- ============================================================


-- ============================================================
-- UNIFICARD — UNIFIED AVAILABILITY CORE
-- Arquivo: 144_unified_availability.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o CORE unificado de disponibilidade que suporta:
-- - user (disponibilidade de usuário)
-- - service (disponibilidade de serviço)
-- - event (disponibilidade de evento)
-- - group (disponibilidade de grupo)
--
-- REGRAS CANÔNICAS:
-- * Availability NÃO decide quem pode agendar
-- * Availability NÃO faz pagamento
-- * Availability NÃO faz matching
-- * Availability apenas expõe janelas disponíveis
-- * Evita sobreposição de horários por owner
-- * Suporta capacidade opcional
--
-- NOTA: Esta migration NÃO remove tabelas antigas (service_availability, service_bookings)
-- Apenas prepara a estrutura unificada para migração futura
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_owner_type') THEN
    CREATE TYPE availability_owner_type AS ENUM (
      'user',     -- Disponibilidade de usuário
      'service',  -- Disponibilidade de serviço
      'event',    -- Disponibilidade de evento
      'group'     -- Disponibilidade de grupo
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unified_availability_type') THEN
    CREATE TYPE unified_availability_type AS ENUM (
      'fixed',        -- Janela fixa (ex: 09:00-18:00)
      'recurring',    -- Recorrente (ex: toda segunda-feira 09:00-12:00)
      'on_demand'     -- Sob demanda (sem horário fixo)
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unified_availability_status') THEN
    CREATE TYPE unified_availability_status AS ENUM (
      'active',       -- Ativa (janelas disponíveis)
      'paused'        -- Pausada (janelas não disponíveis)
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unified_booking_status') THEN
    CREATE TYPE unified_booking_status AS ENUM (
      'requested',    -- Pedido solicitado (aguardando resposta)
      'confirmed',    -- Confirmado (aceito)
      'cancelled',    -- Cancelado
      'expired',      -- Expirado
      'checked_in',   -- Check-in realizado
      'checked_out'   -- Check-out realizado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: AVAILABILITY (UNIFIED)
-- ============================================================

CREATE TABLE IF NOT EXISTS availability (
  availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Owner (polimórfico)
  -- 🔴 BLINDAGEM: Availability pode pertencer a user, service, event ou group
  -- 🔴 BLINDAGEM: NÃO decide quem pode agendar, apenas expõe janelas
  owner_type availability_owner_type NOT NULL,
  owner_id UUID NOT NULL, -- ID do owner (user_id, service_id, event_id, group_id)
  
  -- Tipo e Status
  availability_type unified_availability_type NOT NULL DEFAULT 'fixed',
  status unified_availability_status NOT NULL DEFAULT 'active',
  
  -- Janelas de Disponibilidade
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo', -- IANA timezone
  
  -- Capacidade (opcional)
  -- 🔴 BLINDAGEM: Capacidade é informação, não decisão de quem pode agendar
  capacity INTEGER, -- Número máximo de agendamentos simultâneos (NULL = ilimitado)
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT availability_time_check CHECK (end_datetime > start_datetime),
  CONSTRAINT availability_capacity_check CHECK (capacity IS NULL OR capacity > 0)
);

-- ============================================================
-- ÍNDICES - AVAILABILITY
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_availability_owner ON availability(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_availability_tenant_id ON availability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_availability_status ON availability(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_availability_datetime ON availability(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_availability_type ON availability(availability_type);

-- Índice composto para busca de disponibilidades ativas por owner
CREATE INDEX IF NOT EXISTS idx_availability_owner_active 
  ON availability(owner_type, owner_id, status, start_datetime, end_datetime) 
  WHERE status = 'active';

-- ============================================================
-- TRIGGER: PREVENIR SOBREPOSIÇÃO DE HORÁRIOS POR OWNER
-- ============================================================

-- 🔴 BLINDAGEM: Trigger para evitar sobreposição de horários por owner
-- NÃO decide quem pode agendar, apenas garante integridade temporal
CREATE OR REPLACE FUNCTION prevent_availability_overlap()
RETURNS TRIGGER AS $$
DECLARE
  overlapping_count INTEGER;
BEGIN
  -- Verificar se existe disponibilidade sobreposta para o mesmo owner
  SELECT COUNT(*) INTO overlapping_count
  FROM availability
  WHERE tenant_id = NEW.tenant_id
    AND owner_type = NEW.owner_type
    AND owner_id = NEW.owner_id
    AND availability_id != COALESCE(NEW.availability_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status = 'active'
    AND (
      -- Sobreposição: início ou fim dentro de outra janela
      (NEW.start_datetime >= start_datetime AND NEW.start_datetime < end_datetime)
      OR (NEW.end_datetime > start_datetime AND NEW.end_datetime <= end_datetime)
      OR (NEW.start_datetime <= start_datetime AND NEW.end_datetime >= end_datetime)
    );
  
  IF overlapping_count > 0 THEN
    RAISE EXCEPTION 'Sobreposição de horários não permitida para o mesmo owner (owner_type: %, owner_id: %)', NEW.owner_type, NEW.owner_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_availability_overlap
  BEFORE INSERT OR UPDATE ON availability
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION prevent_availability_overlap();

-- ============================================================
-- TRIGGER: UPDATE updated_at - AVAILABILITY
-- ============================================================

CREATE OR REPLACE FUNCTION update_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_availability_updated_at
  BEFORE UPDATE ON availability
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_updated_at();

-- ============================================================
-- TABELA: BOOKINGS (UNIFIED)
-- ============================================================

CREATE TABLE IF NOT EXISTS bookings (
  booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamento com Availability (OBRIGATÓRIO)
  -- 🔴 BLINDAGEM: Booking referencia availability, NÃO executa pagamento
  availability_id UUID NOT NULL REFERENCES availability(availability_id) ON DELETE CASCADE,
  
  -- Requester
  requester_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  
  -- Status
  status unified_booking_status NOT NULL DEFAULT 'requested',
  
  -- Check-in / Check-out
  -- 🔴 BLINDAGEM: Check-in/check-out são apenas registro, NÃO executam pagamento
  checked_in_at TIMESTAMPTZ, -- Quando foi feito check-in
  checked_out_at TIMESTAMPTZ, -- Quando foi feito check-out
  
  -- Informações do Booking
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT, -- Notas opcionais do solicitante
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ, -- Quando foi cancelado (se status = 'cancelled')
  expired_at TIMESTAMPTZ, -- Quando expirou (se status = 'expired')
  confirmed_at TIMESTAMPTZ, -- Quando foi confirmado (se status = 'confirmed')
  
  -- Constraints
  CONSTRAINT bookings_check_out_after_check_in CHECK (
    checked_out_at IS NULL OR checked_in_at IS NULL OR checked_out_at >= checked_in_at
  )
);

-- ============================================================
-- ÍNDICES - BOOKINGS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bookings_availability_id ON bookings(availability_id);
CREATE INDEX IF NOT EXISTS idx_bookings_requester_actor_id ON bookings(requester_actor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_requested_at ON bookings(requested_at DESC);

-- Índice composto para busca de bookings por availability e status
CREATE INDEX IF NOT EXISTS idx_bookings_availability_status 
  ON bookings(availability_id, status, requested_at DESC);

-- ============================================================
-- TRIGGER: UPDATE updated_at - BOOKINGS
-- ============================================================

CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_bookings_updated_at();

-- ============================================================
-- FIM 144_unified_availability.sql
-- ============================================================

COMMIT;


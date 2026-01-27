-- 🔴 LEGADO — Estrutura temporal paralela.
-- 🔴 PROIBIDO USO EM NOVO CÓDIGO.
-- 🔴 Migrar para Unified Availability (migration 144).
-- ============================================================
-- UNIFICARD — SERVICE AVAILABILITY DOMAIN
-- Arquivo: 137_service_availability.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o domínio de AGENDA & DISPONIBILIDADE para serviços
-- Agenda pertence a um Service (obrigatório)
-- Agenda NÃO pertence diretamente ao Actor
-- Agenda NÃO decide quem pode agendar
-- Agenda NÃO faz pagamento
-- Agenda NÃO faz matching
-- Agenda apenas expõe janelas disponíveis
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_type') THEN
    CREATE TYPE availability_type AS ENUM (
      'fixed',        -- Janela fixa (ex: 09:00-18:00)
      'recurring',    -- Recorrente (ex: toda segunda-feira 09:00-12:00)
      'on_demand'     -- Sob demanda (sem horário fixo)
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_status') THEN
    CREATE TYPE availability_status AS ENUM (
      'active',       -- Ativa (janelas disponíveis)
      'paused'        -- Pausada (janelas não disponíveis)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: SERVICE_AVAILABILITY
-- ============================================================

CREATE TABLE IF NOT EXISTS service_availability (
  availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamento com Service (OBRIGATÓRIO)
  -- 🔴 BLINDAGEM: Agenda pertence a um Service, não diretamente ao Actor
  service_id UUID NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
  
  -- Tipo e Status
  availability_type availability_type NOT NULL DEFAULT 'fixed',
  status availability_status NOT NULL DEFAULT 'active',
  
  -- Janelas de Disponibilidade
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo', -- IANA timezone (ex: America/Sao_Paulo, UTC)
  
  -- Capacidade (opcional)
  -- 🔴 BLINDAGEM: Capacidade é informação, não decisão de quem pode agendar
  capacity INTEGER, -- Número máximo de agendamentos simultâneos (NULL = ilimitado)
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT service_availability_time_check CHECK (end_datetime > start_datetime),
  CONSTRAINT service_availability_capacity_check CHECK (capacity IS NULL OR capacity > 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_service_availability_service_id ON service_availability(service_id);
CREATE INDEX IF NOT EXISTS idx_service_availability_tenant_id ON service_availability(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_availability_status ON service_availability(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_service_availability_datetime ON service_availability(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_service_availability_type ON service_availability(availability_type);

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_service_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_availability_updated_at
  BEFORE UPDATE ON service_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_service_availability_updated_at();

COMMIT;

-- ============================================================
-- FIM 137_service_availability.sql
-- ============================================================


-- 🔴 LEGADO — Estrutura temporal paralela.
-- 🔴 PROIBIDO USO EM NOVO CÓDIGO.
-- 🔴 Migrar para Unified Availability (migration 144).
-- ============================================================
-- UNIFICARD - MIGRATION 195
-- SPRINT 68: SERVICE ORDERS + AGENDA CANÔNICA
-- Tabela: calendar_events
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de Agenda (Calendar) que:
-- - Representa eventos/bloqueios na agenda
-- - Pode estar vinculado a uma ordem de serviço
-- - Bloqueia conflitos de horário
-- - NÃO executa pagamentos
-- - NÃO emite fiscal
--
-- REGRAS:
-- - Append-only (status muda, mas registros não desaparecem)
-- - Status declarativos
-- - Audit em todas as mudanças
-- - Nada automático sem ação explícita
-- ============================================================

-- ============================================================
-- ENUM: Calendar Event Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_event_type') THEN
    CREATE TYPE calendar_event_type AS ENUM (
      'SERVICE_ORDER',  -- Evento vinculado a uma ordem de serviço
      'BLOCK',          -- Bloqueio manual da agenda
      'UNAVAILABLE',   -- Indisponibilidade (férias, etc.)
      'OTHER'           -- Outro tipo de evento
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: Calendar Event Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_event_status') THEN
    CREATE TYPE calendar_event_status AS ENUM (
      'SCHEDULED',      -- Agendado
      'IN_PROGRESS',    -- Em execução
      'COMPLETED',      -- Concluído
      'CANCELLED'       -- Cancelado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: calendar_events
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Relacionamentos
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE, -- Worker/owner da agenda
    
    -- Referência opcional à ordem de serviço
    service_order_id UUID
        REFERENCES service_orders(id) ON DELETE SET NULL,
    
    -- Tipo e status
    event_type calendar_event_type NOT NULL,
    status calendar_event_status NOT NULL DEFAULT 'SCHEDULED',
    
    -- Informações do evento
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Horários
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Localização (opcional)
    location_address TEXT,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID, -- Opcional: usuário que criou
    
    -- Execução
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_id
    ON calendar_events(tenant_id);

-- Índice para buscar por actor (worker)
CREATE INDEX IF NOT EXISTS idx_calendar_events_actor
    ON calendar_events(tenant_id, actor_id, start_time);

-- Índice para buscar por service_order
CREATE INDEX IF NOT EXISTS idx_calendar_events_service_order
    ON calendar_events(tenant_id, service_order_id)
    WHERE service_order_id IS NOT NULL;

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_calendar_events_type
    ON calendar_events(tenant_id, event_type, status);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_calendar_events_status
    ON calendar_events(tenant_id, status, start_time);

-- Índice para verificação de conflitos (range overlap)
-- Usado para verificar se há eventos conflitantes
CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range
    ON calendar_events(tenant_id, actor_id, start_time, end_time)
    WHERE status IN ('SCHEDULED', 'IN_PROGRESS');

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem eventos do próprio tenant
CREATE POLICY calendar_events_tenant_isolation
    ON calendar_events
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- ============================================================
-- CONSTRAINTS
-- ============================================================
-- end_time deve ser depois de start_time
ALTER TABLE calendar_events
    ADD CONSTRAINT check_end_after_start
    CHECK (end_time > start_time);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE calendar_events IS 'Eventos da agenda (bloqueios, ordens de serviço, indisponibilidades). Append-only: status muda, mas registros não desaparecem.';
COMMENT ON COLUMN calendar_events.event_type IS 'Tipo do evento: SERVICE_ORDER, BLOCK, UNAVAILABLE, OTHER';
COMMENT ON COLUMN calendar_events.status IS 'Status do evento: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED';
COMMENT ON COLUMN calendar_events.service_order_id IS 'Referência opcional à ordem de serviço vinculada';
COMMENT ON COLUMN calendar_events.actor_id IS 'Worker/owner da agenda (quem está ocupado)';







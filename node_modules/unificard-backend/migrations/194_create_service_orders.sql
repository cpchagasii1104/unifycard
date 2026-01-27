-- ============================================================
-- UNIFICARD - MIGRATION 194
-- SPRINT 68: SERVICE ORDERS + AGENDA CANÔNICA
-- Tabela: service_orders
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de Ordens de Serviço (OS) que:
-- - Representa serviço confirmado e agendado
-- - NÃO executa pagamentos
-- - NÃO emite fiscal
-- - NÃO cria automações econômicas
-- - É totalmente auditável e cancelável
--
-- REGRAS:
-- - Append-only (status muda, mas registros não desaparecem)
-- - Status declarativos
-- - Audit em todas as mudanças
-- - Nada automático sem ação explícita
-- ============================================================

-- ============================================================
-- ENUM: Service Order Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_order_status') THEN
    CREATE TYPE service_order_status AS ENUM (
      'DRAFT',        -- Rascunho (não confirmado)
      'CONFIRMED',    -- Confirmado (agendado)
      'IN_PROGRESS',  -- Em execução
      'COMPLETED',    -- Concluído
      'CANCELLED'     -- Cancelado
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
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Relacionamentos
    service_id UUID NOT NULL
        REFERENCES services(service_id) ON DELETE CASCADE,
    worker_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    customer_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Referência opcional ao booking original
    booking_id UUID
        REFERENCES service_bookings(booking_id) ON DELETE SET NULL,
    
    -- Status
    status service_order_status NOT NULL DEFAULT 'DRAFT',
    
    -- Informações do serviço
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE, -- Opcional
    estimated_duration_minutes INTEGER, -- Duração estimada em minutos
    
    -- Localização (opcional)
    location_address TEXT,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    
    -- Notas e descrição
    description TEXT,
    customer_notes TEXT, -- Notas do cliente
    worker_notes TEXT,   -- Notas do worker
    
    -- Criação e confirmação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID, -- Opcional: usuário que criou
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    
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
CREATE INDEX IF NOT EXISTS idx_service_orders_tenant_id
    ON service_orders(tenant_id);

-- Índice para buscar por service
CREATE INDEX IF NOT EXISTS idx_service_orders_service_id
    ON service_orders(tenant_id, service_id);

-- Índice para buscar por worker
CREATE INDEX IF NOT EXISTS idx_service_orders_worker
    ON service_orders(tenant_id, worker_actor_id, status);

-- Índice para buscar por customer
CREATE INDEX IF NOT EXISTS idx_service_orders_customer
    ON service_orders(tenant_id, customer_actor_id, status);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_service_orders_status
    ON service_orders(tenant_id, status, scheduled_start);

-- Índice para buscar por data agendada
CREATE INDEX IF NOT EXISTS idx_service_orders_scheduled
    ON service_orders(tenant_id, scheduled_start)
    WHERE status IN ('CONFIRMED', 'IN_PROGRESS');

-- Índice para buscar por booking
CREATE INDEX IF NOT EXISTS idx_service_orders_booking
    ON service_orders(tenant_id, booking_id)
    WHERE booking_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem ordens do próprio tenant
CREATE POLICY service_orders_tenant_isolation
    ON service_orders
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_service_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_service_orders_updated_at
    BEFORE UPDATE ON service_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_service_orders_updated_at();

-- ============================================================
-- CONSTRAINTS
-- ============================================================
-- scheduled_end deve ser depois de scheduled_start (se fornecido)
ALTER TABLE service_orders
    ADD CONSTRAINT check_scheduled_end_after_start
    CHECK (
        scheduled_end IS NULL OR scheduled_end > scheduled_start
    );

-- estimated_duration_minutes deve ser positivo (se fornecido)
ALTER TABLE service_orders
    ADD CONSTRAINT check_duration_positive
    CHECK (
        estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0
    );

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE service_orders IS 'Ordens de Serviço confirmadas e agendadas. Append-only: status muda, mas registros não desaparecem.';
COMMENT ON COLUMN service_orders.status IS 'Status da ordem: DRAFT, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED';
COMMENT ON COLUMN service_orders.booking_id IS 'Referência opcional ao booking original que gerou esta ordem';
COMMENT ON COLUMN service_orders.scheduled_start IS 'Data/hora agendada para início do serviço';
COMMENT ON COLUMN service_orders.scheduled_end IS 'Data/hora agendada para fim do serviço (opcional)';
COMMENT ON COLUMN service_orders.estimated_duration_minutes IS 'Duração estimada em minutos (opcional)';








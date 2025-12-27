-- ================================================
-- UNIFICARD - MIGRATION 086
-- Event Occupancy Model
-- Modelo de ocupação para eventos (mesa, pessoa, slot, híbrido)
-- ================================================

-- ===========================
-- EVENT OCCUPANCY MODELS
-- ===========================
CREATE TABLE IF NOT EXISTS event_occupancy_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Tipo de ocupação
  occupancy_type VARCHAR(20) NOT NULL CHECK (occupancy_type IN ('TABLE', 'PERSON', 'SLOT', 'HYBRID')),
  
  -- Configuração geral
  total_capacity INT CHECK (total_capacity > 0),
  requires_reservation BOOLEAN NOT NULL DEFAULT false,
  reservation_price_cents INT CHECK (reservation_price_cents >= 0),
  reservation_currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  
  -- Regras de no-show
  no_show_penalty_cents INT CHECK (no_show_penalty_cents >= 0),
  no_show_penalty_currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  auto_cancel_after_minutes INT CHECK (auto_cancel_after_minutes > 0),
  
  -- Configuração específica por tipo
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Para TABLE: { tables: [{ id, name, capacity, price_cents }] }
  -- Para PERSON: { sectors: [{ id, name, capacity, price_cents }] }
  -- Para SLOT: { slots: [{ id, start_time, end_time, price_cents }] }
  -- Para HYBRID: { table_config: {...}, person_config: {...} }
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT event_occupancy_models_unique UNIQUE (event_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_occupancy_models_event ON event_occupancy_models (event_id);
CREATE INDEX IF NOT EXISTS idx_event_occupancy_models_tenant ON event_occupancy_models (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_occupancy_models_type ON event_occupancy_models (occupancy_type);

-- RLS
ALTER TABLE event_occupancy_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_occupancy_models_rls ON event_occupancy_models
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- EVENT RESERVATIONS
-- ===========================
CREATE TABLE IF NOT EXISTS event_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  occupancy_model_id UUID NOT NULL REFERENCES event_occupancy_models(id) ON DELETE CASCADE,
  
  -- Cliente
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  -- Recurso reservado (depende do tipo)
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('TABLE', 'PERSON', 'SLOT')),
  resource_id TEXT, -- ID do recurso (mesa, setor, slot)
  resource_name TEXT, -- Nome legível do recurso
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW', 'CANCELLED')),
  
  -- Pagamento
  reservation_price_cents INT CHECK (reservation_price_cents >= 0),
  reservation_currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  transaction_id UUID, -- Vinculado ao ledger
  
  -- Check-in
  check_in_time TIMESTAMPTZ,
  no_show_time TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_reservations_event ON event_reservations (event_id);
CREATE INDEX IF NOT EXISTS idx_event_reservations_user ON event_reservations (global_user_id);
CREATE INDEX IF NOT EXISTS idx_event_reservations_status ON event_reservations (status);
CREATE INDEX IF NOT EXISTS idx_event_reservations_model ON event_reservations (occupancy_model_id);
CREATE INDEX IF NOT EXISTS idx_event_reservations_resource ON event_reservations (resource_type, resource_id) WHERE resource_id IS NOT NULL;

-- RLS
ALTER TABLE event_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_reservations_rls ON event_reservations
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- TRIGGERS
-- ===========================
CREATE TRIGGER trigger_update_event_occupancy_models_updated_at
  BEFORE UPDATE ON event_occupancy_models
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();

CREATE TRIGGER trigger_update_event_reservations_updated_at
  BEFORE UPDATE ON event_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE event_occupancy_models IS 'Modelos de ocupação para eventos (mesa, pessoa, slot, híbrido)';
COMMENT ON TABLE event_reservations IS 'Reservas de recursos em eventos (mesas, ingressos, slots)';
COMMENT ON COLUMN event_occupancy_models.config IS 'Configuração específica por tipo de ocupação';
COMMENT ON COLUMN event_reservations.resource_id IS 'ID do recurso reservado (mesa, setor, slot)';
COMMENT ON COLUMN event_reservations.resource_name IS 'Nome legível do recurso para exibição';














-- ================================================
-- UNIFICARD - MIGRATION 069
-- Event Commerce (FASE 1.3)
-- Criar tabelas de commerce (tickets, consumptions, parking)
-- ================================================

-- Tabela de ingressos
CREATE TABLE IF NOT EXISTS event_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  schedule_slot_id UUID NULL REFERENCES schedule_slots(slot_id) ON DELETE SET NULL,
  
  price_paid NUMERIC(10,2) NOT NULL,
  transaction_id UUID NULL, -- referência ao UnifyBank ledger
  
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT check_ticket_status CHECK (status IN ('ACTIVE','USED','REFUNDED','CANCELLED')),
  
  qr_code TEXT NOT NULL UNIQUE,
  checked_in_at TIMESTAMPTZ NULL,
  
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_event_user ON event_tickets(event_id, global_user_id);
CREATE INDEX idx_tickets_qr ON event_tickets(qr_code);
CREATE INDEX idx_tickets_event_status ON event_tickets(event_id, status);

-- RLS
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON event_tickets
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Tabela de consumo
CREATE TABLE IF NOT EXISTS event_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  item_name TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  
  transaction_id UUID NULL,
  
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consumptions_event ON event_consumptions(event_id, created_at DESC);
CREATE INDEX idx_consumptions_user ON event_consumptions(global_user_id, created_at DESC);

ALTER TABLE event_consumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON event_consumptions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Tabela de estacionamento
CREATE TABLE IF NOT EXISTS event_parking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  vehicle_plate TEXT,
  
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ NULL,
  
  hourly_rate NUMERIC(10,2) NULL,
  total_amount NUMERIC(10,2) NULL,
  
  transaction_id UUID NULL,
  
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT check_parking_status CHECK (status IN ('ACTIVE','EXITED','PAID')),
  
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parking_event_status ON event_parking(event_id, status);
CREATE INDEX idx_parking_user_status ON event_parking(global_user_id, status);

ALTER TABLE event_parking ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON event_parking
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Triggers para updated_at
CREATE TRIGGER trigger_update_event_tickets_updated_at
  BEFORE UPDATE ON event_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
















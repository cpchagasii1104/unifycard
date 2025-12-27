-- ================================================
-- UNIFICARD - MIGRATION 032
-- Schedule Universal Module
-- Sistema universal de agenda para profissionais, empresas e serviços
-- ================================================

-- ===========================
-- SCHEDULES (Agendas)
-- ===========================
CREATE TABLE IF NOT EXISTS schedules (
  schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  company_id UUID,
  service_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedules_owner_check CHECK (
    (global_user_id IS NOT NULL)::int + 
    (company_id IS NOT NULL)::int + 
    (service_id IS NOT NULL)::int = 1
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_schedules_tenant ON schedules (tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules (global_user_id) WHERE global_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_company ON schedules (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_service ON schedules (service_id) WHERE service_id IS NOT NULL;

-- RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedules_rls ON schedules
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- SCHEDULE SLOTS (Horários)
-- ===========================
CREATE TABLE IF NOT EXISTS schedule_slots (
  slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES schedules(schedule_id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','blocked')),
  reserved_by_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL,
  reserved_via_action_id UUID, -- FK para social_actions.action_id (opcional)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedule_slots_time_check CHECK (end_time > start_time)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_schedule_slots_schedule ON schedule_slots (schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_start_time ON schedule_slots (start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_end_time ON schedule_slots (end_time);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_status ON schedule_slots (status);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_reserved_by ON schedule_slots (reserved_by_global_user_id) WHERE reserved_by_global_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_slots_time_range ON schedule_slots USING GIST (tstzrange(start_time, end_time));

-- RLS (herda do schedule)
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_slots_rls ON schedule_slots
  USING (
    EXISTS (
      SELECT 1 FROM schedules
      WHERE schedules.schedule_id = schedule_slots.schedule_id
      AND schedules.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_schedules_updated_at();

CREATE TRIGGER trigger_update_schedule_slots_updated_at
  BEFORE UPDATE ON schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_schedules_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE schedules IS 'Agendas universais para profissionais, empresas e serviços';
COMMENT ON COLUMN schedules.global_user_id IS 'Prestador/profissional dono da agenda';
COMMENT ON COLUMN schedules.company_id IS 'Empresa dona da agenda';
COMMENT ON COLUMN schedules.service_id IS 'Serviço específico com agenda própria';
COMMENT ON TABLE schedule_slots IS 'Horários disponíveis ou reservados em agendas';
COMMENT ON COLUMN schedule_slots.status IS 'Status do slot: available, reserved, blocked';
COMMENT ON COLUMN schedule_slots.reserved_via_action_id IS 'ID da ação social que gerou esta reserva (opcional)';









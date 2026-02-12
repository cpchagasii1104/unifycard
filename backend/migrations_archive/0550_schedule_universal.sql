-- 🔴 LEGADO — Estrutura temporal paralela.
-- 🔴 PROIBIDO USO EM NOVO CÓDIGO.
-- 🔴 Migrar para Unified Availability (migration 144).
/*
Arquivo: 032_schedule_universal.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Módulo: Schedule Universal

Função do arquivo:
- Fornecer um sistema universal de agenda
- Suportar agendas de profissionais, empresas ou serviços
- Permitir reservas manuais ou automáticas (via Social Actions)

Escopo:
- Definição de agendas (owner único por agenda)
- Definição de slots de horário
- Controle de status e reservas
- Integridade temporal (sem sobreposição)

Integrações / Dependências diretas:
- tenants
- global_users
- social_actions (030)
- update_updated_at_column()

Integrações indiretas:
- Social Core (029)
- Social Actions (030)
- Serviços, Marketplace, Eventos

Decisões de arquitetura:
- Uma agenda pertence a exatamente um owner (user, company ou service)
- Slots não podem se sobrepor dentro da mesma agenda
- Reservas automáticas podem ser originadas por ações sociais
- Sistema multi-tenant com RLS completa

Observações:
- Pronto para execução em lote
- Seguro contra race conditions de agenda
*/

-- =========================================================
-- SCHEDULES
-- =========================================================
CREATE TABLE IF NOT EXISTS schedules (
  schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  company_id UUID,
  service_id UUID,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT schedules_owner_check CHECK (
    (global_user_id IS NOT NULL)::int +
    (company_id IS NOT NULL)::int +
    (service_id IS NOT NULL)::int = 1
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_schedules_tenant
  ON schedules (tenant_id);

CREATE INDEX IF NOT EXISTS idx_schedules_user
  ON schedules (global_user_id)
  WHERE global_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_company
  ON schedules (company_id)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_service
  ON schedules (service_id)
  WHERE service_id IS NOT NULL;

-- RLS
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'schedules'
      AND policyname = 'schedules_rls'
  ) THEN
    CREATE POLICY schedules_rls
      ON schedules
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_schedules_updated_at ON schedules;
CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- SCHEDULE SLOTS
-- =========================================================
CREATE TABLE IF NOT EXISTS schedule_slots (
  slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  schedule_id UUID NOT NULL REFERENCES schedules(schedule_id) ON DELETE CASCADE,

  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,

  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','reserved','blocked')),

  reserved_by_global_user_id UUID
    REFERENCES global_users(global_user_id)
    ON DELETE SET NULL,

  reserved_via_action_id UUID
    REFERENCES social_actions(action_id)
    ON DELETE SET NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT schedule_slots_time_check CHECK (end_time > start_time)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_schedule_slots_schedule
  ON schedule_slots (schedule_id);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_status
  ON schedule_slots (status);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_start_time
  ON schedule_slots (start_time);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_end_time
  ON schedule_slots (end_time);

CREATE INDEX IF NOT EXISTS idx_schedule_slots_reserved_by
  ON schedule_slots (reserved_by_global_user_id)
  WHERE reserved_by_global_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_slots_time_range
  ON schedule_slots
  USING GIST (tstzrange(start_time, end_time));

-- Evita sobreposição de slots na mesma agenda
-- Usa constraint EXCLUDE: precisa usar gist para ambos os campos
-- Solução: criar índice gist composto e usar na constraint
DO $$
BEGIN
  -- Criar extensão btree_gist se não existir (permite usar btree operators em gist)
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'schedule_slots_no_overlap'
  ) THEN
    -- Constraint EXCLUDE usando btree_gist para UUID e gist para range
    ALTER TABLE schedule_slots
    ADD CONSTRAINT schedule_slots_no_overlap
    EXCLUDE USING GIST (
      schedule_id WITH =,
      tstzrange(start_time, end_time) WITH &&
    );
  END IF;
END $$;

-- RLS (herda do schedule)
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'schedule_slots'
      AND policyname = 'schedule_slots_rls'
  ) THEN
    CREATE POLICY schedule_slots_rls
      ON schedule_slots
      USING (
        EXISTS (
          SELECT 1
          FROM schedules s
          WHERE s.schedule_id = schedule_slots.schedule_id
            AND s.tenant_id::text = current_setting('app.current_tenant', true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM schedules s
          WHERE s.schedule_id = schedule_slots.schedule_id
            AND s.tenant_id::text = current_setting('app.current_tenant', true)
        )
      );
  END IF;
END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_schedule_slots_updated_at ON schedule_slots;
CREATE TRIGGER trg_schedule_slots_updated_at
  BEFORE UPDATE ON schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- COMENTÁRIOS
-- =========================================================
COMMENT ON TABLE schedules IS
  'Agendas universais para profissionais, empresas ou serviços';

COMMENT ON TABLE schedule_slots IS
  'Slots de horário de agendas, com controle de reserva e bloqueio';

COMMENT ON COLUMN schedule_slots.reserved_via_action_id IS
  'Ação social que originou a reserva automática (opcional)';

-- =========================================================
-- FIM DO ARQUIVO 032_schedule_universal.sql
-- =========================================================









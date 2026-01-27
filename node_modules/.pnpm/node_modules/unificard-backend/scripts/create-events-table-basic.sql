-- Script temporário para criar tabela events básica
-- Necessário porque migration 026 foi apenas marcada no baseline, mas não executada

-- Verificar se tabela já existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') THEN
    -- Criar tabela events básica conforme migration 026
    CREATE TABLE events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      city_id UUID REFERENCES cities(city_id) ON DELETE SET NULL,
      state_id UUID REFERENCES states(state_id) ON DELETE SET NULL,
      country_id UUID REFERENCES countries(country_id) ON DELETE SET NULL,
      created_by_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT events_time_check CHECK (end_time > start_time)
    );

    -- Índices básicos
    CREATE INDEX IF NOT EXISTS idx_events_tenant ON events (tenant_id);
    CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by_global_user_id);
    CREATE INDEX IF NOT EXISTS idx_events_city ON events (city_id) WHERE city_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_events_start_time ON events (start_time);
    CREATE INDEX IF NOT EXISTS idx_events_end_time ON events (end_time);

    -- RLS
    ALTER TABLE events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY events_rls ON events
      USING (tenant_id::text = current_setting('app.current_tenant', true));
    
    RAISE NOTICE 'Tabela events criada com sucesso';
  ELSE
    RAISE NOTICE 'Tabela events já existe';
  END IF;
END $$;















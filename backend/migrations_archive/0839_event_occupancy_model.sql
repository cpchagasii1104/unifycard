-- ============================================================
-- UNIFICARD - MIGRATION 086
-- FASE 17: Event Occupancy Model
-- ============================================================
--
-- OBJETIVO:
-- Definir modelos declarativos de ocupação para eventos culturais
-- (mesa, pessoa, slot, híbrido) e registrar reservas associadas.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena configuração e estado das reservas
--   • garante isolamento por tenant
-- - A APLICAÇÃO:
--   • interpreta config
--   • controla transições de status
--   • executa cobranças via Ledger / SplitEngine
-- - Nenhuma lógica econômica ou de workflow ocorre no banco
--
-- DECISÕES IMPORTANTES:
-- - occupancy_type, resource_type e status são campos livres
--   (sem CHECK rígido para permitir expansão futura)
-- - config é JSONB flexível (schema versionado na aplicação)
-- - transaction_id é apenas referência, não execução financeira
-- - Triggers automáticas foram removidas por segurança
--
-- DEPENDÊNCIAS:
-- - tenants
-- - cultural_events
-- - global_users
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- MODELOS DE OCUPAÇÃO DO EVENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS event_occupancy_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id UUID NOT NULL
    REFERENCES cultural_events(id) ON DELETE CASCADE,

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  occupancy_type VARCHAR(20) NOT NULL,

  total_capacity INT CHECK (total_capacity > 0),
  requires_reservation BOOLEAN NOT NULL DEFAULT false,

  reservation_price_cents INT CHECK (reservation_price_cents >= 0),
  reservation_currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  no_show_penalty_cents INT CHECK (no_show_penalty_cents >= 0),
  no_show_penalty_currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  auto_cancel_after_minutes INT CHECK (auto_cancel_after_minutes > 0),

  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_occupancy_models_unique
    UNIQUE (event_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_occupancy_models_event
  ON event_occupancy_models (event_id);

CREATE INDEX IF NOT EXISTS idx_event_occupancy_models_tenant
  ON event_occupancy_models (tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_occupancy_models_type
  ON event_occupancy_models (occupancy_type);


-- ============================================================
-- RESERVAS DE EVENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS event_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id UUID NOT NULL
    REFERENCES cultural_events(id) ON DELETE CASCADE,

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  occupancy_model_id UUID NOT NULL
    REFERENCES event_occupancy_models(id) ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  resource_type VARCHAR(20) NOT NULL,
  resource_id TEXT,
  resource_name TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

  reservation_price_cents INT CHECK (reservation_price_cents >= 0),
  reservation_currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  transaction_id UUID,

  check_in_time TIMESTAMPTZ,
  no_show_time TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_reservations_event
  ON event_reservations (event_id);

CREATE INDEX IF NOT EXISTS idx_event_reservations_user
  ON event_reservations (global_user_id);

CREATE INDEX IF NOT EXISTS idx_event_reservations_status
  ON event_reservations (status);

CREATE INDEX IF NOT EXISTS idx_event_reservations_model
  ON event_reservations (occupancy_model_id);

CREATE INDEX IF NOT EXISTS idx_event_reservations_resource
  ON event_reservations (resource_type, resource_id)
  WHERE resource_id IS NOT NULL;


-- ============================================================
-- RLS (DEPENDENTE DE CONFIGURAÇÃO GLOBAL)
-- ============================================================
ALTER TABLE event_occupancy_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_occupancy_models_rls
  ON event_occupancy_models
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE event_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_reservations_rls
  ON event_reservations
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE event_occupancy_models IS
  'Modelos declarativos de ocupação para eventos culturais (mesa, pessoa, slot, híbrido).';

COMMENT ON TABLE event_reservations IS
  'Reservas declarativas de recursos em eventos culturais.';

COMMENT ON COLUMN event_occupancy_models.config IS
  'Configuração específica por tipo de ocupação. Interpretada pela aplicação.';

COMMENT ON COLUMN event_reservations.resource_id IS
  'Identificador do recurso reservado (mesa, setor, slot).';

COMMENT ON COLUMN event_reservations.resource_name IS
  'Nome legível do recurso reservado para exibição.';














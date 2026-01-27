-- ============================================================
-- UNIFICARD - MIGRATION 293
-- FASE 6.0: Event Split Declarative (Split Declarativo)
-- FASE_6_CONTRATO_SPLIT_PAGAMENTO.md
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela event_split_declarative para split declarativo de eventos.
--
-- PRINCÍPIO CENTRAL:
-- Split NÃO é pagamento.
-- Split é cálculo declarativo de distribuição futura.
--
-- REGRAS ABSOLUTAS:
-- - Nenhum valor é transferido no split
-- - Nenhum dinheiro se move aqui
-- - Split só pode ser calculado após custódia existir
-- - Split é MAPA, não movimento
--
-- EVENTO CANÔNICO DE CÁLCULO:
-- - event.split.calculated
--
-- REVERSIBILIDADE:
-- - Split pode ser invalidado antes da execução
-- - Split pode ser recalculado
-- - Histórico nunca é apagado
-- ============================================================

-- ============================================================
-- ENUM: split_declarative_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'split_declarative_status') THEN
    CREATE TYPE split_declarative_status AS ENUM (
      'calculated',   -- Split calculado (declarativo)
      'invalidated',  -- Split invalidado (antes da execução)
      'executed'      -- Split executado (após pagamento)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: event_split_declarative
-- ============================================================

CREATE TABLE IF NOT EXISTS event_split_declarative (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,
  
  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,
  
  custody_id UUID NOT NULL
    REFERENCES event_custody(id)
    ON DELETE CASCADE,
  
  -- Valor total do split (deve corresponder ao valor da custódia)
  total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  
  -- Definição do split (JSONB declarativo)
  -- Estrutura: Array de partes com target_id, target_type, amount_cents, percentage, role
  parts JSONB NOT NULL DEFAULT '[]',
  
  -- Versão das regras usadas (opcional)
  rules_version VARCHAR(20),
  
  -- Status do split
  status split_declarative_status NOT NULL DEFAULT 'calculated',
  
  -- Timestamps
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invalidated_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  
  -- Metadata (opcional, para auditoria)
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT event_split_declarative_amount_check CHECK (total_amount_cents > 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_split_declarative_tenant_event
  ON event_split_declarative (tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_split_declarative_tenant_custody
  ON event_split_declarative (tenant_id, custody_id);

CREATE INDEX IF NOT EXISTS idx_event_split_declarative_tenant_status
  ON event_split_declarative (tenant_id, status)
  WHERE status = 'calculated';

CREATE INDEX IF NOT EXISTS idx_event_split_declarative_calculated_at
  ON event_split_declarative (tenant_id, calculated_at DESC);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE event_split_declarative ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'event_split_declarative'
      AND policyname = 'event_split_declarative_tenant_isolation'
  ) THEN
    CREATE POLICY event_split_declarative_tenant_isolation
      ON event_split_declarative
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================

DROP TRIGGER IF EXISTS trigger_update_event_split_declarative_updated_at ON event_split_declarative;
CREATE TRIGGER trigger_update_event_split_declarative_updated_at
  BEFORE UPDATE ON event_split_declarative
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE event_split_declarative IS
  'Split declarativo de eventos (FASE 6.0). Split NÃO é pagamento. É cálculo declarativo de distribuição futura.';

COMMENT ON COLUMN event_split_declarative.custody_id IS
  'ID da custódia relacionada. Split só pode ser calculado após custódia existir.';

COMMENT ON COLUMN event_split_declarative.total_amount_cents IS
  'Valor total do split em centavos. Deve corresponder ao valor da custódia.';

COMMENT ON COLUMN event_split_declarative.parts IS
  'Definição do split (JSONB). Array de partes com target_id, target_type, amount_cents, percentage, role.';

COMMENT ON COLUMN event_split_declarative.rules_version IS
  'Versão das regras de split usadas (opcional). Permite rastreabilidade de políticas.';

COMMENT ON COLUMN event_split_declarative.status IS
  'Status do split: calculated (calculado), invalidated (invalidado), executed (executado).';

COMMENT ON COLUMN event_split_declarative.invalidated_at IS
  'Timestamp de quando o split foi invalidado (antes da execução).';

COMMENT ON COLUMN event_split_declarative.executed_at IS
  'Timestamp de quando o split foi executado (após pagamento).';

-- ============================================================
-- NOTA DE COMPATIBILIDADE
-- ============================================================
-- Esta migration cria estrutura canônica para split declarativo.
-- Nenhuma lógica automática é executada.
-- Estado ≠ verdade.
-- Split é MAPA, não movimento.
-- ============================================================


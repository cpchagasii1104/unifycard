-- ============================================================
-- UNIFICARD — MIGRATION 265
-- Arquivo: 265_create_trust_profiles.sql
-- Tipo: NOVA FUNCIONALIDADE (Trust & Integrity Engine)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration cria as tabelas de Trust Profiles, Trust Events
-- e Trust Score Snapshots para detecção de bypass/fraude e
-- cálculo de reputação baseada em evidências.
--
-- REGRAS:
-- - Score calculado automaticamente (0-100)
-- - RiskLevel derivado do score
-- - Nunca editável manualmente
-- - Append-only em eventos
--
-- IDEMPOTÊNCIA
-- Todas as alterações usam IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1) ENUM: risk_level
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_level') THEN
    CREATE TYPE risk_level AS ENUM (
      'LOW',
      'MEDIUM',
      'HIGH',
      'BLOCKED'
    );
  END IF;
END$$;

-- ============================================================
-- 2) ENUM: trust_event_severity
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trust_event_severity') THEN
    CREATE TYPE trust_event_severity AS ENUM (
      'LOW',
      'MEDIUM',
      'HIGH'
    );
  END IF;
END$$;

-- ============================================================
-- 3) ENUM: trust_event_type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trust_event_type') THEN
    CREATE TYPE trust_event_type AS ENUM (
      'agreement_bypass_attempted',
      'escrow_bypass_attempted',
      'dispute_opened',
      'dispute_lost',
      'dispute_won',
      'agreement_respected',
      'escrow_completed_successfully',
      'repeated_cancellation',
      'off_platform_signal_detected',
      'payment_on_time',
      'service_completed_successfully',
      'positive_review',
      'negative_review'
    );
  END IF;
END$$;

-- ============================================================
-- 4) TABELA: trust_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS trust_profiles (
  profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id VARCHAR(255) NOT NULL,
  current_score INTEGER NOT NULL DEFAULT 70, -- Score inicial neutro
  risk_level risk_level NOT NULL DEFAULT 'MEDIUM',
  total_events INTEGER NOT NULL DEFAULT 0,
  positive_events INTEGER NOT NULL DEFAULT 0,
  negative_events INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMP WITH TIME ZONE,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT trust_profiles_score_range CHECK (current_score >= 0 AND current_score <= 100),
  CONSTRAINT trust_profiles_actor_unique UNIQUE (tenant_id, actor_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_trust_profiles_tenant_actor ON trust_profiles(tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_trust_profiles_tenant_risk ON trust_profiles(tenant_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_trust_profiles_tenant_score ON trust_profiles(tenant_id, current_score);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_trust_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trust_profiles_updated_at
  BEFORE UPDATE ON trust_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_trust_profiles_updated_at();

-- ============================================================
-- 5) TABELA: trust_events
-- ============================================================

CREATE TABLE IF NOT EXISTS trust_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id VARCHAR(255) NOT NULL,
  event_type trust_event_type NOT NULL,
  severity trust_event_severity NOT NULL,
  score_impact INTEGER NOT NULL, -- Impacto no score (+ ou -)
  context_type VARCHAR(50) NOT NULL,
  context_id VARCHAR(255) NOT NULL,
  evidence_pack_id UUID NOT NULL REFERENCES evidence_packs(pack_id) ON DELETE RESTRICT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT trust_events_evidence_required CHECK (evidence_pack_id IS NOT NULL)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_trust_events_tenant_actor ON trust_events(tenant_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_events_tenant_type ON trust_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_trust_events_tenant_context ON trust_events(tenant_id, context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_trust_events_tenant_evidence ON trust_events(tenant_id, evidence_pack_id);

-- ============================================================
-- 6) TABELA: trust_score_snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS trust_score_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL,
  risk_level risk_level NOT NULL,
  triggered_by_event_id UUID NULL REFERENCES trust_events(event_id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT trust_score_snapshots_score_range CHECK (score >= 0 AND score <= 100)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_trust_score_snapshots_tenant_actor ON trust_score_snapshots(tenant_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_score_snapshots_tenant_risk ON trust_score_snapshots(tenant_id, risk_level);

-- Comentários
COMMENT ON TABLE trust_profiles IS 'Perfis de confiança por actor (score calculado automaticamente)';
COMMENT ON TABLE trust_events IS 'Eventos de trust (append-only, imutável)';
COMMENT ON TABLE trust_score_snapshots IS 'Histórico de scores (append-only, para análise)';
COMMENT ON COLUMN trust_profiles.current_score IS 'Score atual (0-100), calculado automaticamente';
COMMENT ON COLUMN trust_profiles.risk_level IS 'Nível de risco derivado do score';
COMMENT ON COLUMN trust_events.evidence_pack_id IS 'Obrigatório: sempre deve ter evidência';
COMMENT ON COLUMN trust_events.score_impact IS 'Impacto no score (+ ou -)';





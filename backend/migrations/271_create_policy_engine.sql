-- Migration: Policy & Enforcement Engine
-- Cria tabelas para Policy Rules e Policy Decisions

-- Tabela de Policy Rules
CREATE TABLE IF NOT EXISTS policy_rules (
  policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('feature_throttling', 'temporary_block', 'manual_review_required')),
  version INTEGER NOT NULL DEFAULT 1,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL, -- Array de PolicyAction
  is_active BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMP WITH TIME ZONE,
  activated_by_user_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT policy_rules_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Índices para policy_rules
CREATE INDEX IF NOT EXISTS idx_policy_rules_tenant ON policy_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_type ON policy_rules(policy_type);
CREATE INDEX IF NOT EXISTS idx_policy_rules_active ON policy_rules(tenant_id, is_active);

-- Tabela de Policy Decisions
CREATE TABLE IF NOT EXISTS policy_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  policy_version INTEGER NOT NULL,
  actor_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED')),
  applied_actions JSONB NOT NULL, -- Array de PolicyAction
  reason TEXT NOT NULL,
  applied_by_user_id UUID NOT NULL,
  applied_by_actor_id UUID NOT NULL,
  evidence_pack_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by_user_id UUID,
  revoked_by_actor_id UUID,
  revocation_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT policy_decisions_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT policy_decisions_policy_fk FOREIGN KEY (policy_id) REFERENCES policy_rules(policy_id) ON DELETE RESTRICT,
  CONSTRAINT policy_decisions_evidence_fk FOREIGN KEY (evidence_pack_id) REFERENCES evidence_packs(pack_id) ON DELETE SET NULL
);

-- Índices para policy_decisions
CREATE INDEX IF NOT EXISTS idx_policy_decisions_tenant ON policy_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_policy ON policy_decisions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_actor ON policy_decisions(tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_status ON policy_decisions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_active ON policy_decisions(tenant_id, actor_id, status) WHERE status = 'ACTIVE';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_policy_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_policy_rules_updated_at
  BEFORE UPDATE ON policy_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_policy_rules_updated_at();

CREATE TRIGGER trigger_policy_decisions_updated_at
  BEFORE UPDATE ON policy_decisions
  FOR EACH ROW
  EXECUTE FUNCTION update_policy_rules_updated_at();





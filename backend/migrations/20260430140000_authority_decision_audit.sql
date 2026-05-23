-- Auditoria de decisões de autoridade / precedência (ATL → KYC → GUARDA → resto).
-- Não cria nova fonte de verdade operacional; apenas trilho de explicabilidade.

BEGIN;

CREATE TABLE IF NOT EXISTS authority_decision_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  decision TEXT NOT NULL,
  decision_source TEXT NOT NULL,
  confidence NUMERIC(5, 4) NULL,
  decision_reason TEXT NOT NULL,
  layer_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT authority_decision_audit_decision_chk
    CHECK (decision IN ('allow', 'block', 'limit')),
  CONSTRAINT authority_decision_audit_source_chk
    CHECK (decision_source IN ('system', 'manual', 'rule', 'AI')),
  CONSTRAINT authority_decision_audit_confidence_chk
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX IF NOT EXISTS idx_authority_decision_audit_tenant_created
  ON authority_decision_audit (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authority_decision_audit_actor_created
  ON authority_decision_audit (actor_id, created_at DESC);

COMMENT ON TABLE authority_decision_audit IS
  'Decisões determinísticas de precedência (financeiro sensível): ATL → KYC → GUARDA; explicabilidade pós-facto.';

COMMIT;

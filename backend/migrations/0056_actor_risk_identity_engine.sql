-- Prompt 53 — Risk & Identity Engine (memória comportamental por actor; não move dinheiro).

BEGIN;

CREATE TABLE actor_risk_profile (
  actor_id UUID PRIMARY KEY REFERENCES actors(id) ON DELETE CASCADE,
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 200),
  risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low', 'medium', 'high', 'blocked')),
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_actor_risk_profile_level ON actor_risk_profile(risk_level);

COMMENT ON TABLE actor_risk_profile IS
  'Prompt 53: perfil de risco por actor (identidade persistente). Não altera ledger nem transações.';

CREATE TABLE actor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_actor_events_actor_created ON actor_events(actor_id, created_at DESC);
CREATE INDEX idx_actor_events_tenant_actor ON actor_events(tenant_id, actor_id);
CREATE INDEX idx_actor_events_type ON actor_events(event_type);

COMMENT ON TABLE actor_events IS
  'Prompt 53: histórico comportamental imutável por actor (append-only lógico).';

-- Backfill actor_id onde owner_id começa com UUID (wallet user / company prefix)
UPDATE bank_accounts ba
SET actor_id = split_part(ba.owner_id, ':', 1)::uuid
WHERE ba.owner_type = 'actor'
  AND ba.actor_id IS NULL
  AND split_part(ba.owner_id, ':', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Novas linhas: actor obrigatório para owner actor (linhas legadas sem actor_id permanecem até backfill manual)
ALTER TABLE bank_accounts
  ADD CONSTRAINT bank_accounts_actor_required_for_actor_owner
  CHECK (owner_type != 'actor' OR actor_id IS NOT NULL) NOT VALID;

COMMENT ON CONSTRAINT bank_accounts_actor_required_for_actor_owner ON bank_accounts IS
  'Prompt 53: contas de titularidade actor exigem actor_id (identidade persistente).';

COMMIT;

-- 20260614150000_financial_approval_policy_materialization.sql
-- F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION — materializa DECISION-0130 no Core Financeiro.
--
-- Substrato de POLÍTICA e AUTORIDADE de aprovação de payout (escopo actor_wallet_payout) + trilha
-- append-only de eventos de decisão. NÃO move dinheiro, NÃO toca bank_*/payout/ledger. Sem backfill.
-- SEM autoridade automática para owner/admin (D1/D11): toda authority é cadastrada explicitamente.
--
-- DECISION-0130: D2 substrato no Core; D4 faixa MVP (max 50000 / diário 150000) — travada no banco;
-- D9 auditoria append-only (decisão terminal não apagável). Dinheiro SEMPRE BIGINT amount_cents;
-- tempo SEMPRE TIMESTAMPTZ; sem NUMERIC para dinheiro.

BEGIN;

-- ── POLÍTICA (por tenant + escopo) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_approval_policies (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scope                     TEXT NOT NULL CHECK (scope IN ('actor_wallet_payout')),
  max_amount_cents          BIGINT NOT NULL CHECK (max_amount_cents > 0),
  daily_limit_cents         BIGINT NOT NULL CHECK (daily_limit_cents > 0),
  requires_second_approval  BOOLEAN NOT NULL DEFAULT false,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  reason                    TEXT,
  created_by_user_id        UUID REFERENCES users(id),
  revoked_by_user_id        UUID REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at                TIMESTAMPTZ,
  -- D4: a faixa MVP nunca passa do teto institucional (ratifica DECISION-0130 D4).
  CONSTRAINT chk_fap_policy_mvp_ceiling
    CHECK (max_amount_cents <= 50000 AND daily_limit_cents <= 150000)
);
CREATE INDEX IF NOT EXISTS idx_fap_policies_tenant_scope_active
  ON financial_approval_policies (tenant_id, scope, is_active);
-- no máximo UMA policy ativa por (tenant, scope).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_fap_policy_one_active_per_tenant_scope
  ON financial_approval_policies (tenant_id, scope)
  WHERE is_active AND revoked_at IS NULL;

-- ── AUTORIDADE (operador financeiro institucional) ─────────────────────────────
-- Aprovador material = users.id (tenant-scoped via users.tenant_id; casa requested_by_user_id).
-- NÃO é company_users/tenant_operator_grants/organization_members/role (D1/D11).
CREATE TABLE IF NOT EXISTS financial_approval_authorities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id            UUID NOT NULL REFERENCES financial_approval_policies(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope                TEXT NOT NULL CHECK (scope IN ('actor_wallet_payout')),
  max_amount_cents     BIGINT NOT NULL CHECK (max_amount_cents > 0),
  daily_limit_cents    BIGINT NOT NULL CHECK (daily_limit_cents > 0),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  reason               TEXT,
  created_by_user_id   UUID REFERENCES users(id),
  revoked_by_user_id   UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at           TIMESTAMPTZ,
  CONSTRAINT chk_fap_authority_mvp_ceiling
    CHECK (max_amount_cents <= 50000 AND daily_limit_cents <= 150000)
);
CREATE INDEX IF NOT EXISTS idx_fap_authorities_tenant_user_scope_active
  ON financial_approval_authorities (tenant_id, user_id, scope, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_fap_authority_one_active_per_user_scope
  ON financial_approval_authorities (tenant_id, user_id, scope)
  WHERE is_active AND revoked_at IS NULL;

-- ── EVENTOS DE DECISÃO (append-only; ledger de uso diário + auditoria D9) ───────
CREATE TABLE IF NOT EXISTS financial_approval_policy_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id                UUID REFERENCES financial_approval_policies(id),
  authority_id             UUID REFERENCES financial_approval_authorities(id),
  approval_request_id      UUID,
  payout_request_id        UUID,
  actor_id                 UUID,
  decision                 TEXT NOT NULL CHECK (decision IN ('approved','rejected','blocked')),
  approved_by_user_id      UUID REFERENCES users(id),
  requested_by_user_id     UUID REFERENCES users(id),
  amount_cents             BIGINT NOT NULL CHECK (amount_cents > 0),
  reason                   TEXT,
  risk_snapshot            JSONB,
  kyc_status_snapshot      JSONB,
  recovery_snapshot        JSONB,
  idempotency_key          TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- uso diário por actor (apenas decision='approved' conta).
CREATE INDEX IF NOT EXISTS idx_fap_events_tenant_actor_created
  ON financial_approval_policy_events (tenant_id, actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fap_events_payout
  ON financial_approval_policy_events (payout_request_id);
-- idempotência: um evento por (tenant, chave) — evita duplo cômputo diário.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_fap_events_idempotency
  ON financial_approval_policy_events (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- D9: evento terminal é append-only — UPDATE/DELETE proibidos.
CREATE OR REPLACE FUNCTION trg_fap_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial_approval_policy_events is append-only (DECISION-0130 D9): % proibido', TG_OP;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_fap_events_no_mutate ON financial_approval_policy_events;
CREATE TRIGGER trg_fap_events_no_mutate
  BEFORE UPDATE OR DELETE ON financial_approval_policy_events
  FOR EACH ROW EXECUTE FUNCTION trg_fap_events_append_only();

COMMIT;

-- 20260617120000_actor_referral_codes_and_actor_links.sql
-- F-ACTOR-REFERRAL-CODE-SUBSTRATE — DECISION-0139 (Actor-Scoped Referral Code & Earnings).
--
-- Materializa o código de indicação POR ACTOR: o código e os earnings pertencem
-- ECONOMICAMENTE ao actor dono (owner_actor_id), não ao CPF/user por reflexo.
-- referral_code = LOOKUP econômico que resolve owner_actor_id; NÃO é ledger, NÃO é authority.
--
-- Forward-only, aditiva, idempotente. NÃO promove archive 0073 cru. Zero Bank
-- (não toca bank_ledger/bank_transactions/bank_splits/bank_accounts). FK SEMPRE
-- para actors(id) (PK), NUNCA actors(actor_id), NUNCA users(id). gen_random_uuid() nativo.
--
-- 07_NOMENCLATURA: snake_case; code_status (não 'status' genérico); created_at/revoked_at;
-- sem valor/percentual/saldo nesta tabela (lookup, não ledger).

BEGIN;

-- ── 1) actor_referral_codes — substrato canônico (owner econômico = actor) ──────────────────
CREATE TABLE IF NOT EXISTS actor_referral_codes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  owner_actor_id       uuid NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  code                 text NOT NULL,
  code_status          text NOT NULL DEFAULT 'active',
  created_by_actor_id  uuid NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  created_by_user_id   uuid NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  revoked_at           timestamptz NULL,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_actor_referral_codes_code_status CHECK (code_status IN ('active', 'inactive', 'revoked'))
);

-- código único por tenant (lookup determinístico).
CREATE UNIQUE INDEX IF NOT EXISTS uq_actor_referral_codes_tenant_code
  ON actor_referral_codes (tenant_id, code);

-- lookup por dono.
CREATE INDEX IF NOT EXISTS idx_actor_referral_codes_tenant_owner
  ON actor_referral_codes (tenant_id, owner_actor_id);

-- 1 código ATIVO por actor (partial unique index — PG não suporta UNIQUE ... WHERE em constraint).
CREATE UNIQUE INDEX IF NOT EXISTS idx_actor_referral_codes_one_active_per_owner
  ON actor_referral_codes (tenant_id, owner_actor_id)
  WHERE code_status = 'active' AND revoked_at IS NULL;

-- RLS tenant-safe (mesmo padrão vivo de user_referral_links: app.current_tenant).
ALTER TABLE actor_referral_codes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'actor_referral_codes'
      AND policyname = 'actor_referral_codes_tenant_isolation'
  ) THEN
    CREATE POLICY actor_referral_codes_tenant_isolation
      ON actor_referral_codes
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
  END IF;
END $$;

-- ── 2) user_referral_links — evoluir para actor↔actor (breadcrumb user_* preservado) ────────
--    referrer_actor_id = owner econômico do código usado; referred_actor_id = actor_human do indicado.
--    Mantém referrer_user_id/referred_user_id/referral_code_used como breadcrumb civil/compat.
ALTER TABLE user_referral_links
  ADD COLUMN IF NOT EXISTS referrer_actor_id uuid NULL REFERENCES actors(id) ON DELETE SET NULL;
ALTER TABLE user_referral_links
  ADD COLUMN IF NOT EXISTS referred_actor_id uuid NULL REFERENCES actors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_referral_links_referrer_actor
  ON user_referral_links (tenant_id, referrer_actor_id);

COMMIT;

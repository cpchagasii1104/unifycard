-- Prompt 53.1 — Backfill actor_id + VALIDATE + limites por nível de risco

BEGIN;

-- --- Backfill actor_id (apenas UUIDs que existem em actors do mesmo tenant)
UPDATE bank_accounts ba
SET actor_id = ba.owner_id::uuid
WHERE ba.owner_type = 'actor'
  AND ba.actor_id IS NULL
  AND ba.owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM actors a
    WHERE a.id = ba.owner_id::uuid AND a.tenant_id = ba.tenant_id
  );

UPDATE bank_accounts ba
SET actor_id = split_part(ba.owner_id, ':', 1)::uuid
WHERE ba.owner_type = 'actor'
  AND ba.actor_id IS NULL
  AND split_part(ba.owner_id, ':', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM actors a
    WHERE a.id = split_part(ba.owner_id, ':', 1)::uuid AND a.tenant_id = ba.tenant_id
  );

DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*)::INT INTO n
  FROM bank_accounts
  WHERE owner_type = 'actor' AND actor_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION
      '0057_risk_enforcement_hardening: % bank_accounts (owner actor) sem actor_id após backfill. Corrigir antes de reaplicar.',
      n;
  END IF;
END $$;

ALTER TABLE bank_accounts
  VALIDATE CONSTRAINT bank_accounts_actor_required_for_actor_owner;

CREATE TABLE risk_financial_limits_by_level (
  risk_level TEXT PRIMARY KEY
    CHECK (risk_level IN ('low', 'medium', 'high', 'blocked')),
  max_transfer_cents_per_operation BIGINT NOT NULL CHECK (max_transfer_cents_per_operation >= 0),
  max_payment_cents_per_operation BIGINT NOT NULL CHECK (max_payment_cents_per_operation >= 0),
  max_payout_cents_per_operation BIGINT NOT NULL CHECK (max_payout_cents_per_operation >= 0)
);

INSERT INTO risk_financial_limits_by_level (risk_level, max_transfer_cents_per_operation, max_payment_cents_per_operation, max_payout_cents_per_operation)
VALUES
  ('low', 500000000, 500000000, 500000000),
  ('medium', 500000, 500000, 1000000),
  ('high', 2000000, 2000000, 5000000),
  ('blocked', 0, 0, 0)
ON CONFLICT (risk_level) DO NOTHING;

COMMENT ON TABLE risk_financial_limits_by_level IS
  'Prompt 53.1: teto por operação conforme risk_level (materializado no gate).';

ALTER TABLE actor_risk_profile
  ADD COLUMN IF NOT EXISTS risk_rules_version INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN actor_risk_profile.risk_rules_version IS 'Versão das regras de peso em risk-engine (incrementar ao mudar pesos).';

COMMIT;

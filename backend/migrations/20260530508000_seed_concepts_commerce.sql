-- ============================================================
-- C2 Rollout — Seed de concepts commerce (6 concepts)
-- ============================================================
-- Remete a: REMEDIATION_DECISIONS_LOG.md DECISION-C2-010
-- Seed forward-only. Idempotência por ON CONFLICT (domain, slug).
-- 6 concepts para os call sites de payment-execution.service.ts
-- ============================================================

BEGIN;

-- Libera trigger de governança para esta transação (trg_concept_governance / 0075)
SELECT set_config('app.concept_governance', 'true', true);

-- Domínios já existem (seed 20260530507000). Verificação redundante para segurança.
INSERT INTO domains (domain_key) VALUES
  ('financeiro-payment'),
  ('financeiro-escrow'),
  ('financeiro-payout'),
  ('financeiro-gateway')
ON CONFLICT (domain_key) DO NOTHING;

-- financeiro-payment (1 concept)
INSERT INTO concepts (slug, domain) VALUES
  ('marketplace-escrow-payment', 'financeiro-payment')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-escrow (1 concept)
INSERT INTO concepts (slug, domain) VALUES
  ('marketplace-settlement-escrow-to-clearing', 'financeiro-escrow')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-payout (3 concepts)
INSERT INTO concepts (slug, domain) VALUES
  ('marketplace-settlement-clearing-to-seller', 'financeiro-payout'),
  ('marketplace-funds-release',                 'financeiro-payout'),
  ('seller-payout-request',                     'financeiro-payout')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-gateway (1 concept)
INSERT INTO concepts (slug, domain) VALUES
  ('seller-payout-bank-settlement', 'financeiro-gateway')
ON CONFLICT (domain, slug) DO NOTHING;

COMMIT;

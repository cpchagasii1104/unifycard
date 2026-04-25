-- ============================================================
-- C2 Rollout Passo 2 — Seed de concepts financeiros (24 concepts)
-- ============================================================
-- Remete a: docs/02_decisions/RFC_C2_seed_concepts_financeiros.md (commit 12af0a3a)
-- Seed forward-only. Idempotência por ON CONFLICT (domain, slug).
-- Taxonomia aprovada em 3 camadas de auditoria (Opus, Sonnet, ChatGPT).
-- ============================================================

BEGIN;

-- Libera trigger de governança para esta transação (trg_concept_governance / 0075)
SELECT set_config('app.concept_governance', 'true', true);

-- Pré-requisito: inserir domínios N0 financeiros (FK concepts.domain → domains.domain_key)
INSERT INTO domains (domain_key) VALUES
  ('financeiro-payment'),
  ('financeiro-escrow'),
  ('financeiro-payout'),
  ('financeiro-treasury'),
  ('financeiro-reversal'),
  ('financeiro-fund'),
  ('financeiro-gateway')
ON CONFLICT (domain_key) DO NOTHING;

-- financeiro-payment (6 concepts)
INSERT INTO concepts (slug, domain) VALUES
  ('event-ticket-payment',       'financeiro-payment'),
  ('service-booking-payment',    'financeiro-payment'),
  ('service-execution-payment',  'financeiro-payment'),
  ('group-contribution-payment', 'financeiro-payment'),
  ('ride-payment',               'financeiro-payment'),
  ('b2b-payment',                'financeiro-payment')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-escrow (3 concepts)
INSERT INTO concepts (slug, domain) VALUES
  ('escrow-hold',                 'financeiro-escrow'),
  ('escrow-release-to-recipient', 'financeiro-escrow'),
  ('escrow-refund-to-payer',      'financeiro-escrow')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-payout (4 concepts)
INSERT INTO concepts (slug, domain) VALUES
  ('seller-funds-release',        'financeiro-payout'),
  ('seller-payout',               'financeiro-payout'),
  ('resource-compensation-payout','financeiro-payout'),
  ('system-reserve-credit',       'financeiro-payout')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-treasury (4 concepts)
INSERT INTO concepts (slug, domain) VALUES
  ('treasury-regional-fund-distribution',   'financeiro-treasury'),
  ('treasury-community-fund-distribution',  'financeiro-treasury'),
  ('treasury-system-reserve-distribution',  'financeiro-treasury'),
  ('treasury-governance-pool-distribution', 'financeiro-treasury')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-reversal (3 concepts)
INSERT INTO concepts (slug, domain) VALUES
  ('ledger-compensation',      'financeiro-reversal'),
  ('transaction-reversal-leg', 'financeiro-reversal'),
  ('transaction-reversal',     'financeiro-reversal')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-fund (2 concepts)
INSERT INTO concepts (slug, domain) VALUES
  ('regional-fund-topup',           'financeiro-fund'),
  ('regional-fund-incentive-grant', 'financeiro-fund')
ON CONFLICT (domain, slug) DO NOTHING;

-- financeiro-gateway (2 concepts)
INSERT INTO concepts (slug, domain) VALUES
  ('bank-external-settlement', 'financeiro-gateway'),
  ('pix-payment-received',     'financeiro-gateway')
ON CONFLICT (domain, slug) DO NOTHING;

COMMIT;

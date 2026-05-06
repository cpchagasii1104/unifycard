-- ============================================================
-- C66 Sessão 2 — Seed concept 'split-payment' (financeiro-payment)
-- ============================================================
-- Remete a: PLANO_MESTRE_REMEDIACAO_CORE_MODULES.md (Sessão 2 — C66)
-- Slug usado em src/core/economy/split.service.ts:351 mas faltante no
-- seed 20260530507000_seed_concepts_financeiros.sql
-- Forward-only. Idempotência por ON CONFLICT (domain, slug).
-- ============================================================

BEGIN;

-- Libera trigger de governança para esta transação (trg_concept_governance / 0075)
SELECT set_config('app.concept_governance', 'true', true);

-- Garante domínio (idempotente)
INSERT INTO domains (domain_key) VALUES
  ('financeiro-payment')
ON CONFLICT (domain_key) DO NOTHING;

-- Seed split-payment
INSERT INTO concepts (slug, domain) VALUES
  ('split-payment', 'financeiro-payment')
ON CONFLICT (domain, slug) DO NOTHING;

COMMIT;
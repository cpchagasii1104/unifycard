-- ============================================================
-- 20260616120000 — Seed dos 4 concepts canônicos de FINALIDADE TEMPORAL
-- ============================================================
-- DECISION-0132 (docs/02_decisions/DECISION_0132_TEMPORAL_PURPOSE_CONCEPT.md).
-- Finalidade temporal da agenda pessoal = CONCEPT. SEM novo domínio N0 (18_DOMAIN_ONTOLOGY §7
-- lista fechada CONGELADA; §8.2 precedente causas-sociais). Os 4 concepts moram em domínios N0
-- NATURAIS já existentes; o domínio do concept NÃO é limite de matching (ADENDO Clayton 2026-06-16).
-- Mapeamento canônico (domain, slug):
--   trabalho          → servicos
--   estudo            → educacao-e-conhecimento
--   cuidados-pessoais → saude-e-bem-estar
--   lazer             → cultura-lazer-e-eventos
-- Governado (trigger trg_concept_governance / 0075) + idempotente (ON CONFLICT domain,slug).
-- ============================================================

BEGIN;

-- Libera o trigger de governança SOMENTE nesta transação (0075).
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain) VALUES
  ('trabalho',          'servicos'),
  ('estudo',            'educacao-e-conhecimento'),
  ('cuidados-pessoais', 'saude-e-bem-estar'),
  ('lazer',             'cultura-lazer-e-eventos')
ON CONFLICT (domain, slug) DO NOTHING;

COMMIT;

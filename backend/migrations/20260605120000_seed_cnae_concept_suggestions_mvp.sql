-- ============================================================
-- γ — Seed MVP SELETIVO da matriz CNAE → suggested_concept_id (DECISION-0104)
-- ============================================================
-- Tabela curada por Clayton (2026-06-05): SÓ as 7 verticais vivas (açougue/farmácia/
-- hortifruti/padaria/restaurante/salão/supermercado). NÃO importa o CNAE inteiro.
--
-- CNAE é SINAL/EVIDÊNCIA, não autoridade (0104 D1/D2): SUGERE concept candidato; NÃO ativa
-- empresa, NÃO escreve companies.primary_company_type_id / primary_concept_id, NÃO publica
-- (company_concept_publications / tenant_concept_offerings), NÃO mapeia MarketplaceDomain,
-- NÃO toca Bank, NÃO abre Trilhos A/B. company_type NÃO mora aqui (derivado via
-- company_type_allowed_concepts).
--
-- RESOLUÇÃO POR SLUG: suggested_concept_id resolvido por concepts.slug (NÃO hardcode de UUID).
--   Guarda allowed-pair: só semeia concept que existe E está em company_type_allowed_concepts.
--   Fail-closed: se algum slug não resolver/não for allowed, a linha é descartada no JOIN e o
--   gate final (COUNT=8) ABORTA a migration (sem linha órfã, sem seed parcial silencioso).
--
-- CONFIANÇA — categórica, não numérica: o schema (0104) exige confidence IN ('low','medium',
--   'high'). A intenção de Clayton (principal>secundário; 0.95/0.85) mapeia para:
--   principal='high'; salão estética 9602-5/02 (secondary-beauty-scope)='medium'.
--
-- COSTURA CNAE (documentar): cnae_code aqui = NORMALIZADO (só dígitos, ex.: 4711302). A evidência
--   (fiscal_identity_economic_activities) grava o CNAE COMO O PROVIDER RETORNA (sem normalizar —
--   fiscal-identity-economic-activity.service:70). Logo o CONSUMIDOR FUTURO (read endpoint de
--   sugestão) DEVE normalizar o CNAE da evidência (strip não-dígitos) antes do lookup nesta matriz.
--   Rastreado em DT-PJ-CNAE-CODE-FORMAT-NORMALIZATION-SEAM.
--
-- Idempotente: ON CONFLICT (cnae_code, suggested_concept_id) DO NOTHING (espelha uq_ccs_cnae_concept).
-- review_status='approved' (seed curado + revisado por Clayton). source/catalog_version explícitos.
-- ============================================================

BEGIN;

INSERT INTO cnae_concept_suggestions
  (cnae_code, suggested_concept_id, confidence, rationale, source, catalog_version, review_status)
SELECT
  v.cnae_code,
  c.concept_id,
  v.confidence,
  v.rationale,
  'clayton_curated_mvp_2026_06_05',
  '2026-06-05-mvp-7-verticals',
  'approved'
FROM (VALUES
  ('4711302', 'varejo-alimentar-integrado',                'high',   'supermercado — CNAE 4711-3/02 (comercio varejista de mercadorias em geral, predominancia alimenticia)'),
  ('4724500', 'varejo-alimentar-especializado-hortifruti', 'high',   'hortifruti — CNAE 4724-5/00 (comercio varejista de hortifrutigranjeiros)'),
  ('4722901', 'varejo-alimentar-especializado-carnes',     'high',   'acougue — CNAE 4722-9/01 (comercio varejista de carnes)'),
  ('4721102', 'varejo-alimentar-especializado-padaria',    'high',   'padaria — CNAE 4721-1/02 (padaria e confeitaria com predominancia de revenda)'),
  ('4771701', 'saude-varejo-farmaceutico',                 'high',   'farmacia — CNAE 4771-7/01 (comercio varejista de produtos farmaceuticos, sem manipulacao)'),
  ('9602501', 'servicos-pessoais-beleza',                  'high',   'salao — CNAE 9602-5/01 (cabeleireiros, manicure e pedicure)'),
  ('9602502', 'servicos-pessoais-beleza',                  'medium', 'salao secondary-beauty-scope — CNAE 9602-5/02 (estetica e outros servicos de cuidados com a beleza)'),
  ('5611201', 'alimentacao-servico-preparado',             'high',   'restaurante — CNAE 5611-2/01 (restaurantes e similares)')
) AS v(cnae_code, concept_slug, confidence, rationale)
JOIN concepts c ON c.slug = v.concept_slug
WHERE EXISTS (
  SELECT 1 FROM company_type_allowed_concepts ctac WHERE ctac.concept_id = c.concept_id
)
ON CONFLICT (cnae_code, suggested_concept_id) DO NOTHING;

-- GATE fail-closed: as 8 linhas curadas DEVEM existir (7 verticais + salão estética secundário).
-- Se algum slug não resolveu ou não era allowed-pair, abortar — sem seed parcial silencioso.
DO $$
DECLARE
  n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM cnae_concept_suggestions
   WHERE source = 'clayton_curated_mvp_2026_06_05';
  IF n <> 8 THEN
    RAISE EXCEPTION 'SEED_CNAE_ABORT: esperado 8 sugestoes curadas, encontrado %. Slug nao resolvido ou nao allowed-pair.', n;
  END IF;
END $$;

COMMIT;

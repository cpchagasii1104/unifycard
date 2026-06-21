-- ============================================================
-- MIGRATION: 20260620140000_seed_concepts_wedding_pilot.sql
-- U1b (MIG A) · F-ONTOLOGY-COMPOSITION-NEEDS-GRAPH — seed governado dos concepts NOVOS
-- da árvore-piloto "festa de casamento" (versão-REUSO ratificada Clayton/ChatGPT 2026-06-20).
--
-- ÁRVORE: raiz `festa-de-casamento` + 9 folhas. 4 folhas são REUSADAS (subjects neutros já
-- vivos — fotografia/musica/decoracao em educacao-e-conhecimento; servicos-pessoais-beleza em
-- servicos) e NÃO são tocadas aqui. Esta migration cria SÓ os 6 NOVOS concepts.
--
-- INVARIANTE (DECISION-0142): concept_id = identidade; concept.domain = auxiliar/breadcrumb;
-- domain NÃO limita matching; descoberta/oferta futura casa por concept_id, NUNCA filtra por
-- domain. Folha = SSOT global context-neutral; contexto mora na ARESTA (MIG B), nunca na folha.
--
-- Governança: trigger 0075 (trg_concept_governance) exige set_config('app.concept_governance')
-- na MESMA transação. Idempotente (ON CONFLICT (domain, slug) DO NOTHING). Forward-only.
-- Negative-proof: rodar o INSERT sem o set_config → 0075 bloqueia ('concept insert blocked').
-- ============================================================

BEGIN;

-- GUARD-PRÉ (fail-closed): os 4 REUSADOS já devem existir (senão a aresta da MIG B resolve NULL).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM concepts WHERE (slug, domain) IN (
    ('fotografia',               'educacao-e-conhecimento'),
    ('musica',                   'educacao-e-conhecimento'),
    ('decoracao',                'educacao-e-conhecimento'),
    ('servicos-pessoais-beleza', 'servicos')
  );
  IF n <> 4 THEN
    RAISE EXCEPTION 'ABORT U1b MIG A: reusados esperados=4, encontrados=% (a árvore depende deles)', n;
  END IF;
END $$;

-- Caminho governado (trigger 0075).
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain) VALUES
  ('festa-de-casamento', 'cultura-lazer-e-eventos'),
  ('local-de-evento',    'servicos'),
  ('buffet',             'servicos'),
  ('locacao-de-traje',   'servicos'),
  ('cerimonial',         'servicos'),
  ('transporte',         'mobilidade-e-logistica')
ON CONFLICT (domain, slug) DO NOTHING;

-- GUARD-PÓS (fail-closed): os 6 NOVOS presentes.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM concepts WHERE (slug, domain) IN (
    ('festa-de-casamento', 'cultura-lazer-e-eventos'),
    ('local-de-evento',    'servicos'),
    ('buffet',             'servicos'),
    ('locacao-de-traje',   'servicos'),
    ('cerimonial',         'servicos'),
    ('transporte',         'mobilidade-e-logistica')
  );
  IF n <> 6 THEN
    RAISE EXCEPTION 'ABORT U1b MIG A: concepts novos esperados=6, encontrados=%', n;
  END IF;
END $$;

COMMIT;

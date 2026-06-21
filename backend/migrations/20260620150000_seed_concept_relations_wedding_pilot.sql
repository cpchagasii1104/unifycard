-- ============================================================
-- MIGRATION: 20260620150000_seed_concept_relations_wedding_pilot.sql
-- U1b (MIG B) · F-ONTOLOGY-COMPOSITION-NEEDS-GRAPH — seed governado das 9 ARESTAS da
-- árvore-piloto "festa de casamento" (depende de MIG A 20260620140000).
--
-- ÁRVORE RATIFICADA (Clayton/ChatGPT) — subject = festa-de-casamento (cultura-lazer-e-eventos):
--   requires:   local-de-evento(servicos) · buffet(servicos) · fotografia(educacao-e-conhecimento)
--               · musica(educacao-e-conhecimento) · decoracao(educacao-e-conhecimento)
--   related_to: servicos-pessoais-beleza(servicos) · locacao-de-traje(servicos)
--               · transporte(mobilidade-e-logistica) · cerimonial(servicos)
-- Arestas CROSS-DOMAIN são legítimas (grafo global pós-0092). Contexto mora na ARESTA, não na folha.
--
-- Governança: trigger 0077 (trg_concept_relation_governance) exige set_config('app.graph_governance')
-- na MESMA transação (provado no U1). Idempotente (ON CONFLICT concept_relations_edge_uq DO NOTHING).
-- relation_type ∈ 6 tipos (CHECK do U1). Negative-proof: sem set_config → 0077 bloqueia.
-- Resolução por (slug, domain) EXPLÍCITO (domínios mistos — resolver por slug só erraria).
-- ============================================================

BEGIN;

-- Caminho governado (trigger 0077).
SELECT set_config('app.graph_governance', 'true', true);

INSERT INTO concept_relations (subject_concept_id, object_concept_id, relation_type)
SELECT s.concept_id, o.concept_id, v.rel
FROM (VALUES
  ('local-de-evento',          'servicos',                'requires'),
  ('buffet',                   'servicos',                'requires'),
  ('fotografia',               'educacao-e-conhecimento', 'requires'),
  ('musica',                   'educacao-e-conhecimento', 'requires'),
  ('decoracao',                'educacao-e-conhecimento', 'requires'),
  ('servicos-pessoais-beleza', 'servicos',                'related_to'),
  ('locacao-de-traje',         'servicos',                'related_to'),
  ('transporte',               'mobilidade-e-logistica',  'related_to'),
  ('cerimonial',               'servicos',                'related_to')
) AS v(obj_slug, obj_domain, rel)
JOIN concepts s ON s.slug = 'festa-de-casamento' AND s.domain = 'cultura-lazer-e-eventos'
JOIN concepts o ON o.slug = v.obj_slug AND o.domain = v.obj_domain
ON CONFLICT ON CONSTRAINT concept_relations_edge_uq DO NOTHING;

-- GUARD-PÓS (fail-closed): ÁRVORE EXATA — as 9 arestas certas, nem mais, nem menos, nem trocada.
DO $$
DECLARE matched int; total int;
BEGIN
  -- (a) cada uma das 9 arestas ratificadas existe (subject = festa-de-casamento)
  SELECT count(*) INTO matched
  FROM concept_relations r
  JOIN concepts s ON s.concept_id = r.subject_concept_id
   AND s.slug = 'festa-de-casamento' AND s.domain = 'cultura-lazer-e-eventos'
  JOIN concepts o ON o.concept_id = r.object_concept_id
  WHERE (o.slug, o.domain, r.relation_type) IN (
    ('local-de-evento',          'servicos',                'requires'),
    ('buffet',                   'servicos',                'requires'),
    ('fotografia',               'educacao-e-conhecimento', 'requires'),
    ('musica',                   'educacao-e-conhecimento', 'requires'),
    ('decoracao',                'educacao-e-conhecimento', 'requires'),
    ('servicos-pessoais-beleza', 'servicos',                'related_to'),
    ('locacao-de-traje',         'servicos',                'related_to'),
    ('transporte',               'mobilidade-e-logistica',  'related_to'),
    ('cerimonial',               'servicos',                'related_to')
  );
  -- (b) NENHUMA aresta extra com subject = festa-de-casamento
  SELECT count(*) INTO total
  FROM concept_relations r
  JOIN concepts s ON s.concept_id = r.subject_concept_id
   AND s.slug = 'festa-de-casamento' AND s.domain = 'cultura-lazer-e-eventos';

  IF matched <> 9 THEN
    RAISE EXCEPTION 'ABORT U1b MIG B: arestas ratificadas presentes=% (esperado 9)', matched;
  END IF;
  IF total <> 9 THEN
    RAISE EXCEPTION 'ABORT U1b MIG B: subject=festa-de-casamento tem % arestas (esperado exatamente 9 — ha extra/errada)', total;
  END IF;
END $$;

COMMIT;

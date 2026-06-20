-- ============================================================
-- MIGRATION: 20260620130000_widen_concept_relations_relation_type_3to6.sql
-- U1 · MACRO 1 (F-ONTOLOGY-COMPOSITION-NEEDS-GRAPH) — widening do vocabulário do grafo.
--
-- CONTEXTO: conformidade NORMA→código (18_DOMAIN_ONTOLOGY_UNIFICARD.md §6.2 — 6 tipos normados).
-- Hoje concept_relations.relation_type aceita 3 (enables/evolves_to/related_to); a norma
-- manda 6. Esta migration amplia o CHECK para os 6 tipos canônicos, SEM 'suggests'.
-- Espelha os outros 2 pontos da mesma fatia (graph.adapter.ts GraphRelationType +
-- graph-governance.service.ts RELATION_TYPES).
--
-- NATUREZA: widening (mais permissivo) → nenhuma linha existente viola; forward-only;
-- idempotente (DROP IF EXISTS + ADD). Trigger de governança 0077
-- (trg_concept_relation_governance) INTOCADO. NÃO semeia relações, NÃO cria projeção
-- needs-graph, NÃO toca category_relations, services, service_offerings, RFQ, presença,
-- dinheiro, worker ou payout.
-- ============================================================

BEGIN;

ALTER TABLE concept_relations
  DROP CONSTRAINT IF EXISTS concept_relations_relation_type_check;

ALTER TABLE concept_relations
  ADD CONSTRAINT concept_relations_relation_type_check
  CHECK (
    relation_type IN (
      'enables',
      'requires',
      'evolves_to',
      'related_to',
      'part_of',
      'substitutes'
    )
  );

COMMIT;

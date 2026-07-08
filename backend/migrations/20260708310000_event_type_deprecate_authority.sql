-- 20260708310000: TRANSIÇÃO (F-EVENT-CONCEPT-FIRST-MODEL Fatia 4). event_type/event_subtype DEIXAM de ser
-- autoridade — a identidade do evento passa a ser event_format_concept_id (+ temas + facets). event_type
-- vira NULLABLE para que novos eventos NÃO precisem de um valor legado falso (Clayton: "não inventar
-- backfill semântico falso"). Eventos antigos MANTÊM seu event_type (compat de leitura + backfill p/ facet
-- em fatia de leitura). Nada é remapeado à força aqui. Δbank=0.
BEGIN;

-- event_type: NOT NULL → NULLABLE. Novo write formato-first não preenche event_type (fica NULL, honesto).
ALTER TABLE events ALTER COLUMN event_type DROP NOT NULL;

COMMIT;

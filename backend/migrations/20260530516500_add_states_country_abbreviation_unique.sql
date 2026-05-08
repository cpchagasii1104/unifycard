-- ============================================================
-- F3-S4b — Constraint defensiva: states(country_id, abbreviation)
-- ============================================================
-- Remete a: DECISION-0020 + auditoria ChatGPT F3-S5 pre-apply
-- Frente: F3 — Domain Foundations: Location Core Materialization
--
-- Contexto:
--   Migration F3-S4 (20260530516000) criou a tabela states sem
--   constraint UNIQUE em abbreviation. ChatGPT identificou durante
--   auditoria do seed F3-S5 que:
--
--   1. Subqueries do seed usavam WHERE abbreviation = 'PR' sem
--      filtrar por country_id — semanticamente incorreto (implica
--      que sigla estadual é globalmente única, o que é falso).
--
--   2. Ausência de UNIQUE(country_id, abbreviation) permite que
--      dois estados do mesmo país tenham a mesma sigla.
--
--   Janela de correção: banco ainda está vazio. Custo = zero agora,
--   alto depois (dados reais, FKs, addresses, region_members).
--
-- Decisão (Clayton, 2026-05-08):
--   "Baixo custo agora, alto custo depois. Janela rara: schema
--   existe, dados reais ainda não. Hora certa de endurecer."
--
-- F3-S4 original NÃO foi alterada (história preservada).
-- Esta migration é aditiva e isolada.
-- ============================================================

BEGIN;

ALTER TABLE states
  ADD CONSTRAINT states_country_abbreviation_unique
  UNIQUE (country_id, abbreviation);

COMMIT;

-- ============================================================
-- VALIDAÇÃO PÓS-APLICAÇÃO
-- ============================================================
-- SELECT conname, contype FROM pg_constraint
-- WHERE conrelid = 'states'::regclass
--   AND conname = 'states_country_abbreviation_unique';
-- -> deve retornar 1 linha com contype = 'u'
-- ============================================================

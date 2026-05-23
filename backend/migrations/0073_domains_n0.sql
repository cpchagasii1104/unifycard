-- ============================================================
-- 0073: domains (N0 canônico) + concepts.n0_domain
-- ============================================================
-- Norma: docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md (sec. 7 e 8).
-- concepts.domain legado (ex.: tenant:<uuid>) permanece; n0_domain é o N0 oficial.
-- n0_domain fica NULL até backfill; NOT NULL será fase posterior (após mapeamento).
-- ============================================================

BEGIN;

CREATE TABLE domains (
  domain_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE domains IS
  'Domínios N0 oficiais (lista fechada). SSOT no banco alinhado à ontologia UnifiCard.';

-- 12 core (sec. 7)
INSERT INTO domains (domain_key) VALUES
  ('pessoas-e-identidades'),
  ('organizacoes-e-instituicoes'),
  ('comunidades-e-grupos'),
  ('produtos-e-comercio'),
  ('servicos'),
  ('ativos-corporativos'),
  ('financas-e-economia'),
  ('mobilidade-e-logistica'),
  ('cultura-lazer-e-eventos'),
  ('saude-e-bem-estar'),
  ('educacao-e-conhecimento'),
  ('governanca-e-decisao');

-- 1 condicional (sec. 8) — elegível, não obrigatório em produto até ativação
INSERT INTO domains (domain_key) VALUES
  ('construcao-e-infraestrutura');

ALTER TABLE concepts
  ADD COLUMN n0_domain TEXT NULL REFERENCES domains (domain_key) ON DELETE RESTRICT;

CREATE INDEX idx_concepts_n0_domain ON concepts (n0_domain) WHERE n0_domain IS NOT NULL;

COMMENT ON COLUMN concepts.domain IS
  'Legado / bootstrap (ex.: tenant:<uuid>). Não substitui n0_domain como classificação N0.';
COMMENT ON COLUMN concepts.n0_domain IS
  'Domínio N0 oficial (FK domains). Preencher por migração de dados; NOT NULL após backfill completo.';

COMMIT;

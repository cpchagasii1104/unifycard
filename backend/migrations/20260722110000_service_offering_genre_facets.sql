-- 20260722110000: EVENT-ENGINE-COMPLETION · C1b — facet MULTI-GÊNERO da oferta de apresentação musical.
-- Habilita "achar banda POR GÊNERO e livre no DIA X". ACOPLA, não greenfield: espelha o elo many-to-many
-- SELADO `event_theme_links` (20260708290000) — evento↔subject-concept; aqui é service_offering↔subject-
-- concept (gênero). Multi-gênero: uma oferta linka N gêneros. Gênero = subject-concept GOVERNADO: a FK aponta
-- para `shared_subject_concepts` (pool NEUTRO de assunto já semeado — rock/samba/funk/…, 20260708340000),
-- tornando "gênero solto" fisicamente impossível (mais forte que o concept-FK do event_theme_links, conforme
-- §5 C1b: "só subject-concepts governados; sem gênero solto"). NÃO semeia gênero novo. Aditiva/idempotente/
-- forward-only. Bank-free (Δbank=0).
BEGIN;

CREATE TABLE IF NOT EXISTS service_offering_genre_facets (
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_offering_id UUID NOT NULL REFERENCES service_offerings(id) ON DELETE CASCADE,
  subject_concept_id  UUID NOT NULL REFERENCES shared_subject_concepts(concept_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (service_offering_id, subject_concept_id)
);

-- Descoberta por gênero varre o facet a partir da oferta ATIVA do provider (predicado espelho do de
-- disponibilidade, hasCanonicalOfferingFutureAvailability): índice por (tenant, subject_concept) acelera.
CREATE INDEX IF NOT EXISTS idx_sogf_tenant_concept
  ON service_offering_genre_facets (tenant_id, subject_concept_id);

COMMENT ON TABLE service_offering_genre_facets IS
  'C1b: elo MUITOS-PARA-MUITOS oferta↔gênero (subject-concept governado). Espelha event_theme_links; FK em '
  'shared_subject_concepts impede gênero solto. Facet de DESCOBERTA — não define identidade nem preço/agenda.';

COMMIT;

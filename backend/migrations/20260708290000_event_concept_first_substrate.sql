-- 20260708290000: EVENTO CONCEPT-FIRST — substrato (F-EVENT-CONCEPT-FIRST-MODEL, GO Clayton 2026-07-08).
-- Modelo aprovado pelos dois modelos convergidos: evento = ato do Actor composto de dimensões ORTOGONAIS.
-- Identidade semântica = CONCEPT (formato + tema). Estas tabelas NÃO são SSOT — só declaram APLICABILIDADE
-- (que papel um CONCEPT joga no domínio de eventos), espelhando concept_rentable_types das locações.
-- NÃO cria event_kind paralelo · NÃO usa offer_kind='event' · categoria = facet de descoberta (não pai).
-- 'route' entra como valor GOVERNADO planejado mas fica DISABLED no MVP (viagem/trilha = depois). Δbank=0.
BEGIN;

-- (A) FORMATO: quais CONCEPTs funcionam como formato de evento + comportamento do domínio.
-- A semântica continua em concepts; aqui só o papel + flags de comportamento (capacidade/preço/rota/orq).
CREATE TABLE IF NOT EXISTS event_format_concepts (
  concept_id UUID PRIMARY KEY REFERENCES concepts(concept_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  supports_capacity BOOLEAN NOT NULL DEFAULT true,
  supports_ticket_price BOOLEAN NOT NULL DEFAULT true,
  supports_route_location BOOLEAN NOT NULL DEFAULT false,
  supports_orchestration BOOLEAN NOT NULL DEFAULT true,
  orchestration_template_key TEXT,             -- ponteiro p/ template de necessidades (Fatia 6); sem tabela nova agora
  required_capabilities TEXT[],                -- capabilities exigidas do actor p/ criar (NULL = qualquer)
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (B) TEMA: concepts vinculados a um evento como assunto (opcional; multi). role fixo p/ extensão futura.
CREATE TABLE IF NOT EXISTS event_theme_links (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES concepts(concept_id),
  role TEXT NOT NULL DEFAULT 'theme',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, concept_id, role)
);

-- (C) CATEGORIA: facet de DESCOBERTA (múltipla por evento). Não define identidade. Vocabulário governado.
CREATE TABLE IF NOT EXISTS event_category_facets (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, category_key),
  CONSTRAINT chk_event_category_facet CHECK (category_key IN
    ('social','cultural','gastronomico','esportivo','profissional','comunitario','espiritual','educacional','comercial_institucional'))
);

-- (D) events: formato (FK concept, nullable durante transição) + location_mode governado.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_format_concept_id UUID REFERENCES concepts(concept_id),
  ADD COLUMN IF NOT EXISTS location_mode TEXT;

ALTER TABLE events
  ADD CONSTRAINT chk_events_location_mode
  CHECK (location_mode IS NULL OR location_mode IN ('fixed_place','online','hybrid','to_be_defined','route'));

COMMIT;

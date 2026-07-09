-- 20260708360000: F-EVENT-ORCHESTRATION-PHASE-B — substrato de orquestração (RFC ratificado).
-- Necessidade operacional de evento = relação governada → CONCEPT com aplicabilidade explícita. v1 só
-- fulfillment_kind='service'. Autoridade por format_concept_id (NÃO orchestration_template_key string, NÃO
-- event_type legado). Enforcement MATERIAL: FK composta (need_concept_id, fulfillment_kind) → concept_offer_kinds
-- (concept_id, offer_kind) garante que o need é offer_kind='service'. Δbank=0. Forward-only. Sem preço/agenda/RFQ.
BEGIN;

-- (A) TEMPLATE por formato: "este formato tipicamente precisa deste service concept".
CREATE TABLE IF NOT EXISTS event_orchestration_template_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format_concept_id UUID NOT NULL REFERENCES event_format_concepts(concept_id) ON DELETE CASCADE,
  need_concept_id   UUID NOT NULL REFERENCES concepts(concept_id),
  fulfillment_kind  TEXT NOT NULL DEFAULT 'service',
  is_required       BOOLEAN NOT NULL DEFAULT false,
  sort_order        INTEGER NOT NULL DEFAULT 100,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_event_orch_template_fulfillment CHECK (fulfillment_kind IN ('service')),
  CONSTRAINT uq_event_orch_template_format_need UNIQUE (format_concept_id, need_concept_id),
  CONSTRAINT fk_event_orch_template_need_is_offerable
    FOREIGN KEY (need_concept_id, fulfillment_kind) REFERENCES concept_offer_kinds (concept_id, offer_kind)
);

-- (B) INSTÂNCIA por evento: "este evento declarou esta necessidade". (Substrato pronto; o write-path do
-- organizador + frontend são fatia posterior — não há POST nesta fatia.)
CREATE TABLE IF NOT EXISTS event_operational_needs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  need_concept_id  UUID NOT NULL REFERENCES concepts(concept_id),
  fulfillment_kind TEXT NOT NULL DEFAULT 'service',
  status           TEXT NOT NULL DEFAULT 'open',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_event_op_needs_fulfillment CHECK (fulfillment_kind IN ('service')),
  CONSTRAINT chk_event_op_needs_status CHECK (status IN ('open', 'filled', 'cancelled')),
  CONSTRAINT uq_event_op_needs_event_need UNIQUE (event_id, need_concept_id),
  CONSTRAINT fk_event_op_needs_need_is_offerable
    FOREIGN KEY (need_concept_id, fulfillment_kind) REFERENCES concept_offer_kinds (concept_id, offer_kind)
);

-- (C) Seed dos templates v1 (conservador; só service concepts válidos; chave = format_concept_id; SEM
-- som/iluminação/transporte/música). A FK composta REJEITA qualquer need não-service (fail-closed no seed).
INSERT INTO event_orchestration_template_items (format_concept_id, need_concept_id, fulfillment_kind, is_required, sort_order)
SELECT fc.concept_id, nc.concept_id, 'service', v.req, v.sort
  FROM (VALUES
    -- festa / celebração: espectro completo
    ('festa','buffet-para-eventos', true, 10),
    ('festa','cozinheiro', false, 20),
    ('festa','garcom', false, 30),
    ('festa','decoracao-de-eventos', false, 40),
    ('festa','fotografia-de-eventos', false, 50),
    ('festa','seguranca-eventos', false, 60),
    ('festa','limpeza-de-eventos', true, 70),
    ('celebracao','buffet-para-eventos', true, 10),
    ('celebracao','cozinheiro', false, 20),
    ('celebracao','garcom', false, 30),
    ('celebracao','decoracao-de-eventos', false, 40),
    ('celebracao','fotografia-de-eventos', false, 50),
    ('celebracao','seguranca-eventos', false, 60),
    ('celebracao','limpeza-de-eventos', true, 70),
    -- show / apresentação: segurança + registro + limpeza (som/iluminação FORA da v1)
    ('show','seguranca-eventos', true, 10),
    ('show','fotografia-de-eventos', false, 20),
    ('show','limpeza-de-eventos', false, 30),
    ('apresentacao','seguranca-eventos', false, 10),
    ('apresentacao','fotografia-de-eventos', false, 20),
    ('apresentacao','limpeza-de-eventos', false, 30),
    -- workshop / palestra / treinamento: registro + limpeza opcionais (sem inventar som/iluminação)
    ('workshop','fotografia-de-eventos', false, 10),
    ('workshop','limpeza-de-eventos', false, 20),
    ('palestra','fotografia-de-eventos', false, 10),
    ('palestra','limpeza-de-eventos', false, 20),
    ('treinamento','fotografia-de-eventos', false, 10),
    ('treinamento','limpeza-de-eventos', false, 20)
  ) v(fmt, need, req, sort)
  JOIN concepts fc ON fc.slug = v.fmt
  JOIN event_format_concepts efc ON efc.concept_id = fc.concept_id
  JOIN concepts nc ON nc.slug = v.need
ON CONFLICT (format_concept_id, need_concept_id) DO NOTHING;

COMMIT;

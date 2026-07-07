-- 20260706170000_event_audience_relationship_refinement.sql
-- DECISION-0161 D1 (RATIFICADA por Clayton 2026-07-06) — fatia 1 da sequência §5.
-- Plateia de evento = MACRO (events.visibility, CHECK EXISTENTE, INTOCADO) + refinamento OPCIONAL
-- `audience_relationship_types` — COMPOSTO do vocabulário GOVERNADO do typed-edge actor_relationships
-- (chk_actor_relationships_requester_label): amigo|conhecido|familiar|cliente|colaborador|fornecedor|
-- parceiro. NULL = sem refinamento (comportamento atual preservado — aditivo, zero breaking).
-- Ex.: visibility='private' + ARRAY['familiar','amigo'] = "só parentes e amigos".
-- ZERO vocabulário novo (Lei de Coerência §5; lição C1/F1). Enforcement na LEITURA = fatia 4.
-- Forward-only · idempotente · Δbank=0.

ALTER TABLE events ADD COLUMN IF NOT EXISTS audience_relationship_types TEXT[] NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_audience_relationship_types') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_audience_relationship_types CHECK (
      audience_relationship_types IS NULL OR (
        array_length(audience_relationship_types, 1) >= 1
        AND audience_relationship_types <@ ARRAY['amigo','conhecido','familiar','cliente','colaborador','fornecedor','parceiro']::text[]
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN events.audience_relationship_types IS
  'DECISION-0161: refinamento OPCIONAL da plateia — subconjunto do vocabulário governado do typed-edge (actor_relationships). NULL = sem refinamento. Enforcement na leitura via event-visibility (viewer precisa de aresta ACEITA de um dos tipos com o organizador).';

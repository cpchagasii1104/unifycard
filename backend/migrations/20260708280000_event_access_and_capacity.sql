-- 20260708280000: ACESSO/CUSTO + CAPACIDADE do evento (GO Clayton 2026-07-08). Aposenta o "Tom do Evento"
-- (Íntimo/Familiar/Grande) — que confundia com a PLATEIA (Familiares) e com visibilidade — por campos
-- OBJETIVOS e separados: acesso/custo (event_access_type) + capacidade (min/max attendees).
-- SEPARAÇÃO: Plateia (quem vê) ≠ Categoria (o que é) ≠ Acesso/custo ≠ Capacidade ≠ Discoverability.
-- Dinheiro = ANÚNCIO apenas (ticket_price_cents já existe, BIGINT). Δbank=0 — sem pagamento/estorno real.
-- 'a combinar' FORA do MVP (decisão Clayton). Vocabulário GOVERNADO pt-BR (padrão dos enums de negócio:
-- preco_ofertado/com_analise/diaria) + registrado em governed-vocabularies.manifest (events.access_type).
BEGIN;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_access_type TEXT,
  ADD COLUMN IF NOT EXISTS min_attendees INTEGER;

ALTER TABLE events
  ADD CONSTRAINT chk_events_access_type
  CHECK (event_access_type IS NULL OR event_access_type IN ('gratuito', 'pago', 'contribuicao_opcional'));
ALTER TABLE events
  ADD CONSTRAINT chk_events_min_attendees_positive
  CHECK (min_attendees IS NULL OR min_attendees >= 1);

COMMIT;

-- 20260708270000: EVENTO entra no sistema TRANSVERSAL de plateia (F-EVENT-AUDIENCE-SSOT-UNIFICATION,
-- GO Clayton 2026-07-08). O evento tinha vocabulário PARALELO de visibility (public/private/unlisted/
-- group/followers) que também governava quem podia VER o evento. Unifica com o canônico do resto do
-- sistema: visibility ∈ {public, connections, only_me} + audience_relationship_types (coluna já existe).
--
-- DISTINÇÃO do Clayton: 'unlisted' NÃO é plateia — é DISCOVERABILITY (se aparece em feed/busca). Por isso
-- NÃO vira 'public' silenciosamente: separa em coluna `discoverability` (listed|unlisted). Hoje só há
-- public/private (sem group/followers/unlisted), então backfill sem perda. Forward-only. Δbank=0.
BEGIN;

-- DISCOVERABILITY separada (onde aparece) ≠ visibility (quem vê).
ALTER TABLE events ADD COLUMN IF NOT EXISTS discoverability TEXT NOT NULL DEFAULT 'listed';

-- eventos 'unlisted' legados (se houver) → discoverability=unlisted; a visibility deles vira 'public'
-- (podem ser vistos por quem tem o link), mas NÃO listados. Semântica preservada, não conflada.
UPDATE events SET discoverability = 'unlisted' WHERE visibility = 'unlisted';

-- troca a CHECK legada e migra a visibility para o vocabulário canônico.
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_events_visibility;
UPDATE events SET visibility = CASE
  WHEN visibility = 'private'                 THEN 'only_me'
  WHEN visibility IN ('group', 'followers')  THEN 'connections'  -- eram "conexão"; tipos ficam em audience_relationship_types
  WHEN visibility = 'unlisted'               THEN 'public'       -- discoverability já marcada acima
  ELSE visibility                                                -- 'public' fica
END;

ALTER TABLE events ADD CONSTRAINT chk_events_visibility
  CHECK (visibility IN ('public', 'connections', 'only_me'));
ALTER TABLE events ADD CONSTRAINT chk_events_discoverability
  CHECK (discoverability IN ('listed', 'unlisted'));

COMMIT;

-- ============================================================
-- MIGRATION: DROP event_reservations.global_user_id (FK QUE MENTE)
-- Arquivo: 20260703120000_drop_event_reservations_mislabeled_global_user_id.sql
-- Frente: F-EVENT-RESERVATIONS-MISLABELED-FK-CONTAIN
-- Achado B7 do auditoria.md / DT-IDENTITY-TRIAD-AND-MISLABELED-FK (parte c).
--
-- PROBLEMA (a FK que mente):
--   A migration 20260530470000 adicionou `global_user_id UUID REFERENCES actors(id)`
--   a event_reservations. O NOME diz "global_user_id" mas a FK aponta actors(id) — nao
--   global_users. Qualquer join "obvio" por nome nessa coluna esta semanticamente errado.
--   Pior: a coluna DUPLICA o `actor_id` genesis (20260530420000, NOT NULL REFERENCES
--   actors(id)), que e a coluna canonica actor-first — a mesma que TODA tabela-irma de
--   eventos usa (event_checkins.attendee_actor_id, event_consumptions.actor_id,
--   ticket_sales.buyer_actor_id, event_organizer_members.actor_id) e a mesma que o
--   UNICO leitor vivo (home-feed.service.ts: `er.actor_id = $2`) ja consulta.
--
-- POR QUE E SEGURO DROPAR (nao renomear — actor_id ja existe):
--   1. O unico WRITER da coluna (occupancy.service.createReservation) NAO TEM CALLER VIVO
--      (codigo morto) e alem disso NUNCA teve sucesso: o INSERT omitia o `actor_id` NOT NULL
--      genesis => 23502. Logo a coluna e provadamente vazia por esse caminho.
--   2. Nenhum leitor vivo consulta global_user_id (home-feed usa actor_id; getOccupancyStats
--      so faz COUNT por status). As 6 referencias a event_reservations no repo foram
--      enumeradas — nenhuma le esta coluna.
--   3. `actor_id` NOT NULL garante COMPLETUDE: toda linha ja tem referencia de actor. Dropar
--      global_user_id nao pode orfanar nenhuma reserva.
--   O codigo morto foi corrigido no MESMO commit para escrever `actor_id` (actor-first),
--   entao "parar escritas" (disciplina DECISION-0062 F5) esta satisfeito antes do drop.
--
-- FAIL-CLOSED (substrato de identidade — recusa destruir sob incerteza):
--   Antes do DROP, se QUALQUER linha tiver global_user_id nao-nulo E divergente de actor_id,
--   a migration ABORTA (RAISE) exigindo reconciliacao humana. Assim o drop so ocorre se a
--   coluna for provadamente redundante/vazia; se a realidade contradisser a analise, o
--   runner para fail-closed em vez de perder dado de identidade silenciosamente.
--
-- ESCOPO: NAO toca a triade CPF (DECISION-0062 F4/F5 = norm-blocked por D9/D10). So a FK
-- que mente. Δbank=0 (nenhuma coluna financeira tocada).
-- ============================================================

BEGIN;

DO $$
BEGIN
  -- guarda: a coluna pode ja nao existir (idempotencia forward-only)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_reservations' AND column_name = 'global_user_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM event_reservations
      WHERE global_user_id IS NOT NULL
        AND global_user_id IS DISTINCT FROM actor_id
    ) THEN
      RAISE EXCEPTION
        'ABORT [B7/DT-IDENTITY-TRIAD-AND-MISLABELED-FK]: event_reservations.global_user_id tem dado nao-nulo divergente de actor_id. A coluna nao e redundante como a analise assumiu — reconciliacao humana obrigatoria antes do DROP (revisao adversarial recomendada pelo laudo).';
    END IF;
  END IF;
END $$;

-- DROP COLUMN remove em cascata o FK constraint (event_reservations_global_user_id_fkey)
-- e o indice (idx_event_reservations_global_user). IF EXISTS = forward-only idempotente.
ALTER TABLE event_reservations DROP COLUMN IF EXISTS global_user_id;

COMMIT;

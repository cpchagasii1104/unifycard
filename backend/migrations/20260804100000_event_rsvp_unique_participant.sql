-- 20260804100000_event_rsvp_unique_participant.sql
-- F-EVENT-FREE-REGISTRATION — o "upsert" de RSVP não tinha como ser upsert.
--
-- ═══ O PROBLEMA (medido, não suposto) ═══
-- `eventRSVPService.upsertRSVP` faz SELECT → decide → INSERT ou UPDATE em comandos separados.
-- Isso só é seguro se o banco IMPEDIR o par duplicado. E não impedia: o único índice de
-- `event_rsvp` era a PK de `id`.
--   SELECT indexdef FROM pg_indexes WHERE tablename='event_rsvp'
--     → CREATE UNIQUE INDEX event_rsvp_pkey ON public.event_rsvp USING btree (id)   [só isso]
-- Consequência: dois cliques no botão "Vou" (ou duas abas) criam DUAS linhas para a mesma pessoa
-- no mesmo evento, e `getRSVPCounts` — que é um GROUP BY status — passa a contar a mesma pessoa
-- duas vezes. Contagem de presença inflada é mentira sobre lotação, e lotação decide se cabe mais
-- gente. É o mesmo TOCTOU (check-then-act) já catalogado no cap de grupos.
--
-- ═══ POR QUE DOIS ÍNDICES PARCIAIS, E NÃO UM ═══
-- RSVP tem DOIS sujeitos possíveis, e a tabela permite os dois: `user_id` (pessoa logada) OU
-- `guest_email` (convidado sem conta) — o service escolhe o caminho em runtime. Um UNIQUE simples
-- em (tenant_id, event_id, user_id) NÃO serve: em Postgres, NULL nunca é igual a NULL, então
-- todos os convidados (user_id NULL) escapariam da trava. Daí um índice parcial para cada sujeito.
--
-- `lower(guest_email)`: e-mail é case-insensitive na prática — "Ana@x.com" e "ana@x.com" são a
-- mesma pessoa e não podem virar duas presenças.
--
-- ⚠️ SEGURO DE APLICAR: `event_rsvp` tem 0 linhas medidas em unificard_dev nesta data, então não há
-- duplicata pré-existente que faça a criação do índice falhar. Se algum dia falhar em outro
-- ambiente, é porque a duplicata JÁ EXISTE lá — e aí o erro é a informação correta, não um
-- obstáculo: deduplicar é decisão de quem tem o dado.
--
-- Forward-only (Lei 2). Não altera coluna, não apaga nada — só impede o que nunca deveria existir.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_rsvp_user
  ON event_rsvp (tenant_id, event_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_rsvp_guest_email
  ON event_rsvp (tenant_id, event_id, lower(guest_email))
  WHERE guest_email IS NOT NULL;

COMMIT;

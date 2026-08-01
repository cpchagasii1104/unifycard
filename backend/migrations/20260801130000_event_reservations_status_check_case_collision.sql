-- 20260801130000_event_reservations_status_check_case_collision.sql
-- F-CHECK-CASE-SECOND-POPULATION: fecha a colisão de case em event_reservations.status —
-- a SEGUNDA população de case-drift, a que `pg_enum` NÃO enxerga porque vive em TEXT+CHECK.
-- Sucede em espírito 20260801120000 (9 enums nativos); o mecanismo aqui é DROP/ADD CONSTRAINT
-- porque a coluna é TEXT, não um tipo enum.
--
-- ⚠️ ESTE ARQUIVO FOI REESCRITO em 2026-08-01, ANTES de qualquer aplicação.
--    Provado antes de reescrever: `SELECT ... FROM schema_migrations WHERE filename = '...'`
--    → NUNCA APLICADA. Nenhum banco persistente a executou; os efêmeros que a validaram foram
--    destruídos. A Lei 2 (forward-only, nunca editar migration existente) protege migration que
--    JÁ RODOU em algum ambiente — não é o caso, e criar uma segunda migration para desfazer uma
--    primeira que ninguém executou deixaria lixo permanente no histórico.
--
-- 🔴 O QUE MUDOU NA REESCRITA, E POR QUÊ
--    A 1ª versão fechava a colisão mantendo as grafias MAIÚSCULAS (a convenção do writer vivo) e
--    declarava, no próprio COMMENT, que isso NÃO era a §4.11 — deixando a convergência como
--    "decisão nomeada pendente". Isso é ADIAR: cristalizaria em CHECK físico exatamente a
--    violação que a norma proíbe, e a próxima instância herdaria o débito com um selo por cima.
--    Decisão de Clayton, 2026-08-01: *"o objetivo é parar de adiar e de fato corrigir o sistema
--    da forma certa"*. A forma certa é a norma: `07_NOMENCLATURA_CANONICA §4.11` — status e
--    lifecycle em `snake_case` MINÚSCULO.
--
-- 🟢 O ACHADO QUE TORNA A CONVERGÊNCIA BARATA — e que inverte quem é o "errado":
--    `home-feed.service.ts:129` filtra `er.status IN ('pending','confirmed')` — MINÚSCULO. Foi
--    tratado como "o reader quebrado", mas ele é **o ÚNICO sítio que já obedecia a norma**. Quem
--    diverge é o writer (`occupancy.service.ts:233`, `'PENDING'`). Convergindo para minúsculo,
--    o home-feed volta a enxergar reservas de evento **sem uma linha de alteração nele** — o
--    vetor "compromisso" do feed estava estruturalmente cego desde 20260530470000 (2 meses).
--    Convergir para MAIÚSCULO exigiria mexer no home-feed E manteria a violação da norma: seria
--    mais trabalho para ficar errado.
--
-- ORIGEM DO DEFEITO (não é invenção — é decisão antiga mal resolvida):
--   `20260530470000_fix_occupancy_schema.sql` encontrou o gênesis em lowercase e o código em
--   UPPERCASE e "resolveu" AMPLIANDO o CHECK para aceitar OS DOIS. O comentário de lá é
--   explícito: *"dropar constraint antiga e criar nova que cobre ambos"*. Um CHECK que existe
--   para BARRAR incoerência passou a AUTORIZÁ-LA.
--
-- ALCANCE — os 5 sítios reais de `event_reservations` (grep sem truncar, 2026-08-01):
--   occupancy.service.ts:233        writer  'PENDING'                      → converge p/ 'pending'
--   occupancy.service.ts:297-299    reader  'CONFIRMED','CHECKED_IN','NO_SHOW' → converge
--   occupancy.types.ts:5            tipo    ReservationStatus              → converge
--   home-feed.service.ts:129,318    reader  'pending','confirmed'          → INTOCADO (já certo)
--   ⚠️ `ServicePreReservation` e `marketplace-dispatch` também casam no grep com 'confirmed',
--      mas são OUTRA entidade (pré-reserva de SERVIÇO, não reserva de evento). NÃO TOCADOS.
--
-- ESTADO MEDIDO ANTES (unificard_dev, read-only): event_reservations = **0 linhas**.
--   Sem linha, não há UPDATE de dado a fazer — só o CHECK e o DEFAULT.
--   'expired' sai: grafia do gênesis, nenhum caminho vivo a escreve ou lê.
--
-- IRMÃOS INVESTIGADOS, NENHUM COM COLISÃO (varredura dos 309 CHECK do banco):
--   actor_debts → (b) conjunto DIFERENTE, DT própria já aberta (DT-C36-actor-debts-case-drift).
--   chat_messages · chat_reports · live_presence · companies.company_status → internamente
--   consistentes; `company_status` já governado por DECISION-0097 D3/D4 (selado). Sem ação.
--
-- Forward-only / transacional / idempotente.

BEGIN;

ALTER TABLE event_reservations
  DROP CONSTRAINT IF EXISTS event_reservations_status_check;

ALTER TABLE event_reservations
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE event_reservations
  ADD CONSTRAINT event_reservations_status_check
  CHECK (status IN ('pending', 'confirmed', 'checked_in', 'no_show', 'cancelled'));

COMMENT ON COLUMN event_reservations.status IS
  'Lifecycle da reserva de evento, §4.11 snake_case minúsculo: pending, confirmed, checked_in, no_show, cancelled. A colisão anterior (os dois cases do MESMO valor no mesmo CHECK) vinha de 20260530470000, que ampliou o CHECK em vez de escolher — corrigida em 2026-08-01 convergindo código e schema para a norma.';

COMMIT;

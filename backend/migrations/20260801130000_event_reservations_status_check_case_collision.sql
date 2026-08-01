-- 20260801130000_event_reservations_status_check_case_collision.sql
-- F-CHECK-CASE-SECOND-POPULATION: fecha a colisão de case em event_reservations.status —
-- a SEGUNDA população de case-drift que pg_enum não enxerga (vive em TEXT+CHECK, não em
-- native enum). Sucede em espírito 20260801120000 (9 enums nativos), mas o mecanismo aqui
-- é ALTER TABLE ... DROP/ADD CONSTRAINT porque a coluna é TEXT, não um tipo pg_enum.
--
-- ACHADO (classificação (c) do mandato — "o CHECK está errado, não o dado"):
--   CHECK anterior (`event_reservations_status_check`) permitia DUAS grafias do MESMO valor
--   na MESMA coluna: 'pending'/'PENDING', 'confirmed'/'CONFIRMED', 'cancelled'/'CANCELLED'
--   — introduzido por 20260530470000_fix_occupancy_schema.sql, que encontrou o genesis em
--   lowercase e o código em UPPERCASE e "resolveu" ampliando o CHECK para aceitar os dois
--   em vez de escolher um. O comentário daquela migration já dizia: "Solução: dropar
--   constraint antiga e criar nova que cobre ambos" — é o próprio bug que este mandato
--   pediu para caçar.
--
-- PROVA DE ALCANCE (lido no código vivo, 2026-08-01):
--   · ÚNICO writer: `occupancy.service.ts:233` — INSERT ... VALUES (..., 'PENDING', ...)
--     (uppercase, sempre explícito — nunca depende do DEFAULT da coluna).
--   · Reader consistente com o writer: `occupancy.service.ts:297-299` — filtra
--     'CONFIRMED'/'CHECKED_IN'/'NO_SHOW' (uppercase).
--   · 🔴 Reader QUEBRADO: `home-feed.service.ts:129` — filtra
--     `er.status IN ('pending', 'confirmed')` (lowercase). Nunca bateu com nenhuma linha
--     que o único writer já escreveu, porque o único writer nunca escreveu lowercase desde
--     20260530470000 (2 meses atrás). Silencioso: 200 com lista vazia, sem erro, sem log —
--     exatamente o sintoma que o mandato descreveu para o par pending/PENDING.
--   · 'expired' (lowercase, só existia no genesis) e nenhum outro caminho vivo o escreve ou
--     lê — confirmado por busca no código (`expires_at` é OUTRA coluna, timestamp; a string
--     'expired' não aparece em nenhum caller de event_reservations).
--
-- 🔴 NÃO CORRIGIDO NESTA MIGRATION (fora de escopo — é código, não schema):
--   `home-feed.service.ts:129` precisa passar a filtrar 'PENDING'/'CONFIRMED' (maiúsculo) OU
--   a norma completa (07_NOMENCLATURA_CANONICA.md §4.11, status = lowercase) precisa ser
--   aplicada ao módulo de eventos inteiro (occupancy.service.ts + occupancy.types.ts +
--   home-feed.service.ts) — decisão nomeada de Clayton sobre qual convergência tomar,
--   análoga à pendência já registrada em `DT-C36-actor-debts-case-drift` (cartório,
--   linha ~11311) para o irmão `actor_debts`. Esta migration NÃO decide isso — só fecha a
--   colisão de case, sem mudar nenhum valor que o código vivo hoje escreve ou lê.
--
-- MAPEAMENTO — apenas remove as grafias MORTAS (nunca escritas desde 20260530470000):
--   lowercase 'pending'/'confirmed'/'cancelled'/'expired' saem do CHECK e do DEFAULT.
--   As 5 grafias que o código vivo usa hoje (PENDING, CONFIRMED, CHECKED_IN, NO_SHOW,
--   CANCELLED) são as únicas mantidas — zero mudança de comportamento para o único writer
--   e para os readers já consistentes.
--
-- ESTADO MEDIDO EM unificard_dev ANTES DESTA MIGRATION (read-only, 2026-08-01):
--   event_reservations: 0 linhas. DEFAULT da coluna: 'pending'::text (grafia morta — nunca
--   usado pelo único writer, que sempre passa 'PENDING' explícito).
--
-- IRMÃOS INVESTIGADOS NO MESMO MANDATO (nenhum migrado — nenhum tem colisão de case):
--   actor_debts        → (b) conjunto DIFERENTE (pending + TRANSFERRED_TO_ORGANIZER), já
--                          tem DT própria com decisão pendente (DT-C36-actor-debts-case-drift).
--                          NÃO TOCADO aqui — decisão nomeada já aberta, não duplicar.
--   chat_messages      → consistente (VISIBLE/DELETED, só maiúsculo). Sem colisão.
--   chat_reports       → consistente (OPEN/ACK/RESOLVED, só maiúsculo). Sem colisão.
--   live_presence      → consistente (ONLINE/OFFLINE, só maiúsculo). Sem colisão.
--   companies.company_status → consistente (DRAFT/PROVISIONAL/ACTIVE/SUSPENDED, só
--                          maiúsculo); CHECK já governado por DECISION-0097 D3/D4 (Fase
--                          3.3-A, selado). NÃO TOCADO — fora do meu mandato e já normado.
--   address_assignments → falso positivo da varredura inicial (colisão aparente era entre
--                          DUAS colunas distintas — owner_type='actor' × role=RESIDENCE/
--                          OPERATIONAL/HQ — cada uma internamente consistente). Sem ação.
--
-- Forward-only / transacional / idempotente (DROP IF EXISTS antes de recriar).

BEGIN;

ALTER TABLE event_reservations
  DROP CONSTRAINT IF EXISTS event_reservations_status_check;

ALTER TABLE event_reservations
  ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE event_reservations
  ADD CONSTRAINT event_reservations_status_check
  CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW', 'CANCELLED'));

COMMENT ON COLUMN event_reservations.status IS
  'Lifecycle da reserva de evento: PENDING, CONFIRMED, CHECKED_IN, NO_SHOW, CANCELLED (uppercase — convenção viva do único writer, occupancy.service.ts). NÃO confundir com §4.11 da norma (lowercase) — convergência completa exige tocar código (occupancy.service.ts + home-feed.service.ts) e é decisão nomeada pendente, não decidida por esta migration.';

COMMIT;

-- 20260806220000: DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT (GATE + GO Clayton 2026-08-06).
--
-- A METADE PRESCRITA da DECISION-0146 §A.7. A §A.7 faz DUAS coisas: PROÍBE constraint forte na
-- DECLARAÇÃO ("PROIBIDO EXCLUDE constraint em availability") e PRESCREVE que ela more no
-- COMPROMISSO ("se houver constraint forte, ela mira compromisso real de booking"). A migration
-- 20260806010000 cumpriu a proibição; esta cumpre a prescrição. Forward-only. Δbank=0.
--
-- ── O QUE ESTAVA MEDIDO ANTES (comando no cartório) ──────────────────────────────────────────────
--   SELECT conname, contype FROM pg_constraint WHERE conrelid='bookings'::regclass;
--   -- 2 CHECK, 2 FK, 1 PK. ZERO 'u', ZERO 'x'. + 3 indices, nenhum unico. + 0 trigger de negocio.
-- A exclusividade repousava INTEIRAMENTE no advisory lock de aplicacao
-- (unified-availability.repository.ts confirmBookingWithProviderLock/WithResourceLock): funciona,
-- e nao alcanca quem escreve por fora (psql, script, worker futuro, migration).
--
-- ── POR QUE **NAO** HA COLUNA TEMPORAL NOVA (furo apontado por Clayton no GO) ─────────────────────
-- Uma `commitment_range` seria a TERCEIRA forma de dizer "quando" na MESMA linha (janela da
-- availability por JOIN + booked_* + range). Duas verdades DENTRO da linha e pior que entre tabelas
-- porque ninguem desconfia. Em vez disso a EXCLUDE usa `booked_start/end_datetime`, que JA EXISTEM,
-- e o confirm passa a MATERIALIZA-LOS SEMPRE. Efeito colateral desejado: a assimetria medida no
-- GATE (ramo provider comparava a janela macro; ramo recurso comparava o subperiodo) DEIXA DE
-- EXISTIR - vira uma regra so, o intervalo COMPROMETIDO.
--
-- ── POR QUE **NAO** HA SNAPSHOT DE CAPACIDADE (o outro furo) ──────────────────────────────────────
-- Um `commitment_is_exclusive` so poderia sair de `actor_asset_rental_terms.quantity`, que e
-- MUTAVEL por HTTP vivo (PUT /rentable-resources/:id -> routes:79/546 -> service:781-787 ->
-- repository:406 `quantity = COALESCE($5::int, quantity)`), e o app le a capacidade AO VIVO no
-- confirm (repository.ts:502) - nunca de snapshot. Gravar snapshot criaria uma segunda semantica
-- que hoje nao existe em lugar nenhum. Resolvido REMOVENDO A NECESSIDADE:
--   `commitment_resource_id` so e preenchido quando a exclusividade e ESTRUTURAL, nunca por termo
--   mutavel. Onde ela e estrutural:
--     · service_offering -> provider_actor_id  (0146 §A.3/V1: o provider E o recurso; a query de
--       conflito nem tem nocao de capacidade - e LIMIT 1)
--     · user             -> o proprio actor    (0196 §D.1: um corpo, uma agenda)
--     · actor_asset com resource_type <> 'equipment' -> o asset. Aqui a exclusividade e provada por
--       CHECK VIVO (`chk_aart_quantity_single_unless_equipment`: nao-equipment => quantity=1) sobre
--       coluna que NENHUM writer atualiza (resource_type aparece em INSERT e em SELECT; em nenhum
--       `UPDATE ... SET` - conferido em rentable-resource.repository.ts).
--     · actor_asset com resource_type = 'equipment' -> NULL. Fungivel (quantity ate 10) nao cabe em
--       EXCLUDE, que nao sabe CONTAR. Fica com o advisory lock e vira divida NOMEADA:
--       DT-FUNGIBLE-CAPACITY-HAS-NO-DB-GUARANTEE.
--
-- ── O VENENO DO INTERVALO NULO (medido em banco descartavel, probe P8) ────────────────────────────
--   SELECT tstzrange(NULL::timestamptz, NULL::timestamptz, '[)');  -- (,)  e NAO e NULL
-- `tstzrange(NULL,NULL,'[)')` e o range ILIMITADO: sobrepoe TUDO. Uma unica linha bloqueante com
-- intervalo nulo travaria o recurso INTEIRO, para sempre, em qualquer data - a trava nova negando
-- quem PODE. Por isso o CHECK abaixo torna a combinacao IMPOSSIVEL (fail-closed, grita), em vez de
-- excluir a linha do predicado (que calaria). Linhas afetadas hoje: 0 (medido).
--
-- ── ALCANCE DECLARADO ────────────────────────────────────────────────────────────────────────────
-- Janelas confirmaveis por ramo: service_offering 58 · actor_asset/vehicle 1 · actor_asset/
-- equipment 3 · user 0 (ramo vivo) · page 8 (nao confirmavel - 501 correto por R1). A EXCLUDE
-- alcanca 59 das 62 confirmaveis; as 3 de equipment ficam na divida nomeada acima.
-- Linhas bloqueantes hoje: 1 (actor_asset/equipment, com booked_* preenchidos) -> backfill = 0.

BEGIN;

-- btree_gist e obrigatorio para combinar igualdade (uuid) com sobreposicao (range) na MESMA EXCLUDE.
-- Ja instalado em unificard_dev (1.7); explicito aqui para o banco EFEMERO e para qualquer ambiente novo.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- (1) O RECURSO QUE O COMPROMISSO OCUPA. Anulavel de proposito: NULL = "esta linha nao tem trava de
-- banco" (fungivel, ou nao-bloqueante). Preenchido pelo confirm canonico, derivado server-side pela
-- MESMA cadeia que o app ja usa (resolveAvailabilityOwner / availability.owner_id) - nunca do body.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commitment_resource_id uuid;

COMMENT ON COLUMN bookings.commitment_resource_id IS
  'DECISION-0146 §A.7 (metade prescrita) · 2026-08-06. O RECURSO que este COMPROMISSO ocupa, derivado '
  'server-side no confirm: service_offering->provider_actor_id · user->o proprio actor · actor_asset '
  'nao-equipment->o asset. NULL = sem trava de banco (equipment fungivel, ou booking nao-bloqueante) — '
  'ver DT-FUNGIBLE-CAPACITY-HAS-NO-DB-GUARANTEE. NAO e snapshot de termo mutavel: so recebe valor onde '
  'a exclusividade e ESTRUTURAL.';

-- (2) FAIL-CLOSED CONTRA O RANGE ILIMITADO. Compromisso sem intervalo materializado nao pode existir:
-- tstzrange(NULL,NULL,'[)') = (,) sobrepoe tudo e travaria o recurso inteiro.
ALTER TABLE bookings
  ADD CONSTRAINT chk_bookings_blocking_requires_interval
  CHECK (
    status NOT IN ('confirmed','checked_in','checked_out')
    OR (booked_start_datetime IS NOT NULL AND booked_end_datetime IS NOT NULL)
  );

COMMENT ON CONSTRAINT chk_bookings_blocking_requires_interval ON bookings IS
  'Compromisso (status bloqueante) OBRIGA intervalo materializado. Sem isto, tstzrange(NULL,NULL) = (,) '
  'e ilimitado e a EXCLUDE abaixo bloquearia o recurso em TODA data (negar quem pode). Grita em vez de calar.';

-- (3) A CONSTRAINT FORTE, NA CAMADA PRESCRITA. Intervalo meio-aberto [start,end): back-to-back
-- (fim == inicio) NAO conflita (0146 G8). Parcial pelo conjunto bloqueante VIVO do schema
-- (chk_bookings_status), nunca por lista inventada (0146 §A.4).
ALTER TABLE bookings
  ADD CONSTRAINT bookings_commitment_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    commitment_resource_id WITH =,
    tstzrange(booked_start_datetime, booked_end_datetime, '[)') WITH &&
  )
  WHERE (
    commitment_resource_id IS NOT NULL
    AND status IN ('confirmed','checked_in','checked_out')
  );

COMMENT ON CONSTRAINT bookings_commitment_no_overlap ON bookings IS
  'DECISION-0146 §A.7/§A.2/§A.8 + G8 · a trava forte do COMPROMISSO. Dois bookings em status bloqueante '
  'do MESMO recurso, no MESMO tenant, com intervalos [start,end) sobrepostos, sao impossiveis - para '
  'QUALQUER escritor, inclusive psql/script/worker que nao passe pelo service. NAO substitui o advisory '
  'lock: o lock cobre TAMBEM o equipment fungivel por contagem (count >= quantity), que EXCLUDE nao sabe '
  'expressar. Remover o lock achando que "agora o banco garante" quebra os 3 ativos fungiveis EM SILENCIO.';

COMMIT;

-- test-neighborhood-alias-first-db.sql
-- F-NEIGHBORHOOD-CANONICAL-AUTO-INGESTION · N1 — PROVA INTEGRAL EM ROLLBACK do fluxo governado de aliases.
-- Assume a migration 20260713140000 aplicada. TUDO roda dentro de BEGIN ... ROLLBACK: ZERO persistência
-- (nenhum manifest_approved/execution/alias/token/evento sobrevive). Usa o GRANT REAL selado
-- (territory:manage_neighborhood_aliases → Actor 213f4903 → Curitiba) + bairros reais, com textos de alias
-- CLARAMENTE de teste e não-redundantes. NÃO é seed, NÃO é aprovação humana — é prova de máquina.
--
-- Fatos provados: approval (capability em DB) → execution (job) → writer cria alias → evento alias_created →
-- token consumido; replay idempotente; conflito (city, normalized)→bairro diferente aborta; redundância com
-- name_normalized rejeitada; HOLD (INSERT direto/UPDATE/DELETE) bloqueado; casas append-only; denial sem approval.

\set ON_ERROR_STOP on
\set GRANTEE  '213f4903-d0c3-4c03-aa2f-328e11aac807'
\set USERID   '9305ac13-00b2-4ef2-989f-05c04259f18a'
\set CITY     '9d431002-1fd3-4b34-ae82-678f28f64288'
\set CENTRO   '8855814b-13ba-4984-b8ff-0127b2483315'
\set BATEL    'ff833536-cfb7-4d45-8fbf-2c34576cf6ad'

BEGIN;

CREATE TEMP TABLE _ctx (k text PRIMARY KEY, v uuid) ON COMMIT DROP;

-- ── P1: approval (manifest_approved) via casa governada — capability em DB, Curitiba, grant travado ──
DO $$
DECLARE v_event UUID; v_hash TEXT := encode(sha256('CURITIBA_ALIAS_TEST:v-test'::bytea),'hex');
BEGIN
  v_event := public.fn_register_alias_manifest_approval(
    '213f4903-d0c3-4c03-aa2f-328e11aac807'::uuid, '9305ac13-00b2-4ef2-989f-05c04259f18a'::uuid,
    '9d431002-1fd3-4b34-ae82-678f28f64288'::uuid, 'CURITIBA_ALIAS_TEST', 'v-test', v_hash, 1,
    'prova N1: registro de manifest_approved', 'prova de máquina — rollback');
  INSERT INTO _ctx VALUES ('approval', v_event);
  IF (SELECT count(*) FROM public.neighborhood_alias_manifest_events WHERE event_id=v_event AND event_type='manifest_approved')<>1 THEN
    RAISE EXCEPTION 'P1 FAIL: manifest_approved não registrado';
  END IF;
  RAISE NOTICE 'P1 OK: manifest_approved %', v_event;
END $$;

-- ── P2: execution técnica (job) via casa governada ──
DO $$
DECLARE v_exec UUID; v_ev UUID;
BEGIN
  SELECT v INTO v_ev FROM _ctx WHERE k='approval';
  v_exec := public.fn_register_alias_automation_execution(v_ev,'test-alias-apply-job','run-test-1','alias-apply','commit-test', now(), 1, 0);
  INSERT INTO _ctx VALUES ('exec', v_exec);
  IF (SELECT executor_kind FROM public.neighborhood_alias_automation_executions WHERE automation_execution_id=v_exec)<>'job' THEN
    RAISE EXCEPTION 'P2 FAIL: execução não é job';
  END IF;
  RAISE NOTICE 'P2 OK: execution %', v_exec;
END $$;

-- ── P3: writer cria alias (bairro real, texto de teste não-redundante) → outcome 'created' ──
DO $$
DECLARE v_ev UUID; v_ex UUID; r RECORD;
BEGIN
  SELECT v INTO v_ev FROM _ctx WHERE k='approval';
  SELECT v INTO v_ex FROM _ctx WHERE k='exec';
  SELECT * INTO r FROM public.fn_create_canonical_alias(v_ev, v_ex,
    '8855814b-13ba-4984-b8ff-0127b2483315'::uuid, 'Centro Historico Prova N1',
    'internal_curation','prova-ref','prova-evidence','line-1');
  IF r.outcome <> 'created' THEN RAISE EXCEPTION 'P3 FAIL: outcome=%', r.outcome; END IF;
  INSERT INTO _ctx VALUES ('alias', r.alias_id);
  RAISE NOTICE 'P3 OK: alias criado %', r.alias_id;
END $$;

-- ── P4: alias + evento + token consumido ──
DO $$
DECLARE v_alias UUID;
BEGIN
  SELECT v INTO v_alias FROM _ctx WHERE k='alias';
  IF (SELECT count(*) FROM public.neighborhood_aliases WHERE id=v_alias)<>1 THEN RAISE EXCEPTION 'P4 FAIL: alias ausente'; END IF;
  IF (SELECT count(*) FROM public.neighborhood_alias_curation_events WHERE alias_id=v_alias AND operation='alias_created')<>1 THEN RAISE EXCEPTION 'P4 FAIL: evento alias_created ausente'; END IF;
  IF (SELECT count(*) FROM public.neighborhood_alias_writer_authorizations)<>0 THEN RAISE EXCEPTION 'P4 FAIL: token não consumido'; END IF;
  RAISE NOTICE 'P4 OK: alias+evento+token-consumido';
END $$;

-- ── P5: replay idempotente (mesma linha) → 'replayed', sem novo alias ──
DO $$
DECLARE v_ev UUID; v_ex UUID; r RECORD;
BEGIN
  SELECT v INTO v_ev FROM _ctx WHERE k='approval';
  SELECT v INTO v_ex FROM _ctx WHERE k='exec';
  SELECT * INTO r FROM public.fn_create_canonical_alias(v_ev, v_ex,
    '8855814b-13ba-4984-b8ff-0127b2483315'::uuid, 'Centro Historico Prova N1',
    'internal_curation','prova-ref','prova-evidence','line-1');
  IF r.outcome <> 'replayed' THEN RAISE EXCEPTION 'P5 FAIL: esperado replayed, veio %', r.outcome; END IF;
  IF (SELECT count(*) FROM public.neighborhood_aliases)<>1 THEN RAISE EXCEPTION 'P5 FAIL: replay criou alias'; END IF;
  RAISE NOTICE 'P5 OK: replay idempotente';
END $$;

-- ── P6: conflito (mesma forma normalizada em outro bairro da cidade) aborta ──
DO $$
DECLARE v_ev UUID; v_ex UUID; ok BOOLEAN := false;
BEGIN
  SELECT v INTO v_ev FROM _ctx WHERE k='approval';
  SELECT v INTO v_ex FROM _ctx WHERE k='exec';
  BEGIN
    PERFORM public.fn_create_canonical_alias(v_ev, v_ex,
      'ff833536-cfb7-4d45-8fbf-2c34576cf6ad'::uuid, 'Centro Historico Prova N1',
      'internal_curation','prova-ref','prova-evidence','line-2');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~ 'ALIAS_CITY_NORMALIZED_CONFLICT' THEN ok := true; ELSE RAISE EXCEPTION 'P6 FAIL: erro inesperado %', SQLERRM; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'P6 FAIL: conflito não abortou'; END IF;
  RAISE NOTICE 'P6 OK: conflito (city, normalized) abortou';
END $$;

-- ── P7: redundância com name_normalized rejeitada ──
DO $$
DECLARE v_ev UUID; v_ex UUID; ok BOOLEAN := false;
BEGIN
  SELECT v INTO v_ev FROM _ctx WHERE k='approval';
  SELECT v INTO v_ex FROM _ctx WHERE k='exec';
  BEGIN
    PERFORM public.fn_create_canonical_alias(v_ev, v_ex,
      '8855814b-13ba-4984-b8ff-0127b2483315'::uuid, 'Centro',
      'internal_curation','prova-ref','prova-evidence','line-3');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~ 'ALIAS_REDUNDANT_WITH_CANONICAL' THEN ok := true; ELSE RAISE EXCEPTION 'P7 FAIL: erro inesperado %', SQLERRM; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'P7 FAIL: redundância não rejeitada'; END IF;
  RAISE NOTICE 'P7 OK: alias redundante com canônico rejeitado';
END $$;

-- ── P8: HOLD — INSERT direto em neighborhood_aliases bloqueado (sem token) ──
DO $$
DECLARE ok BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.neighborhood_aliases (neighborhood_id, alias, source_kind, source_reference, evidence,
      created_by_actor_id, approved_by_actor_id, approved_at, is_active, valid_from_at)
    VALUES ('8855814b-13ba-4984-b8ff-0127b2483315'::uuid,'Direto Proibido','internal_curation','r','e',
      '213f4903-d0c3-4c03-aa2f-328e11aac807'::uuid,'213f4903-d0c3-4c03-aa2f-328e11aac807'::uuid, now(), true, now());
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~ 'WRITER_HOLD' THEN ok := true; ELSE RAISE EXCEPTION 'P8 FAIL: erro inesperado %', SQLERRM; END IF;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'P8 FAIL: INSERT direto não bloqueado'; END IF;
  RAISE NOTICE 'P8 OK: INSERT direto bloqueado pelo HOLD';
END $$;

-- ── P9: UPDATE/DELETE em neighborhood_aliases bloqueados ──
DO $$
DECLARE ok1 BOOLEAN := false; ok2 BOOLEAN := false;
BEGIN
  BEGIN UPDATE public.neighborhood_aliases SET evidence='x' WHERE true;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'WRITER_HOLD|IMMUTABLE' THEN ok1:=true; ELSE RAISE EXCEPTION 'P9 FAIL upd %', SQLERRM; END IF; END;
  BEGIN DELETE FROM public.neighborhood_aliases WHERE true;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'WRITER_HOLD|DELETE_FORBIDDEN' THEN ok2:=true; ELSE RAISE EXCEPTION 'P9 FAIL del %', SQLERRM; END IF; END;
  IF NOT (ok1 AND ok2) THEN RAISE EXCEPTION 'P9 FAIL: UPDATE/DELETE não bloqueados (upd=% del=%)', ok1, ok2; END IF;
  RAISE NOTICE 'P9 OK: UPDATE/DELETE de alias bloqueados';
END $$;

-- ── P10: casas de governança append-only (UPDATE/DELETE bloqueados) ──
DO $$
DECLARE ok BOOLEAN := false;
BEGIN
  BEGIN UPDATE public.neighborhood_alias_manifest_events SET event_reason='x' WHERE true;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'APPEND_ONLY' THEN ok:=true; ELSE RAISE EXCEPTION 'P10 FAIL %', SQLERRM; END IF; END;
  IF NOT ok THEN RAISE EXCEPTION 'P10 FAIL: manifest_events não append-only'; END IF;
  ok := false;
  BEGIN DELETE FROM public.neighborhood_alias_curation_events WHERE true;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'APPEND_ONLY' THEN ok:=true; ELSE RAISE EXCEPTION 'P10 FAIL %', SQLERRM; END IF; END;
  IF NOT ok THEN RAISE EXCEPTION 'P10 FAIL: curation_events não append-only'; END IF;
  RAISE NOTICE 'P10 OK: casas append-only';
END $$;

-- ── P11: writer sem approval válido → denial uniforme ──
DO $$
DECLARE ok BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.fn_create_canonical_alias(gen_random_uuid(), gen_random_uuid(),
      '8855814b-13ba-4984-b8ff-0127b2483315'::uuid,'Sem Approval','internal_curation','r','e','line-x');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN ok:=true; ELSE RAISE EXCEPTION 'P11 FAIL %', SQLERRM; END IF; END;
  IF NOT ok THEN RAISE EXCEPTION 'P11 FAIL: writer sem approval não negou'; END IF;
  RAISE NOTICE 'P11 OK: denial sem approval';
END $$;

-- ── P12: empty manifest approval rejeitado (line_count<1) ──
DO $$
DECLARE ok BOOLEAN := false; v_hash TEXT := encode(sha256('x'::bytea),'hex');
BEGIN
  BEGIN
    PERFORM public.fn_register_alias_manifest_approval('213f4903-d0c3-4c03-aa2f-328e11aac807'::uuid,
      '9305ac13-00b2-4ef2-989f-05c04259f18a'::uuid,'9d431002-1fd3-4b34-ae82-678f28f64288'::uuid,
      'EMPTY','v0',v_hash,0,'r','e');
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'ALIAS_MANIFEST_EMPTY' THEN ok:=true; ELSE RAISE EXCEPTION 'P12 FAIL %', SQLERRM; END IF; END;
  IF NOT ok THEN RAISE EXCEPTION 'P12 FAIL: manifest vazio aceito'; END IF;
  RAISE NOTICE 'P12 OK: manifest vazio rejeitado';
END $$;

-- ── ESTADO FINAL DENTRO DA TX (antes do rollback): exatamente 1 alias de teste, 1 evento, 1 approval, 1 exec ──
DO $$
BEGIN
  IF (SELECT count(*) FROM public.neighborhood_aliases)<>1 THEN RAISE EXCEPTION 'FINAL FAIL: aliases<>1'; END IF;
  IF (SELECT count(*) FROM public.neighborhood_alias_curation_events)<>1 THEN RAISE EXCEPTION 'FINAL FAIL: eventos<>1'; END IF;
  IF (SELECT count(*) FROM public.neighborhood_alias_manifest_events WHERE event_type='manifest_approved')<>1 THEN RAISE EXCEPTION 'FINAL FAIL: approvals<>1'; END IF;
  IF (SELECT count(*) FROM public.neighborhood_alias_automation_executions)<>1 THEN RAISE EXCEPTION 'FINAL FAIL: execs<>1'; END IF;
  IF (SELECT count(*) FROM public.neighborhood_alias_writer_authorizations)<>0 THEN RAISE EXCEPTION 'FINAL FAIL: tokens<>0'; END IF;
  RAISE NOTICE 'FINAL OK (dentro da tx): 1 alias, 1 evento, 1 approval, 1 exec, 0 token — tudo será revertido';
END $$;

ROLLBACK;

-- Pós-rollback: as tabelas de aliases voltam a VAZIO (nada persistiu).
SELECT 'POST_ROLLBACK' AS marker,
       (SELECT count(*) FROM public.neighborhood_aliases) AS aliases;

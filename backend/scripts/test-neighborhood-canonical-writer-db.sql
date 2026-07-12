-- N2-E — provas DB do writer canônico. Transacional; ROLLBACK; ZERO resíduo. ON_ERROR_STOP=0.
\set actor  '213f4903-d0c3-4c03-aa2f-328e11aac807'
\set actorB '1f63bfdb-f8a1-4ce0-9632-0f7836732a4f'
\set usr    '9305ac13-00b2-4ef2-989f-05c04259f18a'
\set tenant 'a3859c3e-eca7-4e7d-9df4-324829b368ce'
\set cityA  '029b307f-9cb6-43cb-8d99-11823b9dc001'
\set cityB  '058705b4-7d87-4cdd-aa8e-0bc15fa29fa4'

BEGIN;

-- helper de fixture: grant territorial ativo
CREATE OR REPLACE FUNCTION pg_temp.mkgrant(p_actor uuid, p_key text, p_city uuid, p_status text DEFAULT 'active', p_vu timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_status = 'revoked' THEN
    INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status,valid_until,revoked_at,revoked_by_actor_id,revoke_reason)
    VALUES (p_actor,p_key,'territory',p_city,p_actor,p_actor,'grant','revoked',p_vu,now(),p_actor,'teste');
  ELSE
    INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status,valid_until)
    VALUES (p_actor,p_key,'territory',p_city,p_actor,p_actor,'grant',p_status,p_vu);
  END IF;
END $$;

-- ── T01-T06 · caminho válido ──
SAVEPOINT s_ok;
SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA');
SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');
DO $$ DECLARE v_nb uuid; v_ev int; v_g int; v_cb uuid; v_ab uuid; BEGIN
  v_nb := public.fn_create_canonical_neighborhood('a3859c3e-eca7-4e7d-9df4-324829b368ce','9305ac13-00b2-4ef2-989f-05c04259f18a','213f4903-d0c3-4c03-aa2f-328e11aac807','029b307f-9cb6-43cb-8d99-11823b9dc001','Centro Histórico','internal_curation','curadoria interna doc','evidencia textual','criação inicial');
  IF v_nb IS NULL THEN RAISE WARNING 'T01/T02 FAIL: retorno nulo'; ELSE RAISE NOTICE 'T02 OK retorna neighborhood_id=%', v_nb; END IF;
  SELECT count(*) INTO v_ev FROM neighborhoods WHERE neighborhood_id=v_nb; IF v_ev=1 THEN RAISE NOTICE 'T01 OK exatamente 1 bairro'; ELSE RAISE WARNING 'T01 FAIL % bairros', v_ev; END IF;
  SELECT created_by_actor_id, approved_by_actor_id INTO v_cb, v_ab FROM neighborhoods WHERE neighborhood_id=v_nb;
  IF v_cb='213f4903-d0c3-4c03-aa2f-328e11aac807' AND v_ab='213f4903-d0c3-4c03-aa2f-328e11aac807' THEN RAISE NOTICE 'T03 OK created_by/approved_by=grantee'; ELSE RAISE WARNING 'T03 FAIL cb=% ab=%',v_cb,v_ab; END IF;
  SELECT count(*) INTO v_ev FROM neighborhood_curation_events WHERE neighborhood_id=v_nb; IF v_ev=2 THEN RAISE NOTICE 'T04 OK 2 eventos'; ELSE RAISE WARNING 'T04 FAIL % eventos', v_ev; END IF;
  SELECT count(DISTINCT grant_id) INTO v_g FROM neighborhood_curation_events WHERE neighborhood_id=v_nb; IF v_g=2 THEN RAISE NOTICE 'T05 OK 2 grant_ids distintos'; ELSE RAISE WARNING 'T05 FAIL % grant_ids', v_g; END IF;
  -- T06: cinco elos coerentes (created↔create key; approved↔approve key; represented=executed=responsible=grantee; user=auth)
  PERFORM 1 FROM neighborhood_curation_events WHERE neighborhood_id=v_nb AND operation='created' AND capability_key='territory:create_neighborhood'
    AND represented_actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807' AND executed_by_actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807'
    AND responsible_human_actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807' AND executed_by_user_id='9305ac13-00b2-4ef2-989f-05c04259f18a';
  IF FOUND THEN RAISE NOTICE 'T06 OK cinco elos coerentes'; ELSE RAISE WARNING 'T06 FAIL elos'; END IF;
END $$;
ROLLBACK TO s_ok;

-- helper denial
CREATE OR REPLACE FUNCTION pg_temp.expect_denied(p_actor uuid, p_user uuid, p_tenant uuid, p_city uuid, p_name text, p_label text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  BEGIN PERFORM public.fn_create_canonical_neighborhood(p_tenant,p_user,p_actor,p_city,p_name,'internal_curation','ref','ev','motivo');
    RAISE WARNING '% FAIL: deveria negar', p_label;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE '% OK deny uniforme', p_label;
    ELSE RAISE WARNING '% FAIL não-uniforme: %', p_label, SQLERRM; END IF; END; END $$;

-- ── T07-T10 · denials de ownership (sem grants ou actor errado) ──
SELECT pg_temp.expect_denied(gen_random_uuid(),:'usr',:'tenant',:'cityA','X','T07 actor inexistente');
SELECT pg_temp.expect_denied(:'actor',:'usr','00000000-0000-0000-0000-0000000000aa',:'cityA','X','T08 outro tenant');
SELECT pg_temp.expect_denied(:'actorB',:'usr',:'tenant',:'cityA','X','T09 actor nao-user');
SELECT pg_temp.expect_denied(:'actor','00000000-0000-0000-0000-0000000000bb',:'tenant',:'cityA','X','T10 user nao-dono');

-- ── T11 · sem create grant (só approve) → denial ──
SAVEPOINT s11; SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');
SELECT pg_temp.expect_denied(:'actor',:'usr',:'tenant',:'cityA','X','T11 sem create grant'); ROLLBACK TO s11;
-- ── T12 · sem approve grant (só create) → denial ──
SAVEPOINT s12; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA');
SELECT pg_temp.expect_denied(:'actor',:'usr',:'tenant',:'cityA','X','T12 sem approve grant'); ROLLBACK TO s12;
-- ── T13 · create revoked → denial ──
SAVEPOINT s13; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA','revoked'); SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');
SELECT pg_temp.expect_denied(:'actor',:'usr',:'tenant',:'cityA','X','T13 create revoked'); ROLLBACK TO s13;
-- ── T14 · approve revoked → denial ──
SAVEPOINT s14; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA'); SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA','revoked');
SELECT pg_temp.expect_denied(:'actor',:'usr',:'tenant',:'cityA','X','T14 approve revoked'); ROLLBACK TO s14;
-- ── T15/T16 · expired (valid_until vencido, status active) → denial ──
SAVEPOINT s15; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA','active', now()-interval '1h'); SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');
SELECT pg_temp.expect_denied(:'actor',:'usr',:'tenant',:'cityA','X','T15 create expired'); ROLLBACK TO s15;
SAVEPOINT s16; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA'); SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA','active', now()-interval '1h');
SELECT pg_temp.expect_denied(:'actor',:'usr',:'tenant',:'cityA','X','T16 approve expired'); ROLLBACK TO s16;
-- ── T17 · city errada (grants em cityA; cria em cityB) → denial ──
SAVEPOINT s17; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA'); SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');
SELECT pg_temp.expect_denied(:'actor',:'usr',:'tenant',:'cityB','X','T17 city errada'); ROLLBACK TO s17;

-- ── T18-T23 · validation (com grants válidos p/ chegar na validação) ──
CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_city uuid, p_name text, p_sk text, p_pat text, p_label text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  BEGIN PERFORM public.fn_create_canonical_neighborhood('a3859c3e-eca7-4e7d-9df4-324829b368ce','9305ac13-00b2-4ef2-989f-05c04259f18a','213f4903-d0c3-4c03-aa2f-328e11aac807',p_city,p_name,p_sk,'ref','ev','motivo');
    RAISE WARNING '% FAIL: deveria falhar', p_label;
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ p_pat THEN RAISE NOTICE '% OK (match %)', p_label, p_pat; ELSE RAISE WARNING '% FAIL erro inesperado: %', p_label, SQLERRM; END IF; END; END $$;
SAVEPOINT s_val; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA'); SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');
SELECT pg_temp.expect_error(:'cityA','','internal_curation','NEIGHBORHOOD_NAME_INVALID','T18 nome vazio');
SELECT pg_temp.expect_error(:'cityA','   ','internal_curation','NEIGHBORHOOD_NAME_INVALID','T19 só whitespace');
SELECT pg_temp.expect_error(:'cityA',' Centro','internal_curation','NEIGHBORHOOD_NAME_INVALID','T20 whitespace inicial');
SELECT pg_temp.expect_error(:'cityA','Centro ','internal_curation','NEIGHBORHOOD_NAME_INVALID','T21 whitespace final');
SELECT pg_temp.expect_error(:'cityA','Vila Nova','tipo_invalido','chk_neighborhoods_source_kind','T23 source_kind invalido');
-- T22 espaço interno legítimo → sucesso
DO $$ DECLARE v uuid; BEGIN v := public.fn_create_canonical_neighborhood('a3859c3e-eca7-4e7d-9df4-324829b368ce','9305ac13-00b2-4ef2-989f-05c04259f18a','213f4903-d0c3-4c03-aa2f-328e11aac807','029b307f-9cb6-43cb-8d99-11823b9dc001','Jardim das Flores','internal_curation','ref','ev','motivo');
  IF v IS NOT NULL THEN RAISE NOTICE 'T22 OK espaço interno aceito'; ELSE RAISE WARNING 'T22 FAIL'; END IF; END $$;
ROLLBACK TO s_val;
-- ── T24 · conflito (mesmo nome normalizado, mesma cidade) → unique_violation ──
SAVEPOINT s24; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA'); SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');
DO $$ BEGIN PERFORM public.fn_create_canonical_neighborhood('a3859c3e-eca7-4e7d-9df4-324829b368ce','9305ac13-00b2-4ef2-989f-05c04259f18a','213f4903-d0c3-4c03-aa2f-328e11aac807','029b307f-9cb6-43cb-8d99-11823b9dc001','Centro','internal_curation','ref','ev','m'); END $$;
DO $$ BEGIN
  BEGIN PERFORM public.fn_create_canonical_neighborhood('a3859c3e-eca7-4e7d-9df4-324829b368ce','9305ac13-00b2-4ef2-989f-05c04259f18a','213f4903-d0c3-4c03-aa2f-328e11aac807','029b307f-9cb6-43cb-8d99-11823b9dc001','CENTRO','internal_curation','ref','ev','m');
    RAISE WARNING 'T24 FAIL: conflito deveria falhar';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'T24 OK conflito (unique_violation)'; WHEN OTHERS THEN RAISE WARNING 'T24 FAIL: % ', SQLERRM; END; END $$;
ROLLBACK TO s24;

-- ── T25-T27 · HOLD: INSERT direto sem token / UPDATE / DELETE bloqueados ──
DO $$ BEGIN BEGIN INSERT INTO neighborhoods (city_id,name,source_kind,source_reference,evidence,created_by_actor_id,approved_by_actor_id,approved_at,valid_from_at)
  VALUES ('029b307f-9cb6-43cb-8d99-11823b9dc001','X','internal_curation','r','e','213f4903-d0c3-4c03-aa2f-328e11aac807','213f4903-d0c3-4c03-aa2f-328e11aac807',now(),now());
  RAISE WARNING 'T25 FAIL: INSERT sem token passou';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'NEIGHBORHOOD_CANONICAL_WRITER_HOLD' THEN RAISE NOTICE 'T25 OK INSERT sem token bloqueado'; ELSE RAISE WARNING 'T25 FAIL %', SQLERRM; END IF; END; END $$;
DO $$ BEGIN BEGIN UPDATE neighborhoods SET name='y' WHERE false; RAISE WARNING 'T26 FAIL: UPDATE passou';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'NEIGHBORHOOD_CANONICAL_WRITER_HOLD' THEN RAISE NOTICE 'T26 OK UPDATE bloqueado'; ELSE RAISE WARNING 'T26 FAIL %', SQLERRM; END IF; END; END $$;
DO $$ BEGIN BEGIN DELETE FROM neighborhoods WHERE false; RAISE WARNING 'T27 FAIL: DELETE passou';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'NEIGHBORHOOD_CANONICAL_WRITER_HOLD' THEN RAISE NOTICE 'T27 OK DELETE bloqueado'; ELSE RAISE WARNING 'T27 FAIL %', SQLERRM; END IF; END; END $$;

-- ── T28-T29 · aliases/succession seguem em HOLD ──
DO $$ BEGIN BEGIN INSERT INTO neighborhood_aliases (neighborhood_id, alias) VALUES (gen_random_uuid(),'a');
  RAISE WARNING 'T28 FAIL: alias insert passou'; EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'HOLD|writer' THEN RAISE NOTICE 'T28 OK alias em HOLD'; ELSE RAISE WARNING 'T28 FAIL barrado por outro motivo: %', left(SQLERRM,50); END IF; END; END $$;
DO $$ BEGIN BEGIN INSERT INTO neighborhood_succession_events (city_id, succession_type) VALUES ('029b307f-9cb6-43cb-8d99-11823b9dc001','split');
  RAISE WARNING 'T29 FAIL: succession insert passou'; EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'HOLD|writer' THEN RAISE NOTICE 'T29 OK succession em HOLD'; ELSE RAISE WARNING 'T29 FAIL barrado por outro motivo: %', left(SQLERRM,50); END IF; END; END $$;

-- ── T30-T32 · ACL / assinatura ──
DO $$ BEGIN IF has_function_privilege('public','public.fn_create_canonical_neighborhood(uuid,uuid,uuid,uuid,text,text,text,text,text)','EXECUTE') THEN RAISE WARNING 'T31 FAIL PUBLIC EXECUTE'; ELSE RAISE NOTICE 'T31 OK PUBLIC sem EXECUTE'; END IF; END $$;
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM pg_proc WHERE proname='fn_create_canonical_neighborhood'; IF n=1 THEN RAISE NOTICE 'T32 OK 1 assinatura'; ELSE RAISE WARNING 'T32 FAIL % assinaturas', n; END IF; END $$;
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM information_schema.role_table_grants WHERE table_name='neighborhood_writer_authorizations' AND grantee='unificard_app'; IF n=0 THEN RAISE NOTICE 'T30 OK app sem acesso a tokens'; ELSE RAISE WARNING 'T30 FAIL app % priv em tokens', n; END IF; END $$;

-- ── T36 · token não consumido → não sobrevive (SET CONSTRAINTS IMMEDIATE força a checagem diferida) ──
SAVEPOINT s36;
DO $$ BEGIN
  INSERT INTO neighborhood_writer_authorizations (xid, backend_pid, operation) VALUES (pg_current_xact_id(), pg_backend_pid(), 'create_neighborhood');
  BEGIN SET CONSTRAINTS ALL IMMEDIATE;
    RAISE WARNING 'T36 FAIL: token não-consumido sobreviveu';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TOKEN_NOT_CONSUMED' THEN RAISE NOTICE 'T36 OK token não-consumido bloqueado no commit'; ELSE RAISE WARNING 'T36 FAIL %', SQLERRM; END IF; END;
END $$;
ROLLBACK TO s36;

-- ── T38-T42 · curation append-only / integridade ──
SAVEPOINT s_ce; SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA'); SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');
DO $$ DECLARE v_nb uuid; BEGIN
  v_nb := public.fn_create_canonical_neighborhood('a3859c3e-eca7-4e7d-9df4-324829b368ce','9305ac13-00b2-4ef2-989f-05c04259f18a','213f4903-d0c3-4c03-aa2f-328e11aac807','029b307f-9cb6-43cb-8d99-11823b9dc001','Bairro Teste','internal_curation','r','e','m');
  BEGIN UPDATE neighborhood_curation_events SET reason='x' WHERE neighborhood_id=v_nb; RAISE WARNING 'T38 FAIL update';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'APPEND_ONLY' THEN RAISE NOTICE 'T38 OK curation UPDATE proibido'; ELSE RAISE WARNING 'T38 %', SQLERRM; END IF; END;
  BEGIN DELETE FROM neighborhood_curation_events WHERE neighborhood_id=v_nb; RAISE WARNING 'T39 FAIL delete';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'APPEND_ONLY' THEN RAISE NOTICE 'T39 OK curation DELETE proibido'; ELSE RAISE WARNING 'T39 %', SQLERRM; END IF; END;
  BEGIN INSERT INTO neighborhood_curation_events (neighborhood_id,city_id,operation,capability_key,grant_id,represented_actor_id,executed_by_user_id,executed_by_actor_id,responsible_human_actor_id,reason,source_kind,source_reference)
    SELECT v_nb, city_id,'created','territory:create_neighborhood',grant_id,represented_actor_id,executed_by_user_id,executed_by_actor_id,responsible_human_actor_id,'x',source_kind,source_reference FROM neighborhood_curation_events WHERE neighborhood_id=v_nb AND operation='created';
    RAISE WARNING 'T41 FAIL segundo created';
    EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'T41 OK segundo created bloqueado'; WHEN OTHERS THEN RAISE WARNING 'T41 %', left(SQLERRM,40); END;
END $$;
ROLLBACK TO s_ce;

ROLLBACK;

-- ── T43 · zero resíduo ──
DO $$ DECLARE n1 int; n2 int; n3 int; BEGIN
  SELECT count(*) INTO n1 FROM neighborhoods; SELECT count(*) INTO n2 FROM neighborhood_curation_events; SELECT count(*) INTO n3 FROM neighborhood_writer_authorizations;
  IF n1=0 AND n2=0 AND n3=0 THEN RAISE NOTICE 'T43 OK zero resíduo (bairros=% eventos=% tokens=%)',n1,n2,n3; ELSE RAISE WARNING 'T43 FAIL resíduo b=% e=% t=%',n1,n2,n3; END IF; END $$;

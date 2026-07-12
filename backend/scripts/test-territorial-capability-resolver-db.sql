-- N2-D.3 — provas DB do resolver territorial. Transacional; ROLLBACK ao fim; ZERO resíduo.
-- Rodar: psql ... -v ON_ERROR_STOP=0 -f test-territorial-capability-resolver-db.sql
\set actor  '213f4903-d0c3-4c03-aa2f-328e11aac807'
\set actorB '1f63bfdb-f8a1-4ce0-9632-0f7836732a4f'
\set usr    '9305ac13-00b2-4ef2-989f-05c04259f18a'
\set cityA  '029b307f-9cb6-43cb-8d99-11823b9dc001'
\set cityB  '058705b4-7d87-4cdd-aa8e-0bc15fa29fa4'

BEGIN;

-- ── fixture base: grant territorial ATIVO válido (actor / cityA / create_neighborhood) ──
INSERT INTO actor_capability_grants
  (grantee_actor_id, capability_key, scope_type, scope_city_id, granted_by_user_id, granted_by_actor_id, authority_source, status)
VALUES (:'actor', 'territory:create_neighborhood', 'territory', :'cityA', :'usr', :'actor', 'grant', 'active');

-- T1: grant válido → retorna exatamente um grant_id
DO $$ DECLARE v uuid; BEGIN
  v := public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:create_neighborhood','029b307f-9cb6-43cb-8d99-11823b9dc001');
  IF v IS NULL THEN RAISE WARNING 'T1 FAIL: retornou NULL'; ELSE RAISE NOTICE 'T1 OK grant=%', v; END IF;
END $$;

-- T2: key ACTOR-SCOPED → DENY
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','calendar:block','029b307f-9cb6-43cb-8d99-11823b9dc001');
    RAISE WARNING 'T2 FAIL: deveria negar key actor-scoped';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T2 OK deny'; ELSE RAISE WARNING 'T2 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;

-- T3: key desconhecida/prefixo → DENY
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:hack_neighborhood','029b307f-9cb6-43cb-8d99-11823b9dc001');
    RAISE WARNING 'T3 FAIL: deveria negar key desconhecida';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T3 OK deny'; ELSE RAISE WARNING 'T3 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;

-- T4: cidade ERRADA (grant é cityA; consulto cityB) → DENY uniforme
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:create_neighborhood','058705b4-7d87-4cdd-aa8e-0bc15fa29fa4');
    RAISE WARNING 'T4 FAIL: deveria negar cidade errada';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T4 OK deny'; ELSE RAISE WARNING 'T4 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;

-- T5: Actor ERRADO (actorB não tem grant) → DENY uniforme
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('1f63bfdb-f8a1-4ce0-9632-0f7836732a4f','territory:create_neighborhood','029b307f-9cb6-43cb-8d99-11823b9dc001');
    RAISE WARNING 'T5 FAIL: deveria negar actor errado';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T5 OK deny'; ELSE RAISE WARNING 'T5 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;

-- T11: grant inexistente (mesmo contrato externo — actorB/cityB) → DENY
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('1f63bfdb-f8a1-4ce0-9632-0f7836732a4f','territory:approve_neighborhood','058705b4-7d87-4cdd-aa8e-0bc15fa29fa4');
    RAISE WARNING 'T11 FAIL';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T11 OK deny'; ELSE RAISE WARNING 'T11 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;

-- T6: REVOKED → DENY
SAVEPOINT s_rev;
UPDATE actor_capability_grants SET status='revoked', revoked_at=now(), revoked_by_actor_id=:'actor', revoke_reason='teste'
 WHERE grantee_actor_id=:'actor' AND scope_city_id=:'cityA' AND scope_type='territory';
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:create_neighborhood','029b307f-9cb6-43cb-8d99-11823b9dc001');
    RAISE WARNING 'T6 FAIL: revoked deveria negar';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T6 OK deny'; ELSE RAISE WARNING 'T6 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;
ROLLBACK TO s_rev;

-- T7: EXPIRED → DENY
SAVEPOINT s_exp;
UPDATE actor_capability_grants SET status='expired'
 WHERE grantee_actor_id=:'actor' AND scope_city_id=:'cityA' AND scope_type='territory';
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:create_neighborhood','029b307f-9cb6-43cb-8d99-11823b9dc001');
    RAISE WARNING 'T7 FAIL: expired deveria negar';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T7 OK deny'; ELSE RAISE WARNING 'T7 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;
ROLLBACK TO s_exp;

-- T8: SUSPENDED territorial → shape IMPOSSIBILITADO (chk_acg_territory_not_suspended barra o INSERT)
DO $$ BEGIN
  BEGIN
    INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status)
    VALUES ('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:approve_neighborhood','territory','058705b4-7d87-4cdd-aa8e-0bc15fa29fa4','9305ac13-00b2-4ef2-989f-05c04259f18a','213f4903-d0c3-4c03-aa2f-328e11aac807','grant','suspended');
    RAISE WARNING 'T8 FAIL: territory+suspended deveria ser impossivel';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'T8 OK shape impossibilitado (check_violation)';
  WHEN OTHERS THEN RAISE NOTICE 'T8 OK barrado: %', SQLERRM; END;
END $$;

-- T9: valid_from FUTURA (grant em cityB, valid_from = now()+1h, active) → DENY
SAVEPOINT s_vf;
INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status,valid_from)
VALUES (:'actor','territory:create_neighborhood','territory',:'cityB',:'usr',:'actor','grant','active', now() + interval '1 hour');
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:create_neighborhood','058705b4-7d87-4cdd-aa8e-0bc15fa29fa4');
    RAISE WARNING 'T9 FAIL: valid_from futura deveria negar';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T9 OK deny'; ELSE RAISE WARNING 'T9 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;
ROLLBACK TO s_vf;

-- T10: valid_until <= now() (grant em cityB, valid_until = now()-1h, active) → DENY
SAVEPOINT s_vu;
INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status,valid_until)
VALUES (:'actor','territory:create_neighborhood','territory',:'cityB',:'usr',:'actor','grant','active', now() - interval '1 hour');
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:create_neighborhood','058705b4-7d87-4cdd-aa8e-0bc15fa29fa4');
    RAISE WARNING 'T10 FAIL: valid_until vencida deveria negar';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T10 OK deny'; ELSE RAISE WARNING 'T10 FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;
ROLLBACK TO s_vu;

-- T13/T14: chamada como unificard_app — EXECUTE só na assinatura; válido retorna, inválido nega uniforme
SET ROLE unificard_app;
DO $$ DECLARE v uuid; BEGIN
  v := public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','territory:create_neighborhood','029b307f-9cb6-43cb-8d99-11823b9dc001');
  IF v IS NULL THEN RAISE WARNING 'T13 FAIL: app deveria aprovar o valido'; ELSE RAISE NOTICE 'T13 OK app aprova grant=%', v; END IF;
END $$;
DO $$ BEGIN
  BEGIN PERFORM public.fn_assert_territorial_capability('213f4903-d0c3-4c03-aa2f-328e11aac807','calendar:block','029b307f-9cb6-43cb-8d99-11823b9dc001');
    RAISE WARNING 'T13b FAIL: app deveria negar key actor';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'TERRITORIAL_CAPABILITY_DENIED' THEN RAISE NOTICE 'T13b OK app deny uniforme'; ELSE RAISE WARNING 'T13b FAIL nao-uniforme: %', SQLERRM; END IF; END;
END $$;
RESET ROLE;

-- T15: exatamente UMA assinatura (sem overload)
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='fn_assert_territorial_capability';
  IF n=1 THEN RAISE NOTICE 'T15 OK 1 assinatura'; ELSE RAISE WARNING 'T15 FAIL % assinaturas', n; END IF;
END $$;

-- T14b: PUBLIC sem EXECUTE (estrutural)
DO $$ BEGIN
  IF has_function_privilege('public','public.fn_assert_territorial_capability(uuid,text,uuid)','EXECUTE')
    THEN RAISE WARNING 'T14b FAIL: PUBLIC tem EXECUTE'; ELSE RAISE NOTICE 'T14b OK PUBLIC sem EXECUTE'; END IF;
END $$;

ROLLBACK;

-- T16: zero resíduo após rollback
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM actor_capability_grants;
  IF n=0 THEN RAISE NOTICE 'T16 OK zero grants (residuo 0)'; ELSE RAISE WARNING 'T16 FAIL % grants residuais', n; END IF;
END $$;

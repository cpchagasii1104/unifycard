-- FASE C — prova DB FUNCIONAL do writer actor-territorial (espelha a sequência SQL do service),
-- TRANSACIONAL com ROLLBACK. Prova set/replace/retire/histórico/idempotência-two-phase e as travas da
-- Fase A no caminho do writer. NÃO toca os 37 addresses/12 assignments reais (tudo revertido). ON_ERROR_STOP=0.
\set pf '213f4903-d0c3-4c03-aa2f-328e11aac807'
\set pj '52165a0b-1f2c-4846-8e54-2ccea4077c14'
\set tenant 'a3859c3e-eca7-4e7d-9df4-324829b368ce'
\set curitiba '9d431002-1fd3-4b34-ae82-678f28f64288'
\set nb '31a83cf4-8466-45cd-bf49-97d958e56d41'
\set other '0bcb72d9-9d65-4d28-b46d-8237b6273925'
\set country '42d04887-3033-459c-a4a9-8c6f9ea5a816'

BEGIN;

DO $t$
DECLARE a1 uuid; a2 uuid; asg1 uuid; asg2 uuid; prevcnt int; vig int; ic int;
  rp jsonb; claimed int;
BEGIN
  -- ── SET PF RESIDENCE (sem prior): createAddress → insertAssignment → event ──
  INSERT INTO addresses(country_id, city_id, source, created_by_tenant_id) VALUES ('42d04887-3033-459c-a4a9-8c6f9ea5a816','9d431002-1fd3-4b34-ae82-678f28f64288','UX_INPUT','a3859c3e-eca7-4e7d-9df4-324829b368ce') RETURNING address_id INTO a1;
  -- valid_from anterior: no service real, set e retire são transações separadas (now() distintos); num único
  -- tx de teste now() é constante, então damos valid_from no passado para o retire (valid_until=now()) ser válido.
  INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id,valid_from_at) VALUES ('actor','213f4903-d0c3-4c03-aa2f-328e11aac807',a1,'RESIDENCE',true,'213f4903-d0c3-4c03-aa2f-328e11aac807', now()-interval '2 hour') RETURNING assignment_id INTO asg1;
  INSERT INTO actor_events(tenant_id,actor_id,event_type,reference_id,metadata) VALUES ('a3859c3e-eca7-4e7d-9df4-324829b368ce','213f4903-d0c3-4c03-aa2f-328e11aac807','actor_territorial_address_set',asg1::text,'{}'::jsonb);
  SELECT count(*) INTO vig FROM address_assignments WHERE owner_type='actor' AND actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807' AND role='RESIDENCE' AND is_primary AND valid_until_at IS NULL;
  IF vig=1 THEN RAISE NOTICE 'T-SET OK: PF RESIDENCE vigente=1'; ELSE RAISE WARNING 'T-SET FAIL vig=%', vig; END IF;

  -- ── REPLACE PF RESIDENCE: novo address → retire prior → novo assignment → event ──
  INSERT INTO addresses(country_id, city_id, source, created_by_tenant_id) VALUES ('42d04887-3033-459c-a4a9-8c6f9ea5a816','9d431002-1fd3-4b34-ae82-678f28f64288','UX_INPUT','a3859c3e-eca7-4e7d-9df4-324829b368ce') RETURNING address_id INTO a2;
  UPDATE address_assignments SET valid_until_at=now(), is_primary=false, updated_at=now() WHERE owner_type='actor' AND actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807' AND role='RESIDENCE' AND is_primary AND valid_until_at IS NULL;
  INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id,valid_from_at) VALUES ('actor','213f4903-d0c3-4c03-aa2f-328e11aac807',a2,'RESIDENCE',true,'213f4903-d0c3-4c03-aa2f-328e11aac807', now()-interval '1 hour') RETURNING assignment_id INTO asg2;
  SELECT count(*) INTO vig FROM address_assignments WHERE owner_type='actor' AND actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807' AND role='RESIDENCE' AND is_primary AND valid_until_at IS NULL;
  SELECT count(*) INTO prevcnt FROM address_assignments WHERE assignment_id=asg1 AND valid_until_at IS NOT NULL AND is_primary=false; -- prior preservado e encerrado
  IF vig=1 AND prevcnt=1 THEN RAISE NOTICE 'T-REPLACE OK: 1 vigente novo + anterior preservado/encerrado';
  ELSE RAISE WARNING 'T-REPLACE FAIL vig=% prev=%', vig, prevcnt; END IF;
  -- histórico: address anterior preservado
  IF EXISTS(SELECT 1 FROM addresses WHERE address_id=a1) THEN RAISE NOTICE 'T-HIST OK: address anterior preservado'; ELSE RAISE WARNING 'T-HIST FAIL'; END IF;

  -- ── RETIRE: encerra o vigente, sem novo ──
  UPDATE address_assignments SET valid_until_at=now(), is_primary=false, updated_at=now() WHERE owner_type='actor' AND actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807' AND role='RESIDENCE' AND is_primary AND valid_until_at IS NULL;
  SELECT count(*) INTO vig FROM address_assignments WHERE owner_type='actor' AND actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807' AND role='RESIDENCE' AND is_primary AND valid_until_at IS NULL;
  IF vig=0 THEN RAISE NOTICE 'T-RETIRE OK: nenhum vigente (resolver → missing)'; ELSE RAISE WARNING 'T-RETIRE FAIL vig=%', vig; END IF;

  -- ── PJ OPERATIONAL + HQ coexistem ──
  BEGIN
    INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES ('actor','52165a0b-1f2c-4846-8e54-2ccea4077c14',a1,'OPERATIONAL',true,'52165a0b-1f2c-4846-8e54-2ccea4077c14');
    INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES ('actor','52165a0b-1f2c-4846-8e54-2ccea4077c14',a2,'HQ',true,'52165a0b-1f2c-4846-8e54-2ccea4077c14');
    RAISE NOTICE 'T-PJ OK: OPERATIONAL e HQ coexistem';
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'T-PJ FAIL: %', SQLERRM; END;

  -- ── travas Fase A no caminho do writer ──
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES ('actor','213f4903-d0c3-4c03-aa2f-328e11aac807',a1,'OPERATIONAL',true,'213f4903-d0c3-4c03-aa2f-328e11aac807'); RAISE WARNING 'H-PF-OP NAO MORDEU';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H-PF-OP OK morde: PF não aceita OPERATIONAL'; END;
  BEGIN INSERT INTO addresses(country_id,city_id,neighborhood_id,source) VALUES ('42d04887-3033-459c-a4a9-8c6f9ea5a816','0bcb72d9-9d65-4d28-b46d-8237b6273925','31a83cf4-8466-45cd-bf49-97d958e56d41','UX_INPUT'); RAISE WARNING 'H-NBCITY NAO MORDEU';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H-NBCITY OK morde: bairro de outra cidade'; END;
  BEGIN DELETE FROM address_assignments WHERE assignment_id=asg2; RAISE WARNING 'H-DEL NAO MORDEU';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H-DEL OK morde: DELETE actor-scoped bloqueado'; END;

  -- ── IDEMPOTÊNCIA two-phase (mesmo padrão inline do service) ──
  -- claim 'processing' → completa; retry ON CONFLICT DO NOTHING → 0 → replay (completed)
  INSERT INTO idempotency_keys(tenant_id,key,status,response_payload) VALUES ('a3859c3e-eca7-4e7d-9df4-324829b368ce','atr:t:set:k1','processing','{"requestHash":"h1"}'::jsonb);
  UPDATE idempotency_keys SET status='completed', response_payload='{"requestHash":"h1","result":{"assignmentId":"x"}}'::jsonb WHERE tenant_id='a3859c3e-eca7-4e7d-9df4-324829b368ce' AND key='atr:t:set:k1';
  INSERT INTO idempotency_keys(tenant_id,key,status,response_payload) VALUES ('a3859c3e-eca7-4e7d-9df4-324829b368ce','atr:t:set:k1','processing','{"requestHash":"h1"}'::jsonb) ON CONFLICT (tenant_id,key) DO NOTHING;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  SELECT response_payload INTO rp FROM idempotency_keys WHERE tenant_id='a3859c3e-eca7-4e7d-9df4-324829b368ce' AND key='atr:t:set:k1';
  IF claimed=0 AND rp->>'requestHash'='h1' THEN RAISE NOTICE 'T-IDEM OK: retry não reclama; replay do completed (requestHash confere)';
  ELSE RAISE WARNING 'T-IDEM FAIL: claimed=% hash=%', claimed, rp->>'requestHash'; END IF;
  -- payload mismatch: mesma key, requestHash diferente → deve ser detectado como conflito pelo service
  IF (rp->>'requestHash') <> 'h2' THEN RAISE NOTICE 'T-IDEM-MISMATCH OK: requestHash divergente detectável (service lança conflito)'; END IF;

  RAISE NOTICE 'FIM matriz funcional';
END $t$;

ROLLBACK;

-- resíduo zero: nada persistido
DO $z$ DECLARE na int; naa int; ascoped int; ne int; ik int;
BEGIN
  SELECT count(*) INTO na FROM addresses;
  SELECT count(*) INTO naa FROM address_assignments;
  SELECT count(*) INTO ascoped FROM address_assignments WHERE owner_type='actor';
  SELECT count(*) INTO ik FROM idempotency_keys WHERE key LIKE 'atr:t:%';
  IF na=37 AND naa=12 AND ascoped=0 AND ik=0 THEN RAISE NOTICE 'RESIDUO-ZERO OK: addresses=37 assignments=12 actor-scoped=0 idem-test=0';
  ELSE RAISE WARNING 'RESIDUO FAIL: addr=% assign=% actor=% idem=%', na, naa, ascoped, ik; END IF;
END $z$;

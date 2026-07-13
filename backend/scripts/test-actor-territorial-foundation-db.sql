-- FASE A — prova DB da fundação actor-territorial (DDL + matriz de constraints), TRANSACIONAL, ROLLBACK.
-- Aplica o DDL da migration (sem BEGIN/COMMIT próprios) e exercita todas as constraints/triggers.
-- NÃO altera os 3 addresses reais nem os assignments legados (tudo revertido). ON_ERROR_STOP=0.
-- Baseline pós-FASE D (limpeza governada de fixtures): addresses=3, assignments=3, actor-scoped=0.
\set pf '213f4903-d0c3-4c03-aa2f-328e11aac807'
\set pj '52165a0b-1f2c-4846-8e54-2ccea4077c14'
\set curitiba '9d431002-1fd3-4b34-ae82-678f28f64288'
\set nb '31a83cf4-8466-45cd-bf49-97d958e56d41'
\set other '0bcb72d9-9d65-4d28-b46d-8237b6273925'
\set country '42d04887-3033-459c-a4a9-8c6f9ea5a816'

BEGIN;

-- ── DDL (idêntico à migration, sem BEGIN/COMMIT) ──
ALTER TABLE public.address_assignments ADD COLUMN actor_id uuid NULL REFERENCES public.actors(id) ON DELETE RESTRICT;
ALTER TABLE public.address_assignments DROP CONSTRAINT address_assignments_owner_type_check;
ALTER TABLE public.address_assignments ADD CONSTRAINT address_assignments_owner_type_check
  CHECK (owner_type = ANY (ARRAY['company','profile','event','ride','group','tenant_hq','service_provider','rentable_resource','actor_asset','actor']));
ALTER TABLE public.address_assignments ADD CONSTRAINT ck_addr_assign_actor_shape
  CHECK ((owner_type='actor' AND actor_id IS NOT NULL AND owner_id=actor_id) OR (owner_type<>'actor' AND actor_id IS NULL));
ALTER TABLE public.address_assignments ADD CONSTRAINT ck_addr_assign_validity_order
  CHECK (valid_until_at IS NULL OR valid_until_at > valid_from_at);
ALTER TABLE public.address_assignments ADD CONSTRAINT ck_addr_assign_actor_role
  CHECK (owner_type<>'actor' OR role = ANY (ARRAY['RESIDENCE','OPERATIONAL','HQ']));
CREATE UNIQUE INDEX uidx_addr_assign_actor_primary ON public.address_assignments (actor_id, role)
  WHERE actor_id IS NOT NULL AND is_primary=true AND valid_until_at IS NULL;
CREATE OR REPLACE FUNCTION public.fn_addr_assign_actor_role_coherence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v_type text; BEGIN
  IF NEW.owner_type='actor' THEN
    SELECT actor_type INTO v_type FROM public.actors WHERE id=NEW.actor_id;
    IF v_type IS NULL THEN RAISE EXCEPTION 'ACTOR_TERRITORIAL_ACTOR_NOT_FOUND'; END IF;
    IF NEW.role='RESIDENCE' AND v_type<>'user' THEN RAISE EXCEPTION 'RESIDENCE_REQUIRES_PF'; END IF;
    IF NEW.role IN ('OPERATIONAL','HQ') AND v_type<>'page' THEN RAISE EXCEPTION 'OPHQ_REQUIRES_PJ'; END IF;
  END IF; RETURN NEW; END $fn$;
CREATE TRIGGER trg_addr_assign_actor_role_coherence BEFORE INSERT OR UPDATE ON public.address_assignments FOR EACH ROW EXECUTE FUNCTION public.fn_addr_assign_actor_role_coherence();
CREATE OR REPLACE FUNCTION public.fn_addr_assign_actor_immutability() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_OP='DELETE' THEN IF OLD.owner_type='actor' THEN RAISE EXCEPTION 'NO_DELETE'; END IF; RETURN OLD; END IF;
  IF OLD.owner_type='actor' OR NEW.owner_type='actor' THEN
    IF NEW.assignment_id<>OLD.assignment_id OR NEW.owner_type<>OLD.owner_type OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
       OR NEW.address_id<>OLD.address_id OR NEW.role<>OLD.role OR NEW.valid_from_at<>OLD.valid_from_at OR NEW.owner_id<>OLD.owner_id
       THEN RAISE EXCEPTION 'IMMUTABLE'; END IF;
    IF OLD.valid_until_at IS NOT NULL AND NEW.valid_until_at IS NULL THEN RAISE EXCEPTION 'NO_REOPEN'; END IF;
    IF OLD.is_primary=false AND NEW.is_primary=true THEN RAISE EXCEPTION 'NO_REPRIMARY'; END IF;
  END IF; RETURN NEW; END $fn$;
CREATE TRIGGER trg_addr_assign_actor_immutability BEFORE UPDATE OR DELETE ON public.address_assignments FOR EACH ROW EXECUTE FUNCTION public.fn_addr_assign_actor_immutability();

-- ── fixtures: um address em Curitiba (sem bairro) e outro Curitiba+bairro ──
CREATE TEMP TABLE t_ids (k text, v uuid) ON COMMIT DROP;
INSERT INTO addresses (country_id, city_id, source) VALUES (:'country', :'curitiba', 'UX_INPUT') RETURNING address_id \gset addr_
INSERT INTO t_ids VALUES ('addr', :'addr_address_id');

DO $t$
DECLARE aid uuid; nrows int; okfail boolean;
BEGIN
  SELECT v INTO aid FROM t_ids WHERE k='addr';

  -- P01 PF user + RESIDENCE → OK
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','213f4903-d0c3-4c03-aa2f-328e11aac807',aid,'RESIDENCE',true,'213f4903-d0c3-4c03-aa2f-328e11aac807'); RAISE NOTICE 'P01 OK: PF RESIDENCE aceito';
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'P01 FAIL: %', SQLERRM; END;
  -- P02 PJ page + OPERATIONAL → OK
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','52165a0b-1f2c-4846-8e54-2ccea4077c14',aid,'OPERATIONAL',true,'52165a0b-1f2c-4846-8e54-2ccea4077c14'); RAISE NOTICE 'P02 OK: PJ OPERATIONAL aceito';
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'P02 FAIL: %', SQLERRM; END;
  -- P03 PJ page + HQ → OK (papel distinto coexiste)
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','52165a0b-1f2c-4846-8e54-2ccea4077c14',aid,'HQ',true,'52165a0b-1f2c-4846-8e54-2ccea4077c14'); RAISE NOTICE 'P03 OK: PJ HQ aceito (coexiste com OPERATIONAL)';
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'P03 FAIL: %', SQLERRM; END;

  -- H04 PF user + OPERATIONAL → FAIL (coerência)
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','213f4903-d0c3-4c03-aa2f-328e11aac807',aid,'OPERATIONAL',true,'213f4903-d0c3-4c03-aa2f-328e11aac807'); RAISE WARNING 'H04 NAO MORDEU: PF aceitou OPERATIONAL';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H04 OK morde: PF!=OPERATIONAL (%)', SQLERRM; END;
  -- H05 PJ page + RESIDENCE → FAIL
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','52165a0b-1f2c-4846-8e54-2ccea4077c14',aid,'RESIDENCE',true,'52165a0b-1f2c-4846-8e54-2ccea4077c14'); RAISE WARNING 'H05 NAO MORDEU: PJ aceitou RESIDENCE';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H05 OK morde: PJ!=RESIDENCE'; END;
  -- H06 actor inexistente → FAIL (FK)
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','00000000-0000-0000-0000-000000000000',aid,'RESIDENCE',true,'00000000-0000-0000-0000-000000000000'); RAISE WARNING 'H06 NAO MORDEU: actor inexistente';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H06 OK morde: FK actor inexistente'; END;
  -- H07 owner_type=actor + actor_id NULL → FAIL (shape)
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','213f4903-d0c3-4c03-aa2f-328e11aac807',aid,'RESIDENCE',true,NULL); RAISE WARNING 'H07 NAO MORDEU: actor sem actor_id';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H07 OK morde: shape actor_id NULL'; END;
  -- H08 owner_id <> actor_id → FAIL (shape)
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','4ec428b4-a6b0-49ba-8dbd-0042be7de725',aid,'RESIDENCE',true,'213f4903-d0c3-4c03-aa2f-328e11aac807'); RAISE WARNING 'H08 NAO MORDEU: owner_id<>actor_id';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H08 OK morde: shape owner_id<>actor_id'; END;
  -- H09 dois primaries vigentes mesmo actor+role → FAIL (unique) [PF RESIDENCE já existe do P01]
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id) VALUES('actor','213f4903-d0c3-4c03-aa2f-328e11aac807',aid,'RESIDENCE',true,'213f4903-d0c3-4c03-aa2f-328e11aac807'); RAISE WARNING 'H09 NAO MORDEU: 2 primaries actor+role';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H09 OK morde: unique primary actor+role'; END;
  -- H10 valid_until <= valid_from → FAIL
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary,actor_id,valid_from_at,valid_until_at) VALUES('actor','4ec428b4-a6b0-49ba-8dbd-0042be7de725',aid,'RESIDENCE',false,'4ec428b4-a6b0-49ba-8dbd-0042be7de725', now(), now()-interval '1 day'); RAISE WARNING 'H10 NAO MORDEU: valid_until<=from';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H10 OK morde: vigencia invertida'; END;

  -- ── imutabilidade: pega o assignment PF RESIDENCE do P01 ──
  DECLARE rid uuid;
  BEGIN
    SELECT assignment_id INTO rid FROM address_assignments WHERE owner_type='actor' AND actor_id='213f4903-d0c3-4c03-aa2f-328e11aac807' AND role='RESIDENCE';
    -- E12 encerramento (valid_until := now+1h) → OK
    BEGIN UPDATE address_assignments SET valid_until_at=now()+interval '1 hour', is_primary=false WHERE assignment_id=rid; RAISE NOTICE 'E12 OK: encerramento aceito';
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'E12 FAIL: %', SQLERRM; END;
    -- H13 reabrir (valid_until → NULL) → FAIL
    BEGIN UPDATE address_assignments SET valid_until_at=NULL WHERE assignment_id=rid; RAISE WARNING 'H13 NAO MORDEU: reabriu';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H13 OK morde: no-reopen'; END;
    -- H14 update actor_id → FAIL
    BEGIN UPDATE address_assignments SET actor_id='4ec428b4-a6b0-49ba-8dbd-0042be7de725', owner_id='4ec428b4-a6b0-49ba-8dbd-0042be7de725' WHERE assignment_id=rid; RAISE WARNING 'H14 NAO MORDEU: trocou actor';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H14 OK morde: actor_id imutavel'; END;
    -- H15 update role → FAIL
    BEGIN UPDATE address_assignments SET role='HQ' WHERE assignment_id=rid; RAISE WARNING 'H15 NAO MORDEU: trocou role';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H15 OK morde: role imutavel'; END;
    -- H16 update address_id → FAIL
    BEGIN UPDATE address_assignments SET address_id=aid WHERE assignment_id=rid AND address_id=aid; -- no-op se igual; força mudança:
    UPDATE address_assignments SET address_id='00000000-0000-0000-0000-000000000000' WHERE assignment_id=rid; RAISE WARNING 'H16 NAO MORDEU: trocou address';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H16 OK morde: address_id imutavel'; END;
    -- H17 DELETE actor-scoped → FAIL
    BEGIN DELETE FROM address_assignments WHERE assignment_id=rid; RAISE WARNING 'H17 NAO MORDEU: deletou actor-scoped';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H17 OK morde: no-delete actor-scoped'; END;
  END;

  -- ── coerência composta / addresses (preservada) ──
  -- H18 bairro de OUTRA city → FAIL (FK composta)
  BEGIN INSERT INTO addresses(country_id,city_id,neighborhood_id,source) VALUES('42d04887-3033-459c-a4a9-8c6f9ea5a816','0bcb72d9-9d65-4d28-b46d-8237b6273925','31a83cf4-8466-45cd-bf49-97d958e56d41','UX_INPUT'); RAISE WARNING 'H18 NAO MORDEU: bairro de outra city';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H18 OK morde: bairro de city divergente'; END;
  -- H19 bairro sem city → FAIL (CHECK)
  BEGIN INSERT INTO addresses(country_id,neighborhood_id,source) VALUES('42d04887-3033-459c-a4a9-8c6f9ea5a816','31a83cf4-8466-45cd-bf49-97d958e56d41','UX_INPUT'); RAISE WARNING 'H19 NAO MORDEU: bairro sem city';
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'H19 OK morde: bairro sem city'; END;
  -- B20 city com neighborhood NULL → OK
  BEGIN INSERT INTO addresses(country_id,city_id,source) VALUES('42d04887-3033-459c-a4a9-8c6f9ea5a816','9d431002-1fd3-4b34-ae82-678f28f64288','UX_INPUT'); RAISE NOTICE 'B20 OK: city + neighborhood NULL aceito';
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'B20 FAIL: %', SQLERRM; END;
  -- B21 assignment LEGADO (profile, is_primary=false p/ não colidir com primary legado existente) segue funcionando
  BEGIN INSERT INTO address_assignments(owner_type,owner_id,address_id,role,is_primary) VALUES('profile','4ec428b4-a6b0-49ba-8dbd-0042be7de725',aid,'BILLING',false); RAISE NOTICE 'B21 OK: assignment legado profile aceito (actor_id NULL)';
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'B21 FAIL: %', SQLERRM; END;
END $t$;

ROLLBACK;

-- resíduo zero: schema e dados reais intocados
DO $z$ DECLARE hascol boolean; nassign int; naddr int;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='address_assignments' AND column_name='actor_id') INTO hascol;
  SELECT count(*) INTO nassign FROM address_assignments;
  SELECT count(*) INTO naddr FROM addresses;
  IF hascol=false AND nassign=3 AND naddr=3 THEN RAISE NOTICE 'RESIDUO-ZERO OK: actor_id ausente (rolled back), assignments=3, addresses=3';
  ELSE RAISE WARNING 'RESIDUO FAIL: hascol=% assign=% addr=%', hascol, nassign, naddr; END IF;
END $z$;

-- N2-G — PROVA INTEGRADA da composição N2-E (writer canônico) × N2-F (coerência de addresses).
-- Fluxo ÚNICO transacional: writer real → neighborhood canônico → address coerente → falhas compostas → ROLLBACK → resíduo zero.
-- Reutiliza os contratos materiais reais (fn_create_canonical_neighborhood, constraints de addresses); NÃO duplica lógica.
-- Transacional; ROLLBACK é a ÚNICA estratégia de limpeza; ZERO resíduo. Sem COMMIT. ON_ERROR_STOP=0.
\set actor  '213f4903-d0c3-4c03-aa2f-328e11aac807'
\set usr    '9305ac13-00b2-4ef2-989f-05c04259f18a'
\set tenant 'a3859c3e-eca7-4e7d-9df4-324829b368ce'
\set cityA  '029b307f-9cb6-43cb-8d99-11823b9dc001'
\set cityB  '058705b4-7d87-4cdd-aa8e-0bc15fa29fa4'

BEGIN;

-- helper de fixture: grant territorial ativo (mesmo padrão do teste N2-E)
CREATE OR REPLACE FUNCTION pg_temp.mkgrant(p_actor uuid, p_key text, p_city uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO actor_capability_grants (grantee_actor_id,capability_key,scope_type,scope_city_id,granted_by_user_id,granted_by_actor_id,authority_source,status)
  VALUES (p_actor,p_key,'territory',p_city,p_actor,p_actor,'grant','active');
END $$;

-- helper de INSERT de address com captura de constraint (mesmo padrão do teste N2-F)
CREATE OR REPLACE FUNCTION pg_temp.ins_addr(p_city uuid, p_nb uuid, p_disp text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_country uuid; BEGIN
  SELECT country_id INTO v_country FROM countries LIMIT 1;
  INSERT INTO addresses (country_id, city_id, neighborhood_id, neighborhood_display_text, source)
  VALUES (v_country, p_city, p_nb, p_disp, 'UX_INPUT');
  RETURN 'ok';
EXCEPTION
  WHEN check_violation THEN RETURN 'check:'||COALESCE(SQLERRM,'');
  WHEN foreign_key_violation THEN RETURN 'fk:'||COALESCE(SQLERRM,'');
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect(p_got text, p_kind text, p_label text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF (p_kind='ok' AND p_got='ok') OR (p_kind<>'ok' AND p_got LIKE p_kind||'%') THEN RAISE NOTICE '% OK (%)', p_label, left(p_got,24);
  ELSE RAISE WARNING '% FAIL: esperado % obteve %', p_label, p_kind, left(p_got,70); END IF; END $$;

-- ═══════════ FLUXO FELIZ: writer canônico N2-E cria o neighborhood, depois address N2-F o referencia ═══════════
SELECT pg_temp.mkgrant(:'actor','territory:create_neighborhood',:'cityA');
SELECT pg_temp.mkgrant(:'actor','territory:approve_neighborhood',:'cityA');

DO $$
DECLARE v_nb uuid; v_city uuid; v_ev int; v_g int; v_tok int; v_addr uuid; v_addr_cnt int; v_bad int; v_nb_count int;
BEGIN
  -- N2-E: chamada do caminho canônico REAL (não INSERT direto)
  v_nb := public.fn_create_canonical_neighborhood(
    'a3859c3e-eca7-4e7d-9df4-324829b368ce','9305ac13-00b2-4ef2-989f-05c04259f18a','213f4903-d0c3-4c03-aa2f-328e11aac807',
    '029b307f-9cb6-43cb-8d99-11823b9dc001','Bairro Integrado N2G','internal_curation','curadoria doc','evidencia','composição N2-E×N2-F');

  IF v_nb IS NULL THEN RAISE WARNING 'G01 FAIL: writer retornou nulo'; ELSE RAISE NOTICE 'G01 OK writer retornou neighborhood_id=%', v_nb; END IF;
  SELECT count(*) INTO v_nb_count FROM neighborhoods; -- 1 (só o criado pelo writer nesta tx)
  IF v_nb_count=1 THEN RAISE NOTICE 'G02 OK exatamente 1 neighborhood'; ELSE RAISE WARNING 'G02 FAIL % neighborhoods', v_nb_count; END IF;
  SELECT city_id INTO v_city FROM neighborhoods WHERE neighborhood_id=v_nb;
  IF v_city='029b307f-9cb6-43cb-8d99-11823b9dc001' THEN RAISE NOTICE 'G03 OK city_id=cityA'; ELSE RAISE WARNING 'G03 FAIL city=%', v_city; END IF;
  SELECT count(*) INTO v_ev FROM neighborhood_curation_events WHERE neighborhood_id=v_nb;
  IF v_ev=2 THEN RAISE NOTICE 'G04 OK 2 eventos de curadoria (create+approve)'; ELSE RAISE WARNING 'G04 FAIL % eventos', v_ev; END IF;
  SELECT count(DISTINCT grant_id) INTO v_g FROM neighborhood_curation_events WHERE neighborhood_id=v_nb;
  IF v_g=2 THEN RAISE NOTICE 'G05 OK 2 grant_ids distintos (create≠approve)'; ELSE RAISE WARNING 'G05 FAIL % grant_ids', v_g; END IF;
  PERFORM 1 FROM neighborhood_curation_events WHERE neighborhood_id=v_nb AND operation='created' AND capability_key='territory:create_neighborhood';
  IF FOUND THEN PERFORM 1 FROM neighborhood_curation_events WHERE neighborhood_id=v_nb AND operation='approved' AND capability_key='territory:approve_neighborhood';
    IF FOUND THEN RAISE NOTICE 'G06 OK create↔create-key e approve↔approve-key'; ELSE RAISE WARNING 'G06 FAIL approve ausente'; END IF;
  ELSE RAISE WARNING 'G06 FAIL created ausente'; END IF;
  SELECT count(*) INTO v_tok FROM neighborhood_writer_authorizations; -- token one-use consumido pelo trigger
  IF v_tok=0 THEN RAISE NOTICE 'G07 OK token one-use consumido (0 tokens vivos)'; ELSE RAISE WARNING 'G07 FAIL % tokens residuais', v_tok; END IF;

  -- N2-F: address VÁLIDO usando city correta + neighborhood_id recém-criado (FK composta aceita)
  INSERT INTO addresses (country_id, city_id, neighborhood_id, source)
  SELECT country_id, '029b307f-9cb6-43cb-8d99-11823b9dc001', v_nb, 'UX_INPUT' FROM countries LIMIT 1
  RETURNING address_id INTO v_addr;
  IF v_addr IS NOT NULL THEN RAISE NOTICE 'G08 OK address válido criado (city+neighborhood coerentes) id=%', v_addr; ELSE RAISE WARNING 'G08 FAIL address não criado'; END IF;

  -- ═══════════ FALHAS COMPOSTAS (mesma tx, cada uma sem criar associação) ═══════════
  -- A. CITY INCORRETA: mesmo neighborhood_id com cityB → FK composta falha
  PERFORM pg_temp.expect(pg_temp.ins_addr('058705b4-7d87-4cdd-aa8e-0bc15fa29fa4', v_nb), 'fk', 'G09 city incorreta (FK composta)');
  -- B. NEIGHBORHOOD SEM CITY: neighborhood_id + city NULL → CHECK falha
  PERFORM pg_temp.expect(pg_temp.ins_addr(NULL, v_nb), 'check', 'G10 neighborhood sem city (CHECK)');
  -- C. NEIGHBORHOOD INEXISTENTE: city válida + UUID inexistente → FK falha
  PERFORM pg_temp.expect(pg_temp.ins_addr('029b307f-9cb6-43cb-8d99-11823b9dc001', '99999999-9999-9999-9999-999999999999'), 'fk', 'G11 neighborhood inexistente (FK)');
  -- D. DISPLAY_TEXT/CEP/PROVIDER NÃO É IDENTITY: nome do bairro em display_text, sem neighborhood_id → não cria identidade
  PERFORM pg_temp.expect(pg_temp.ins_addr('029b307f-9cb6-43cb-8d99-11823b9dc001', NULL, 'Bairro Integrado N2G'), 'ok', 'G12 display_text sem nb (evidence, não identity)');
  SELECT count(*) INTO v_nb_count FROM neighborhoods;
  IF v_nb_count=1 THEN RAISE NOTICE 'G13 OK display_text NÃO inferiu neighborhood_id (ainda 1 neighborhood)'; ELSE RAISE WARNING 'G13 FAIL contagem mudou p/ %', v_nb_count; END IF;

  -- E. TOKEN ONE-USE / F. DML DIRETO: INSERT direto em neighborhoods (sem token, fora do writer) → HOLD bloqueia
  BEGIN
    INSERT INTO neighborhoods (city_id,name,source_kind,source_reference,evidence,created_by_actor_id,approved_by_actor_id,approved_at,valid_from_at)
    VALUES ('029b307f-9cb6-43cb-8d99-11823b9dc001','Bypass','internal_curation','r','e','213f4903-d0c3-4c03-aa2f-328e11aac807','213f4903-d0c3-4c03-aa2f-328e11aac807',now(),now());
    RAISE WARNING 'G14 FAIL: INSERT direto sem token passou (HOLD furado)';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM ~ 'NEIGHBORHOOD_CANONICAL_WRITER_HOLD' THEN RAISE NOTICE 'G14 OK INSERT direto bloqueado pelo HOLD (token one-use, sem 2º neighborhood)'; ELSE RAISE WARNING 'G14 FAIL %', left(SQLERRM,50); END IF; END;

  -- ═══════════ ASSERTIONS DE ATOMICIDADE (antes do rollback) ═══════════
  SELECT count(*) INTO v_nb_count FROM neighborhoods;                                    -- 1 neighborhood
  SELECT count(*) INTO v_ev FROM neighborhood_curation_events;                           -- 2 eventos de curadoria
  SELECT count(*) INTO v_g FROM actor_capability_grants WHERE scope_type='territory';    -- 2 grants de fixture
  SELECT count(*) INTO v_addr_cnt FROM addresses WHERE neighborhood_id=v_nb;             -- 1 address válido ligado ao nb
  SELECT count(*) INTO v_bad FROM addresses WHERE (neighborhood_id IS NOT NULL AND city_id IS NULL);  -- 0 inválido
  SELECT count(*) INTO v_tok FROM neighborhood_writer_authorizations;                    -- 0 tokens
  IF v_nb_count=1 AND v_ev=2 AND v_g=2 AND v_addr_cnt=1 AND v_bad=0 AND v_tok=0
     AND (SELECT count(*) FROM neighborhood_aliases)=0 AND (SELECT count(*) FROM neighborhood_succession_events)=0 THEN
    RAISE NOTICE 'G15 OK atomicidade: 1 nb, 2 eventos, 2 grants, 1 address válido, 0 inválido, 0 tokens, 0 alias, 0 succession';
  ELSE RAISE WARNING 'G15 FAIL atomicidade: nb=% ev=% grants=% addr=% bad=% tok=%', v_nb_count,v_ev,v_g,v_addr_cnt,v_bad,v_tok; END IF;
END $$;

ROLLBACK;

-- ═══════════ RESÍDUO ZERO (fora da transação; rollback é a única limpeza) ═══════════
DO $$ DECLARE nn int; na int; ns int; ng int; nge int; nc int; nt int; nad int; nact int; nbad int; BEGIN
  SELECT count(*) INTO nn FROM neighborhoods;
  SELECT count(*) INTO na FROM neighborhood_aliases;
  SELECT count(*) INTO ns FROM neighborhood_succession_events;
  SELECT count(*) INTO ng FROM actor_capability_grants WHERE scope_type='territory';
  SELECT count(*) INTO nge FROM actor_capability_grant_events;
  SELECT count(*) INTO nc FROM neighborhood_curation_events;
  SELECT count(*) INTO nt FROM neighborhood_writer_authorizations;
  SELECT count(*) INTO nad FROM addresses;
  SELECT count(*) INTO nbad FROM addresses WHERE neighborhood_id IS NOT NULL;
  SELECT count(*) INTO nact FROM actors;
  IF nn=0 AND na=0 AND ns=0 AND ng=0 AND nc=0 AND nt=0 AND nad=3 AND nbad=0 AND nact=6 THEN
    RAISE NOTICE 'G16 OK resíduo ZERO: neighborhoods=0 aliases=0 succession=0 territory_grants=0 grant_events=% curation=0 tokens=0 addresses=3 (nb=0) actors=6', nge;
  ELSE RAISE WARNING 'G16 FAIL resíduo: nb=% al=% suc=% grants=% cur=% tok=% addr=% addr_nb=% actors=%', nn,na,ns,ng,nc,nt,nad,nbad,nact; END IF;
END $$;

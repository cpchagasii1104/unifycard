-- N3-PRE — prova DB do PREDICADO CANÔNICO DE VIGÊNCIA aplicado pelos 3 readers de neighborhoods.
-- Como o catálogo real deve permanecer VAZIO e é PROIBIDO desabilitar triggers / tocar dados reais, a prova
-- roda contra uma TEMP TABLE sintética (ON COMMIT DROP) que espelha as colunas relevantes de neighborhoods, e
-- executa consultas que ESPELHAM os 3 readers (list-by-city / find-by-id / validate-belongs) usando EXATAMENTE
-- o mesmo predicado do repository. Transacional; ROLLBACK; neighborhoods reais intocados (=0). ON_ERROR_STOP=0.
\set cityA '029b307f-9cb6-43cb-8d99-11823b9dc001'
\set cityB '058705b4-7d87-4cdd-aa8e-0bc15fa29fa4'

BEGIN;
CREATE TEMP TABLE nb_fix (
  neighborhood_id uuid, city_id uuid, name text, is_active boolean,
  valid_from_at timestamptz, valid_until_at timestamptz
) ON COMMIT DROP;
INSERT INTO nb_fix VALUES
  ('00000000-0000-0000-0000-000000000001', :'cityA', 'Ativo Vigente',  true,  now()-interval '1 day', NULL),                       -- T01 corrente
  ('00000000-0000-0000-0000-000000000002', :'cityA', 'Futuro',         true,  now()+interval '1 day', NULL),                       -- T02 valid_from futuro
  ('00000000-0000-0000-0000-000000000003', :'cityA', 'Expirado',       true,  now()-interval '2 day', now()-interval '1 day'),     -- T03 valid_until passado
  ('00000000-0000-0000-0000-000000000004', :'cityA', 'BordaUntilNow',  true,  now()-interval '1 day', now()),                      -- T04 valid_until = agora (estrito >)
  ('00000000-0000-0000-0000-000000000005', :'cityA', 'Inativo',        false, now()-interval '1 day', NULL),                       -- T05 inativo
  ('00000000-0000-0000-0000-000000000006', :'cityB', 'OutraCity',      true,  now()-interval '1 day', NULL);                       -- T06 outra city

-- predicado CANÔNICO (idêntico ao NEIGHBORHOOD_CURRENT_SQL do repository), alias n
-- reader 1 espelhado: list-by-city(cityA) → só correntes de cityA
CREATE OR REPLACE FUNCTION pg_temp.list_city(p_city uuid) RETURNS TABLE(name text) LANGUAGE sql AS $$
  SELECT n.name FROM nb_fix n
  WHERE n.city_id = p_city
    AND n.is_active = true AND n.valid_from_at <= CURRENT_TIMESTAMP AND (n.valid_until_at IS NULL OR n.valid_until_at > CURRENT_TIMESTAMP)
  ORDER BY n.name ASC $$;
-- reader 2 espelhado: find-by-id → corrente?
CREATE OR REPLACE FUNCTION pg_temp.find_id(p_id uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS(SELECT 1 FROM nb_fix n WHERE n.neighborhood_id = p_id
    AND n.is_active = true AND n.valid_from_at <= CURRENT_TIMESTAMP AND (n.valid_until_at IS NULL OR n.valid_until_at > CURRENT_TIMESTAMP)) $$;
-- reader 3 espelhado: validate-belongs(id,city)
CREATE OR REPLACE FUNCTION pg_temp.belongs(p_id uuid, p_city uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS(SELECT 1 FROM nb_fix n WHERE n.neighborhood_id = p_id AND n.city_id = p_city
    AND n.is_active = true AND n.valid_from_at <= CURRENT_TIMESTAMP AND (n.valid_until_at IS NULL OR n.valid_until_at > CURRENT_TIMESTAMP)) $$;

DO $$
DECLARE v_list text; v int;
BEGIN
  -- reader 1: list-by-city(cityA) deve retornar SOMENTE 'Ativo Vigente'
  SELECT string_agg(name, ',') INTO v_list FROM pg_temp.list_city('029b307f-9cb6-43cb-8d99-11823b9dc001');
  IF v_list = 'Ativo Vigente' THEN RAISE NOTICE 'T-LIST OK: só a corrente de cityA (%)', v_list;
  ELSE RAISE WARNING 'T-LIST FAIL: %', COALESCE(v_list,'<vazio>'); END IF;

  -- reader 2: find-by-id por caso
  IF pg_temp.find_id('00000000-0000-0000-0000-000000000001') THEN RAISE NOTICE 'T01 OK find corrente=true'; ELSE RAISE WARNING 'T01 FAIL'; END IF;
  IF NOT pg_temp.find_id('00000000-0000-0000-0000-000000000002') THEN RAISE NOTICE 'T02 OK find valid_from-futuro=false'; ELSE RAISE WARNING 'T02 FAIL'; END IF;
  IF NOT pg_temp.find_id('00000000-0000-0000-0000-000000000003') THEN RAISE NOTICE 'T03 OK find valid_until-passado=false'; ELSE RAISE WARNING 'T03 FAIL'; END IF;
  IF NOT pg_temp.find_id('00000000-0000-0000-0000-000000000004') THEN RAISE NOTICE 'T04 OK find valid_until=agora=false (estrito >)'; ELSE RAISE WARNING 'T04 FAIL'; END IF;
  IF NOT pg_temp.find_id('00000000-0000-0000-0000-000000000005') THEN RAISE NOTICE 'T05 OK find inativo=false'; ELSE RAISE WARNING 'T05 FAIL'; END IF;

  -- reader 3: validate-belongs
  IF pg_temp.belongs('00000000-0000-0000-0000-000000000001','029b307f-9cb6-43cb-8d99-11823b9dc001') THEN RAISE NOTICE 'T-BELONGS OK corrente+city correta=true'; ELSE RAISE WARNING 'T-BELONGS FAIL'; END IF;
  IF NOT pg_temp.belongs('00000000-0000-0000-0000-000000000006','029b307f-9cb6-43cb-8d99-11823b9dc001') THEN RAISE NOTICE 'T06 OK belongs city errada=false'; ELSE RAISE WARNING 'T06 FAIL'; END IF;
  IF NOT pg_temp.belongs('00000000-0000-0000-0000-000000000005','029b307f-9cb6-43cb-8d99-11823b9dc001') THEN RAISE NOTICE 'T05b OK belongs inativo=false'; ELSE RAISE WARNING 'T05b FAIL'; END IF;
  -- T07 id inexistente
  IF NOT pg_temp.find_id('99999999-9999-9999-9999-999999999999') THEN RAISE NOTICE 'T07 OK find id inexistente=false'; ELSE RAISE WARNING 'T07 FAIL'; END IF;
END $$;

ROLLBACK;

-- T08 / não-contaminação: neighborhoods reais seguem 0; grants territoriais intactos.
DO $$ DECLARE nn int; ng int; ne int; BEGIN
  SELECT count(*) INTO nn FROM neighborhoods;
  SELECT count(*) INTO ng FROM actor_capability_grants WHERE scope_type='territory';
  SELECT count(*) INTO ne FROM actor_capability_grant_events;
  IF nn=0 AND ng=2 AND ne=2 THEN RAISE NOTICE 'T08 OK não-contaminação: neighborhoods=0, territory_grants=2, grant_events=2';
  ELSE RAISE WARNING 'T08 FAIL: neighborhoods=% grants=% events=%', nn, ng, ne; END IF;
END $$;

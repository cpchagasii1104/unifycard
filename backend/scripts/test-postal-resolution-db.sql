-- FASE B (RFC B1-D) — prova DB TRANSACIONAL (ROLLBACK) da fundação de unicidade escopada e da
-- semântica de resolução canônica por identificador oficial. NÃO usa provider externo, NÃO toca
-- produto (fixtures de teste vivem só dentro da transação). Estado final = estado inicial.
\set ON_ERROR_STOP off

BEGIN;

DO $t$
DECLARE
  pr uuid; sp uuid; br uuid;
  c_cities int; c_states int; c_countries int; c_nb int; c_addr int; c_assign int; c_cache int;
  n int; dup_blocked boolean := false;
  t1 uuid; t2 uuid;
BEGIN
  SELECT count(*) INTO c_cities FROM cities;
  SELECT count(*) INTO c_states FROM states;
  SELECT count(*) INTO c_countries FROM countries;
  SELECT count(*) INTO c_nb FROM neighborhoods;
  SELECT count(*) INTO c_addr FROM addresses;
  SELECT count(*) INTO c_assign FROM address_assignments;
  SELECT count(*) INTO c_cache FROM cep_resolution_cache;

  SELECT country_id INTO br FROM countries WHERE iso_alpha2='BR';
  SELECT state_id INTO pr FROM states WHERE country_id=br AND abbreviation='PR';
  SELECT state_id INTO sp FROM states WHERE country_id=br AND abbreviation='SP';
  IF br IS NULL OR pr IS NULL OR sp IS NULL THEN RAISE WARNING 'P0 FAIL: catálogo BR/PR/SP ausente'; END IF;

  -- P1: índice de unicidade escopada VIVO com o shape certo (parcial, state_id+external_code).
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename='cities' AND indexname='uidx_cities_state_external_code'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%(state_id, external_code)%'
      AND indexdef ILIKE '%external_code IS NOT NULL%' AND indexdef ILIKE '%btrim(external_code)%'
  ) THEN RAISE NOTICE 'P1 OK: uidx_cities_state_external_code vivo (UNIQUE parcial escopado)';
  ELSE RAISE WARNING 'P1 FAIL: índice escopado ausente ou com shape errado'; END IF;

  -- P2: o MESMO código oficial é aceito em jurisdições DISTINTAS (identidade não é global nua).
  INSERT INTO cities (state_id, name, external_code) VALUES (pr, 'Cidade Teste Fase B PR', '9999901') RETURNING city_id INTO t1;
  INSERT INTO cities (state_id, name, external_code) VALUES (sp, 'Cidade Teste Fase B SP', '9999901') RETURNING city_id INTO t2;
  IF t1 IS NOT NULL AND t2 IS NOT NULL THEN RAISE NOTICE 'P2 OK: mesmo external_code em states distintos aceito';
  ELSE RAISE WARNING 'P2 FAIL'; END IF;

  -- P3: duplicata DENTRO do mesmo state → unique_violation (identidade escopada é única).
  BEGIN
    INSERT INTO cities (state_id, name, external_code) VALUES (pr, 'Cidade Teste Fase B PR 2', '9999901');
  EXCEPTION WHEN unique_violation THEN dup_blocked := true;
  END;
  IF dup_blocked THEN RAISE NOTICE 'P3 OK: duplicata (state_id, external_code) bloqueada pelo índice';
  ELSE RAISE WARNING 'P3 FAIL: duplicata aceita no mesmo state'; END IF;

  -- P4: external_code NULL segue permitido (inclusive vários no mesmo state).
  BEGIN
    INSERT INTO cities (state_id, name, external_code) VALUES (pr, 'Cidade Teste Fase B Sem Codigo A', NULL);
    INSERT INTO cities (state_id, name, external_code) VALUES (pr, 'Cidade Teste Fase B Sem Codigo B', NULL);
    RAISE NOTICE 'P4 OK: external_code NULL multiplo permitido (indice parcial)';
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'P4 FAIL: NULL external_code rejeitado (%)', SQLERRM;
  END;

  -- P5: resolução canônica acha EXATAMENTE a capital existente pelo par escopado (PR + IBGE Curitiba).
  SELECT count(*) INTO n FROM cities WHERE state_id=pr AND external_code='4106902';
  IF n=1 THEN RAISE NOTICE 'P5 OK: (PR, 4106902) → exatamente 1 city canônica (Curitiba)';
  ELSE RAISE WARNING 'P5 FAIL: (PR, 4106902) → % rows', n; END IF;

  -- P6: código inexistente no catálogo → 0 rows (semântica canonical_city_missing, sem criação).
  SELECT count(*) INTO n FROM cities WHERE state_id=pr AND external_code='0000001';
  IF n=0 THEN RAISE NOTICE 'P6 OK: código inexistente → 0 rows (canonical_city_missing fail-closed)';
  ELSE RAISE WARNING 'P6 FAIL: código inexistente retornou % rows', n; END IF;

  -- P7: UF incompatível → 0 rows no par escopado, mas o código EXISTE no país
  --     (semântica territorial_inconsistency, distinta de cidade-ausente).
  SELECT count(*) INTO n FROM cities WHERE state_id=sp AND external_code='4106902';
  IF n=0 AND EXISTS (
    SELECT 1 FROM cities c JOIN states s ON s.state_id=c.state_id
    WHERE s.country_id=br AND c.external_code='4106902'
  ) THEN RAISE NOTICE 'P7 OK: (SP, 4106902) → 0 rows + código vivo em outra UF (territorial_inconsistency)';
  ELSE RAISE WARNING 'P7 FAIL: n=%', n; END IF;

  -- P8: NENHUM território novo além das fixtures transacionais deste teste (que serão revertidas):
  --     states/countries/neighborhoods/addresses/assignments intocados DENTRO da transação.
  SELECT count(*) INTO n FROM states;   IF n<>c_states    THEN RAISE WARNING 'P8 FAIL: states mudou'; ELSE RAISE NOTICE 'P8a OK: states intactos'; END IF;
  SELECT count(*) INTO n FROM countries; IF n<>c_countries THEN RAISE WARNING 'P8 FAIL: countries mudou'; ELSE RAISE NOTICE 'P8b OK: countries intactos'; END IF;
  SELECT count(*) INTO n FROM neighborhoods; IF n<>c_nb    THEN RAISE WARNING 'P8 FAIL: neighborhoods mudou'; ELSE RAISE NOTICE 'P8c OK: neighborhoods intactos'; END IF;
  SELECT count(*) INTO n FROM addresses; IF n<>c_addr      THEN RAISE WARNING 'P8 FAIL: addresses mudou'; ELSE RAISE NOTICE 'P8d OK: addresses intactos'; END IF;
  SELECT count(*) INTO n FROM address_assignments; IF n<>c_assign THEN RAISE WARNING 'P8 FAIL: assignments mudou'; ELSE RAISE NOTICE 'P8e OK: assignments intactos'; END IF;
  SELECT count(*) INTO n FROM address_assignments WHERE owner_type='actor'; IF n<>0 THEN RAISE WARNING 'P8 FAIL: actor-scoped nasceu'; ELSE RAISE NOTICE 'P8f OK: actor-scoped=0'; END IF;
  SELECT count(*) INTO n FROM cep_resolution_cache; IF n<>c_cache THEN RAISE WARNING 'P8 FAIL: cache mudou'; ELSE RAISE NOTICE 'P8g OK: cache intacto'; END IF;
END $t$;

ROLLBACK;

-- P9: pós-ROLLBACK — resíduo ZERO (nenhuma fixture de teste sobreviveu; catálogo idêntico).
DO $t$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM cities WHERE name LIKE 'Cidade Teste Fase B%';
  IF n=0 THEN RAISE NOTICE 'P9 OK: rollback total, resíduo zero';
  ELSE RAISE WARNING 'P9 FAIL: % fixtures sobreviveram', n; END IF;
END $t$;

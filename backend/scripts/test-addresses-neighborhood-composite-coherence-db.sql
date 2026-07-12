-- N2-F — provas DB da coerência composta de addresses. Transacional; ROLLBACK; ZERO resíduo. ON_ERROR_STOP=0.
\set cityA '029b307f-9cb6-43cb-8d99-11823b9dc001'
\set cityB '058705b4-7d87-4cdd-aa8e-0bc15fa29fa4'
\set actor '213f4903-d0c3-4c03-aa2f-328e11aac807'

BEGIN;
-- fixtures: 2 bairros (Centro em cityA e cityB — mesmo nome, cidades distintas) + 1 em cityB.
-- Triggers de escrita de neighborhoods desabilitados SÓ nesta transação (ROLLBACK restaura).
ALTER TABLE neighborhoods DISABLE TRIGGER trg_neighborhoods_canonical_writer_hold;
ALTER TABLE neighborhoods DISABLE TRIGGER trg_neighborhoods_writer_token_consume;
ALTER TABLE neighborhoods DISABLE TRIGGER trg_neighborhood_identity_immutability;
INSERT INTO neighborhoods (neighborhood_id, city_id, name, source_kind, source_reference, evidence, created_by_actor_id, approved_by_actor_id, approved_at, valid_from_at)
VALUES ('11111111-1111-1111-1111-111111111111', :'cityA', 'Centro', 'internal_curation', 'r', 'e', :'actor', :'actor', now(), now()),
       ('22222222-2222-2222-2222-222222222222', :'cityB', 'Centro', 'internal_curation', 'r', 'e', :'actor', :'actor', now(), now());
\set country `psql -h localhost -U postgres -d unificard_dev -tAc "SELECT country_id FROM countries LIMIT 1"`

CREATE OR REPLACE FUNCTION pg_temp.ins(p_city uuid, p_nb uuid, p_disp text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_country uuid; BEGIN
  SELECT country_id INTO v_country FROM countries LIMIT 1;
  INSERT INTO addresses (country_id, city_id, neighborhood_id, neighborhood_display_text, source) VALUES (v_country, p_city, p_nb, p_disp, 'UX_INPUT');
  RETURN 'ok';
EXCEPTION
  WHEN check_violation THEN RETURN 'check:'||COALESCE(SQLERRM,'');
  WHEN foreign_key_violation THEN RETURN 'fk:'||COALESCE(SQLERRM,'');
END $$;

-- helper de assert
CREATE OR REPLACE FUNCTION pg_temp.expect(p_got text, p_kind text, p_label text)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF (p_kind='ok' AND p_got='ok') OR (p_kind<>'ok' AND p_got LIKE p_kind||'%') THEN RAISE NOTICE '% OK (%)', p_label, left(p_got,20);
  ELSE RAISE WARNING '% FAIL: esperado % obteve %', p_label, p_kind, left(p_got,60); END IF; END $$;

-- ── matriz de nulabilidade + coerência ──
SELECT pg_temp.expect(pg_temp.ins(NULL, NULL),                 'ok',    'T01 NULL/NULL');
SELECT pg_temp.expect(pg_temp.ins(:'cityA', NULL),             'ok',    'T02 city/NULL');
SELECT pg_temp.expect(pg_temp.ins(NULL, '11111111-1111-1111-1111-111111111111'), 'check', 'T03 NULL/nb (CHECK)');
SELECT pg_temp.expect(pg_temp.ins(:'cityA','11111111-1111-1111-1111-111111111111'), 'ok', 'T04 par correto');
SELECT pg_temp.expect(pg_temp.ins(:'cityB','11111111-1111-1111-1111-111111111111'), 'fk', 'T05 city errada/nb outra cidade (FK)');
SELECT pg_temp.expect(pg_temp.ins(:'cityA','99999999-9999-9999-9999-999999999999'), 'fk', 'T06 nb inexistente (FK)');
-- T07: mesmo nome em 2 cidades, cada par correto passa (ids distintos)
SELECT pg_temp.expect(pg_temp.ins(:'cityB','22222222-2222-2222-2222-222222222222'), 'ok', 'T07a Centro/cityB correto');
SELECT pg_temp.expect(pg_temp.ins(:'cityA','11111111-1111-1111-1111-111111111111'), 'ok', 'T07b Centro/cityA correto (distinto por id)');
-- T22: display_text sem neighborhood_id passa (evidência)
SELECT pg_temp.expect(pg_temp.ins(:'cityA', NULL, 'Bairro Texto Livre'), 'ok', 'T22 display_text sem nb');

-- ── estrutura ──
DO $$ DECLARE d text; BEGIN
  SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conname='fk_addresses_city_neighborhood';
  IF d LIKE 'FOREIGN KEY (city_id, neighborhood_id) REFERENCES neighborhoods(city_id, neighborhood_id)%' AND d LIKE '%ON DELETE RESTRICT%' THEN RAISE NOTICE 'T09 OK FK composta'; ELSE RAISE WARNING 'T09 FAIL %', d; END IF;
  SELECT (confmatchtype::text||confupdtype::text) INTO d FROM pg_constraint WHERE conname='fk_addresses_city_neighborhood';
  IF d='sa' THEN RAISE NOTICE 'T14/T15 OK MATCH SIMPLE + ON UPDATE NO ACTION'; ELSE RAISE WARNING 'T14/T15 FAIL match||upd=%', d; END IF;
END $$;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname='addresses_neighborhood_id_fkey') THEN RAISE WARNING 'T08 FAIL FK simples presente'; ELSE RAISE NOTICE 'T08 OK FK simples ausente'; END IF; END $$;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ck_addresses_neighborhood_requires_city' AND convalidated) THEN RAISE NOTICE 'T10 OK CHECK validado'; ELSE RAISE WARNING 'T10 FAIL'; END IF; END $$;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname='uq_neighborhoods_city_id_neighborhood_id' AND convalidated) THEN RAISE NOTICE 'T11 OK candidate key'; ELSE RAISE WARNING 'T11 FAIL'; END IF; END $$;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_addresses_city_neighborhood') THEN RAISE NOTICE 'T12 OK índice'; ELSE RAISE WARNING 'T12 FAIL'; END IF; END $$;
-- T13 ON DELETE RESTRICT: address referenciando nb bloqueia DELETE do nb
DO $$ BEGIN
  BEGIN DELETE FROM neighborhoods WHERE neighborhood_id='11111111-1111-1111-1111-111111111111';
    RAISE WARNING 'T13 FAIL: DELETE do nb referenciado passou';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'T13 OK ON DELETE RESTRICT bloqueia'; END;
END $$;
-- (ON UPDATE NO ACTION provado estruturalmente em T14/T15; ON DELETE RESTRICT em T13.)

ROLLBACK;

-- T28 zero resíduo (fora da tx)
DO $$ DECLARE na int; nn int; BEGIN
  SELECT count(*) INTO na FROM addresses; SELECT count(*) INTO nn FROM neighborhoods;
  IF na=37 AND nn=0 THEN RAISE NOTICE 'T27/T28 OK rollback: addresses=37 neighborhoods=0 (zero resíduo)'; ELSE RAISE WARNING 'T28 FAIL addresses=% neighborhoods=%', na, nn; END IF; END $$;

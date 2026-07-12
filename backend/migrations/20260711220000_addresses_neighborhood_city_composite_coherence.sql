-- ============================================================
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-F — COERÊNCIA COMPOSTA DE ADDRESSES
-- DECISION-0171 / DECISION-0172 (N2-F) + martelos M-1..M-3 do GATE N2-F.
-- ============================================================
-- Torna FÍSICA a coerência territorial de endereços: se addresses.neighborhood_id não é NULL, então
-- (a) addresses.city_id não é NULL (CHECK) e (b) o par (city_id, neighborhood_id) existe em neighborhoods
-- (FK COMPOSTA) — ou seja, o bairro pertence à MESMA cidade. Preserva city preenchida + neighborhood NULL.
--
-- M-1: candidate key UNIQUE(city_id, neighborhood_id) em neighborhoods (SÓ sustenta a FK composta; NÃO
--      substitui neighborhood_id como PK; NÃO cria segunda identidade; NÃO autoriza busca/criação por texto).
-- M-3: FK composta MATCH SIMPLE · ON DELETE RESTRICT · ON UPDATE NO ACTION (nunca FULL/CASCADE/SET NULL/
--      SET DEFAULT/trigger de autocorreção). MATCH SIMPLE preserva (city preenchida / neighborhood NULL):
--      com neighborhood_id NULL a FK não é checada; o CHECK é que proíbe (city NULL / neighborhood preenchida).
-- D-F3: a FK simples atual addresses_neighborhood_id_fkey é REMOVIDA no MESMO envelope.
-- D-F4: ZERO backfill — nenhuma derivação de neighborhood_id por texto/CEP/provider/name/normalize_name/
--       fuzzy/slug/metadata/primeiro-resultado/dynamic SQL. Nenhum UPDATE de dados territoriais.
--
-- Estado vivo provado no GATE: addresses=37 (todos neighborhood_id NULL), neighborhoods=0, ZERO incoerência
-- → validação IMEDIATA (sem NOT VALID). Forward-only; transação única; fail-closed pré+pós.
-- ESCOPO NEGATIVO: ZERO neighborhood/alias/sucessão/grant/writer territorial/rota/PORTA/CEP-resolver/seed/
-- Social/Bank. Não altera RLS/tenant (addresses é catálogo global sem RLS).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PRÉ)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  IF to_regclass('public.addresses') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: addresses ausente.'; END IF;
  IF to_regclass('public.neighborhoods') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods ausente.'; END IF;
  -- FK simples atual presente (será removida nesta fatia)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.addresses'::regclass AND conname='addresses_neighborhood_id_fkey') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: FK simples addresses_neighborhood_id_fkey ausente — terreno divergente.';
  END IF;
  -- objetos da N2-F ainda não existem
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('uq_neighborhoods_city_id_neighborhood_id','ck_addresses_neighborhood_requires_city','fk_addresses_city_neighborhood')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraint N2-F já existe — estado divergente/reaplicação.';
  END IF;
  -- ZERO incoerência viva (nenhuma correção silenciosa; STOP se houver)
  SELECT count(*) INTO v_cnt FROM addresses WHERE neighborhood_id IS NOT NULL AND city_id IS NULL;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % address(es) com neighborhood sem city — corrigir é decisão humana, NAO backfill.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM addresses a WHERE a.neighborhood_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM neighborhoods n WHERE n.neighborhood_id=a.neighborhood_id);
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % address(es) com neighborhood inexistente.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM addresses a JOIN neighborhoods n ON n.neighborhood_id=a.neighborhood_id WHERE a.city_id IS DISTINCT FROM n.city_id;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % address(es) com neighborhood de OUTRA city.', v_cnt; END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. CANDIDATE KEY (M-1) — sustenta a FK composta. neighborhood_id permanece PK (identidade única).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE neighborhoods
  ADD CONSTRAINT uq_neighborhoods_city_id_neighborhood_id UNIQUE (city_id, neighborhood_id);
COMMENT ON CONSTRAINT uq_neighborhoods_city_id_neighborhood_id ON neighborhoods IS
  'N2-F (M-1): candidate key que SUSTENTA a FK composta de addresses. NÃO substitui a PK neighborhood_id; NÃO cria segunda identidade territorial; NÃO autoriza busca/criação de bairro por texto.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CHECK (D-F1): neighborhood_id preenchido EXIGE city_id preenchido.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE addresses
  ADD CONSTRAINT ck_addresses_neighborhood_requires_city CHECK (
    neighborhood_id IS NULL OR city_id IS NOT NULL
  );
COMMENT ON CONSTRAINT ck_addresses_neighborhood_requires_city ON addresses IS
  'N2-F (D-F1): bairro sem cidade é proibido. Necessário porque a FK composta MATCH SIMPLE não é checada quando neighborhood_id é NULL — o CHECK fecha o caso (city NULL / neighborhood preenchida). Preserva (city preenchida / neighborhood NULL) e (NULL/NULL).';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. FK COMPOSTA (D-F2 / M-3): (city_id, neighborhood_id) → neighborhoods(city_id, neighborhood_id).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE addresses
  ADD CONSTRAINT fk_addresses_city_neighborhood
  FOREIGN KEY (city_id, neighborhood_id)
  REFERENCES neighborhoods (city_id, neighborhood_id)
  MATCH SIMPLE
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;
COMMENT ON CONSTRAINT fk_addresses_city_neighborhood ON addresses IS
  'N2-F (D-F2/M-3): coerência física — bairro pertence à MESMA cidade. MATCH SIMPLE (preserva city+neighborhood-NULL); ON DELETE RESTRICT; ON UPDATE NO ACTION. Nunca FULL/CASCADE/SET NULL/SET DEFAULT. Valida identidade geográfica, não autoridade.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ÍNDICE de suporte no lado referenciante (performance de checagem/DELETE do pai).
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_addresses_city_neighborhood ON addresses (city_id, neighborhood_id) WHERE neighborhood_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. REMOÇÃO da FK simples (D-F3) — só a FK composta permanece.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE addresses DROP CONSTRAINT addresses_neighborhood_id_fkey;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PÓS) + AUTO-PROVAS (sub-transações que falham e revertem; sem resíduo).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT; v_def TEXT; v_country UUID; v_city UUID; v_before BIGINT;
BEGIN
  -- candidate key validada, colunas exatas
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.neighborhoods'::regclass
   AND conname='uq_neighborhoods_city_id_neighborhood_id' AND contype='u' AND convalidated
   AND pg_get_constraintdef(oid)='UNIQUE (city_id, neighborhood_id)';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: candidate key (city_id, neighborhood_id) ausente/divergente.'; END IF;

  -- CHECK validado, forma exata
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint WHERE conrelid='public.addresses'::regclass
   AND conname='ck_addresses_neighborhood_requires_city' AND contype='c' AND convalidated;
  IF v_def IS NULL OR v_def !~ 'neighborhood_id IS NULL' OR v_def !~ 'city_id IS NOT NULL' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: CHECK ck_addresses_neighborhood_requires_city ausente/divergente (achado: %).', COALESCE(v_def,'ausente');
  END IF;

  -- FK composta: validada, colunas (city_id, neighborhood_id), alvo neighborhoods, MATCH SIMPLE, RESTRICT/NO ACTION
  SELECT c.confmatchtype::text||c.confdeltype::text||c.confupdtype::text INTO v_def FROM pg_constraint c
   WHERE c.conrelid='public.addresses'::regclass AND c.conname='fk_addresses_city_neighborhood'
     AND c.contype='f' AND c.convalidated AND c.confrelid='public.neighborhoods'::regclass;
  IF v_def IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: FK composta ausente/NOT VALID/alvo errado.'; END IF;
  IF v_def <> 'sra' THEN RAISE EXCEPTION 'MIGRATION_ABORT: FK composta não é MATCH SIMPLE/ON DELETE RESTRICT/ON UPDATE NO ACTION (achado matchtype||deltype||updtype=%).', v_def; END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint WHERE conrelid='public.addresses'::regclass AND conname='fk_addresses_city_neighborhood';
  IF v_def !~ 'FOREIGN KEY \(city_id, neighborhood_id\)' OR v_def !~ 'REFERENCES neighborhoods\(city_id, neighborhood_id\)' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: FK composta com colunas/alvo divergentes (achado: %).', v_def;
  END IF;

  -- FK simples REMOVIDA
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.addresses'::regclass AND conname='addresses_neighborhood_id_fkey') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: FK simples addresses_neighborhood_id_fkey ainda presente.';
  END IF;
  -- nenhuma outra FK simples de neighborhood_id sozinha (que não a composta)
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.addresses'::regclass AND contype='f'
   AND confrelid='public.neighborhoods'::regclass AND pg_get_constraintdef(oid) ~ 'FOREIGN KEY \(neighborhood_id\)';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: existe FK simples de neighborhood_id (não-composta) — proibido.'; END IF;

  -- índice presente
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_addresses_city_neighborhood') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: índice idx_addresses_city_neighborhood ausente.';
  END IF;

  -- nenhum NOT NULL global adicionado a city_id/neighborhood_id (permanecem nullable)
  SELECT count(*) INTO v_cnt FROM pg_attribute WHERE attrelid='public.addresses'::regclass
   AND attname IN ('city_id','neighborhood_id') AND attnotnull;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: city_id/neighborhood_id viraram NOT NULL — proibido (matriz de nulabilidade).'; END IF;

  -- AUTO-PROVAS (sub-transações que devem FALHAR; revertem sem resíduo).
  SELECT country_id INTO v_country FROM countries LIMIT 1;
  SELECT city_id INTO v_city FROM cities LIMIT 1;
  SELECT count(*) INTO v_before FROM addresses;
  -- (a) neighborhood sem city → CHECK
  BEGIN
    INSERT INTO addresses (country_id, city_id, neighborhood_id, source) VALUES (v_country, NULL, gen_random_uuid(), 'UX_INPUT');
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova falhou — (city NULL / neighborhood) deveria violar o CHECK.';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- (b) par (city, neighborhood-inexistente) → FK composta
  IF v_city IS NOT NULL THEN
    BEGIN
      INSERT INTO addresses (country_id, city_id, neighborhood_id, source) VALUES (v_country, v_city, gen_random_uuid(), 'UX_INPUT');
      RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova falhou — (city / neighborhood inexistente) deveria violar a FK composta.';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
  END IF;
  -- zero resíduo das auto-provas
  SELECT count(*) INTO v_cnt FROM addresses;
  IF v_cnt <> v_before THEN RAISE EXCEPTION 'MIGRATION_ABORT: auto-provas deixaram resíduo em addresses (% -> %).', v_before, v_cnt; END IF;
END $$;

COMMIT;

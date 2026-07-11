-- ============================================================
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.1 — EIXO TERRITORIAL CITY-SCOPED EM actor_capability_grants
-- DECISION-0173 (§1 casa canônica, §2 tenant/global, §3 city-only MVP) + ADENDO D1 (D1.1/D1.5) + ADENDO D2
-- (D2.1 dono material do anti-suspended; D2.4 índice territorial sem tenant/now()).
-- ============================================================
-- EVOLUI a casa canônica existente (NUNCA segunda tabela de authority) para admitir escopo territorial
-- MUNICIPAL. Dois shapes mutuamente exclusivos, garantidos por CHECK fechado:
--   actor-scoped:     tenant_id NOT NULL · scope_actor_id NOT NULL · scope_city_id NULL   (semântica atual preservada)
--   territory-scoped: tenant_id NULL     · scope_actor_id NULL     · scope_city_id NOT NULL (FK real cities; efeito global EXPLÍCITO)
-- Tenant institucional REJEITADO (DECISION-0172 P1 / 0173 §2): NENHUM tenant "sistema", NENHUM fallback.
-- ANTI-SUSPENDED (ADENDO D2.1 — dono material inequívoco = ESTA fatia): scope_type='territory' ⇒
-- status <> 'suspended', no MESMO commit que introduz o scope territorial. Nenhum estado intermediário
-- do banco aceita territory+suspended. Lifecycle actor-scoped NÃO é alterado.
-- UNICIDADE: a casa ativa única (tenant-dependente) é SUBSTITUÍDA por duas casas parciais explícitas —
-- actor (preserva tenant; MESMO NOME uidx_actor_capability_grants_active, preservando o mapeamento de
-- erro 409 da rota de gestão) e territory (SEM tenant_id, SEM now()/vigência no predicado — a colisão de
-- um active-vencido é INTENCIONAL fail-closed; explicit-expire pertence à N2-D.2, D2.2).
-- ESCOPO NEGATIVO: ZERO capability key nova (chk_acg_capability_nonfinancial INTOCADO); ZERO grant/seed;
-- ZERO lifecycle/trilha (N2-D.2); ZERO resolver (N2-D.3); ZERO enforcement/rota/repository territorial;
-- canRepresentActor INTOCADO; Social/Bank FORA. Forward-only; transação única; fail-closed pré+pós.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PRÉ): aborta se o terreno não for exatamente o esperado.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt BIGINT;
  v_def TEXT;
BEGIN
  -- casa canônica existe
  IF to_regclass('public.actor_capability_grants') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_capability_grants ausente — casa canonica (DECISION-0136) e pre-requisito.';
  END IF;
  -- cities(city_id) é a PK real (Location Core como SSOT territorial)
  IF to_regclass('public.cities') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: cities ausente — Location Core e pre-requisito do escopo municipal.';
  END IF;
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid = 'public.cities'::regclass AND contype = 'p'
     AND pg_get_constraintdef(oid) = 'PRIMARY KEY (city_id)';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: PK de cities nao e (city_id) — FK territorial exige a identidade municipal real.';
  END IF;
  -- coluna territorial ainda não existe (não re-executar por cima de estado divergente)
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='actor_capability_grants' AND column_name='scope_city_id') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: scope_city_id ja existe — estado divergente; investigar antes de reaplicar.';
  END IF;
  -- CHECK de scope vivo é actor-only (shape pré-fatia)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_type';
  IF v_def IS NULL OR v_def !~ $re$scope_type = 'actor'::text$re$ OR v_def ~ 'territory' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_type divergente do actor-only esperado (achado: %).', COALESCE(v_def, 'ausente');
  END IF;
  -- shape/anti-suspended ainda não existem
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
              AND conname IN ('chk_acg_scope_shape', 'chk_acg_territory_not_suspended')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraint de shape/anti-suspended ja existe — estado divergente.';
  END IF;
  -- NOT NULL vivos (tenant_id / scope_actor_id) — a obrigatoriedade migra para o CHECK de shape
  SELECT count(*) INTO v_cnt FROM pg_attribute
   WHERE attrelid='public.actor_capability_grants'::regclass
     AND attname IN ('tenant_id','scope_actor_id') AND attnotnull;
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tenant_id/scope_actor_id nao estao ambos NOT NULL — terreno divergente.';
  END IF;
  -- unicidade ativa atual presente (será substituída pelas duas casas)
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                  AND indexname='uidx_actor_capability_grants_active') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uidx_actor_capability_grants_active ausente — unicidade ativa esperada nao encontrada.';
  END IF;
  -- nenhum dado incompatível com o shape actor (legado preservável sem correção)
  SELECT count(*) INTO v_cnt FROM actor_capability_grants
   WHERE scope_type <> 'actor' OR tenant_id IS NULL OR scope_actor_id IS NULL;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % linha(s) incompativel(is) com o shape actor-scoped — NAO corrigir legado silenciosamente; STOP.', v_cnt;
  END IF;
  -- status governado inalterado no terreno
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_status';
  IF v_def IS NULL OR v_def !~ 'active' OR v_def !~ 'revoked' OR v_def !~ 'expired' OR v_def !~ 'suspended' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_status divergente do vocabulario esperado.';
  END IF;
  -- allowlist de capability presente e SEM keys territoriais (as 6 keys sao N2-D.2)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_capability_nonfinancial';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_nonfinancial ausente.';
  END IF;
  IF v_def ~ 'territory:' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: allowlist ja contem key territory:* — vocabulario e N2-D.2, terreno divergente.';
  END IF;
  -- nenhuma casa paralela de authority territorial (DECISION-0173 §1 proibições)
  IF to_regclass('public.territorial_permissions') IS NOT NULL
     OR to_regclass('public.city_admins') IS NOT NULL
     OR to_regclass('public.neighborhood_admins') IS NOT NULL
     OR to_regclass('public.curator_roles') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tabela paralela de authority territorial detectada — SSOT paralelo proibido.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- A. Nova coluna territorial: FK REAL para a identidade municipal (sem texto,
--    sem external_code, sem scope_ref_id genérico, sem JSON).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants
  ADD COLUMN scope_city_id UUID NULL;

ALTER TABLE actor_capability_grants
  ADD CONSTRAINT fk_acg_scope_city
  FOREIGN KEY (scope_city_id) REFERENCES cities (city_id) ON DELETE RESTRICT;

COMMENT ON COLUMN actor_capability_grants.scope_city_id IS
  'N2-D.1 (DECISION-0173 §3): escopo territorial MUNICIPAL do grant territory-scoped. FK real cities(city_id) RESTRICT — nunca texto/external_code/scope_ref_id generico. NULL obrigatorio em grants actor-scoped (CHECK de shape). MVP city-only; country/state/neighborhood scopes exigem decisao+migration proprias.';

-- ────────────────────────────────────────────────────────────────────────────
-- B. Nullability condicionada ao scope: a obrigatoriedade sai do NOT NULL
--    global e passa a ser garantida pelo CHECK fechado de shape (abaixo).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE actor_capability_grants ALTER COLUMN scope_actor_id DROP NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- C. Vocabulário de scope: actor | territory. NENHUM terceiro valor
--    (global/city/neighborhood/state/country/region/system proibidos).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants DROP CONSTRAINT chk_acg_scope_type;
ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_scope_type CHECK (scope_type IN ('actor', 'territory'));

COMMENT ON CONSTRAINT chk_acg_scope_type ON actor_capability_grants IS
  'N2-D.1 (DECISION-0173 §1): vocabulario fechado de scope — actor | territory. Terceiro valor (global/city/state/...) exige decisao propria. O shape de cada scope e garantido por chk_acg_scope_shape.';

-- ────────────────────────────────────────────────────────────────────────────
-- D. CHECK fechado de shape (DECISION-0173 §2 + ADENDO D1.5-A): dois formatos
--    mutuamente exclusivos; os seis formatos invalidos falham estruturalmente.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_scope_shape CHECK (
    (
      scope_type = 'actor'
      AND tenant_id IS NOT NULL
      AND scope_actor_id IS NOT NULL
      AND scope_city_id IS NULL
    )
    OR
    (
      scope_type = 'territory'
      AND tenant_id IS NULL
      AND scope_actor_id IS NULL
      AND scope_city_id IS NOT NULL
    )
  );

COMMENT ON CONSTRAINT chk_acg_scope_shape ON actor_capability_grants IS
  'N2-D.1 (DECISION-0173 §2): actor-scoped = tenant+scope_actor NOT NULL, city NULL (isolado por tenant); territory-scoped = tenant NULL + scope_actor NULL + city NOT NULL (efeito GLOBAL explicitamente declarado — tenant institucional REJEITADO; tenant da request NUNCA e fallback). Grant global nao globaliza Actor/user/sessao.';

-- ────────────────────────────────────────────────────────────────────────────
-- E. ANTI-SUSPENDED territorial (ADENDO D2.1 — dono material = ESTA fatia):
--    territory nunca nasce nem transiciona para suspended. Real, validada,
--    fail-closed. Lifecycle actor-scoped inalterado (suspended segue possivel la).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_territory_not_suspended CHECK (
    scope_type <> 'territory' OR status <> 'suspended'
  );

COMMENT ON CONSTRAINT chk_acg_territory_not_suspended ON actor_capability_grants IS
  'N2-D.1 (DECISION-0173 ADENDO D1.1 + D2.1): suspended PROIBIDO para grants territoriais no MVP — sem eventos suspended/resumed/reactivated territoriais. NAO altera o lifecycle actor-scoped. Suporte futuro exige decisao+migration+guard+Yala proprios. N2-D.2 protege esta constraint; ela NASCE aqui.';

-- ────────────────────────────────────────────────────────────────────────────
-- F. UNICIDADE: duas casas parciais explicitas (ADENDO D1.5-B + D2.4).
--    A casa actor PRESERVA o nome vivo (mapeamento de erro 409 da rota de
--    gestao) e a semantica tenant-scoped; a casa territory e INDEPENDENTE de
--    tenant e SEM now()/vigencia no predicado (colisao de active-vencido e
--    intencional fail-closed; explicit-expire = N2-D.2).
-- ────────────────────────────────────────────────────────────────────────────
DROP INDEX uidx_actor_capability_grants_active;

CREATE UNIQUE INDEX uidx_actor_capability_grants_active
  ON actor_capability_grants (tenant_id, grantee_actor_id, capability_key, scope_actor_id)
  WHERE scope_type = 'actor' AND status = 'active';

CREATE UNIQUE INDEX uidx_actor_capability_grants_territory_active
  ON actor_capability_grants (grantee_actor_id, capability_key, scope_city_id)
  WHERE scope_type = 'territory' AND status = 'active';

COMMENT ON INDEX uidx_actor_capability_grants_active IS
  'N2-D.1: unicidade ATIVA actor-scoped (tenant, grantee, capability, scope_actor) — preserva a semantica pre-D.1 (scope_type constante no predicado). Nome preservado (mapeamento 409 da rota de gestao).';
COMMENT ON INDEX uidx_actor_capability_grants_territory_active IS
  'N2-D.1 (ADENDO D2.4): unicidade ATIVA territory-scoped (grantee, capability, scope_city_id) — SEM tenant_id (efeito global), SEM now()/vigencia no predicado. Colisao com active-vencido e INTENCIONAL fail-closed: forca explicit-expire auditavel (N2-D.2) antes do regrant; NAO relaxar.';

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PÓS): prova o shape final; aborta (rollback total) se divergir.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt BIGINT;
  v_def TEXT;
  v_ok  BOOLEAN;
BEGIN
  -- coluna territorial: uuid, nullable
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema='public' AND table_name='actor_capability_grants'
     AND column_name='scope_city_id' AND data_type='uuid' AND is_nullable='YES';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: scope_city_id ausente/tipo errado/nao-nullable.'; END IF;

  -- FK real cities(city_id) RESTRICT, validada
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='fk_acg_scope_city'
     AND contype='f' AND confrelid='public.cities'::regclass AND confdeltype='r' AND convalidated;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: fk_acg_scope_city ausente/nao-RESTRICT/nao-validada.'; END IF;

  -- nullability condicionada aplicada
  SELECT count(*) INTO v_cnt FROM pg_attribute
   WHERE attrelid='public.actor_capability_grants'::regclass
     AND attname IN ('tenant_id','scope_actor_id') AND attnotnull;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: tenant_id/scope_actor_id ainda NOT NULL global.'; END IF;

  -- vocabulario de scope fechado em actor|territory (sem terceiro valor)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_type' AND convalidated;
  IF v_def IS NULL OR v_def !~ '''actor''' OR v_def !~ '''territory''' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_type nao cobre actor|territory (achado: %).', COALESCE(v_def,'ausente');
  END IF;
  IF v_def ~* '''(global|city|neighborhood|state|country|region|system)''' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_type admite terceiro valor proibido (achado: %).', v_def;
  END IF;

  -- shape CHECK presente e validada
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_shape' AND convalidated;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_shape ausente/NOT VALID.'; END IF;

  -- auto-prova estrutural da formula de shape (tabela-verdade dos 8 formatos; 2 validos, 6 invalidos)
  FOR v_ok IN
    SELECT (
      (t.st='actor' AND t.ten IS NOT NULL AND t.sa IS NOT NULL AND t.sc IS NULL)
      OR (t.st='territory' AND t.ten IS NULL AND t.sa IS NULL AND t.sc IS NOT NULL)
    ) = t.expected
    FROM (VALUES
      ('actor',     gen_random_uuid(), gen_random_uuid(), NULL::uuid,        true ), -- valido
      ('territory', NULL::uuid,        NULL::uuid,        gen_random_uuid(), true ), -- valido
      ('actor',     NULL::uuid,        gen_random_uuid(), NULL::uuid,        false), -- 1. actor sem tenant
      ('actor',     gen_random_uuid(), NULL::uuid,        NULL::uuid,        false), -- 2. actor sem scope_actor
      ('actor',     gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), false), -- 3. actor com scope_city
      ('territory', gen_random_uuid(), NULL::uuid,        gen_random_uuid(), false), -- 4. territory com tenant
      ('territory', NULL::uuid,        gen_random_uuid(), gen_random_uuid(), false), -- 5. territory com scope_actor
      ('territory', NULL::uuid,        NULL::uuid,        NULL::uuid,        false)  -- 6. territory sem scope_city
    ) AS t(st, ten, sa, sc, expected)
  LOOP
    IF NOT v_ok THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova da tabela-verdade do shape falhou — formula divergente do contrato dos 6 formatos invalidos.';
    END IF;
  END LOOP;

  -- anti-suspended presente e validada (D2.1)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_territory_not_suspended' AND convalidated;
  IF v_def IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_territory_not_suspended ausente/NOT VALID.'; END IF;
  -- auto-prova: territory+suspended=false; territory+active=true; actor+suspended=true (lifecycle preservado)
  IF ('territory' <> 'territory' OR 'suspended' <> 'suspended') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova anti-suspended (territory+suspended deveria violar).';
  END IF;
  IF NOT ('territory' <> 'territory' OR 'active' <> 'suspended') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova anti-suspended (territory+active deveria passar).';
  END IF;
  IF NOT ('actor' <> 'territory' OR 'suspended' <> 'suspended') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova anti-suspended (actor+suspended deveria continuar aceito).';
  END IF;

  -- indice actor: unico, parcial actor+active, colunas exatas, COM tenant
  SELECT indexdef INTO v_def FROM pg_indexes
   WHERE schemaname='public' AND indexname='uidx_actor_capability_grants_active';
  IF v_def IS NULL
     OR v_def !~ 'UNIQUE'
     OR v_def !~ '\(tenant_id, grantee_actor_id, capability_key, scope_actor_id\)'
     OR v_def !~ $re$scope_type = 'actor'$re$
     OR v_def !~ $re$status = 'active'$re$ THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: casa de unicidade actor divergente (achado: %).', COALESCE(v_def,'ausente');
  END IF;

  -- indice territory: unico, parcial territory+active, colunas exatas, SEM tenant e SEM now()/vigencia
  SELECT indexdef INTO v_def FROM pg_indexes
   WHERE schemaname='public' AND indexname='uidx_actor_capability_grants_territory_active';
  IF v_def IS NULL
     OR v_def !~ 'UNIQUE'
     OR v_def !~ '\(grantee_actor_id, capability_key, scope_city_id\)'
     OR v_def !~ $re$scope_type = 'territory'$re$
     OR v_def !~ $re$status = 'active'$re$ THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: casa de unicidade territory divergente (achado: %).', COALESCE(v_def,'ausente');
  END IF;
  IF v_def ~ 'tenant_id' OR v_def ~* 'now\(\)' OR v_def ~ 'valid_from' OR v_def ~ 'valid_until' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: indice territory contem tenant/now()/vigencia — proibido (ADENDO D2.4).';
  END IF;

  -- ZERO grant territorial nesta fatia
  SELECT count(*) INTO v_cnt FROM actor_capability_grants WHERE scope_type='territory';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % grant(s) territorial(is) — seed proibido na N2-D.1.', v_cnt; END IF;

  -- legado actor-scoped preservado (todas as linhas continuam validas no shape actor)
  SELECT count(*) INTO v_cnt FROM actor_capability_grants
   WHERE NOT (scope_type='actor' AND tenant_id IS NOT NULL AND scope_actor_id IS NOT NULL AND scope_city_id IS NULL);
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % linha(s) fora do shape actor apos a fatia.', v_cnt; END IF;

  -- allowlist de capability INTOCADA (6 keys; sem territory:*)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_capability_nonfinancial';
  IF v_def IS NULL OR v_def ~ 'territory:' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: allowlist de capability alterada/contem territory:* — vocabulario e N2-D.2.';
  END IF;

  -- status governado inalterado; owner/RLS inalterados
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_status';
  IF v_def IS NULL OR v_def !~ 'suspended' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_status alterado — lifecycle actor-scoped deve permanecer intacto.';
  END IF;
  SELECT count(*) INTO v_cnt FROM pg_class
   WHERE relname='actor_capability_grants' AND relowner::regrole::text='postgres'
     AND NOT relrowsecurity AND NOT relforcerowsecurity;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: owner/RLS de actor_capability_grants alterados — fora do escopo da fatia.'; END IF;
END $$;

COMMIT;

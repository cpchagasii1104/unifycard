-- ============================================================
-- B-CITY-2 / FINANCIAL-AUTHORITY-GRANT-MODEL — SUBSTRATO DORMENTE DE AUTORIDADE FINANCEIRA REGIONAL
-- DECISION-0185 (casa canonica unica; 3o scope_type fechado regional_treasury; matriz particionada;
-- shape tenant+city; unicidade ativa regional). Complementa DECISION-0136/0173/0184 — NUNCA reescreve.
-- ============================================================
-- EVOLUI a casa canonica actor_capability_grants — NUNCA segunda tabela de authority (DECISION-0185 D1).
-- Adiciona um TERCEIRO scope FECHADO 'regional_treasury' (financeiro · city+tenant-scoped) que admite
-- EXATAMENTE duas Authority Grant Keys financeiras (treasury:regional_policy_manage,
-- treasury:regional_fund_activation_manage). As 12 keys nao-financeiras atuais permanecem intactas.
--
-- CONTRATO FISICO (DECISION-0185 D2/D3/D5/D6/D9):
--   (1) chk_acg_scope_type       : actor | territory | regional_treasury (3o valor; nenhum quarto/alias/wildcard).
--   (2) chk_acg_scope_shape      : +ramo regional_treasury = tenant NOT NULL · scope_actor_id NULL · scope_city_id NOT NULL.
--   (3) chk_acg_capability_nonfinancial : deixa de ser incondicional; vira IMPLICACAO fechada
--       scope_type IN ('actor','territory') => capability_key IN (as 12 atuais). regional_treasury nao entra aqui.
--   (4) chk_acg_capability_regional_treasury (NOVO, fechado) : scope_type='regional_treasury' => as 2 keys financeiras exatas.
--   (5) chk_acg_scope_capability_matrix : +ramo fechado regional_treasury => as 2 keys financeiras.
--   (6) uidx_actor_capability_grants_regional_treasury_active : unicidade ATIVA regional
--       (tenant_id, grantee_actor_id, capability_key, scope_city_id) WHERE regional_treasury AND active.
--       tenant_id ENTRA no predicado (DECISION-0185 D3/D9: financeiro e tenant-scoped, ao contrario do territory global).
--
-- ESCOPO NEGATIVO (DECISION-0185 D14/D15/D18/D20; GO secoes 9/10): ZERO grant/seed regional; ZERO writer
-- (nenhuma fn_* nova — o substrato nasce SEM porta de escrita, dormente); ZERO policy/PORTA/conta/caller/
-- movimentacao; permission-keys.ts INTOCADO; TreasuryOperationSource INTOCADO; Bank/FISCAL-4E FORA; ACL/RLS/
-- lifecycle/eventos/triggers da D.1/D.2 PRESERVADOS byte-a-byte (nenhum DROP/ALTER neles). Curitiba-first e um
-- contrato de MATERIAL (fixture/prova), nao de schema — o schema e genericamente city-scoped (DECISION-0185 D17).
-- Forward-only, aditiva; transacao unica; fail-closed pre+pos com auto-prova de tabela-verdade.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PRE): aborta se o terreno nao for exatamente o estado pos-N2-D.2.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt BIGINT;
  v_def TEXT;
BEGIN
  IF to_regclass('public.actor_capability_grants') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_capability_grants ausente — casa canonica (DECISION-0136) e pre-requisito.';
  END IF;
  IF to_regclass('public.cities') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: cities ausente — Location Core e pre-requisito do escopo municipal.';
  END IF;

  -- scope_type vivo = actor|territory (sem regional_treasury ainda)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_type';
  IF v_def IS NULL OR v_def !~ '''actor''' OR v_def !~ '''territory''' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_type divergente do actor|territory esperado (achado: %).', COALESCE(v_def,'ausente');
  END IF;
  IF v_def ~ 'regional_treasury' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_type ja contem regional_treasury — reaplicacao/estado divergente.';
  END IF;

  -- allowlist de existencia = 12 keys nao-financeiras, INCONDICIONAL, sem treasury:*
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_capability_nonfinancial';
  IF v_def IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_nonfinancial ausente.'; END IF;
  IF v_def !~ 'territory:register_neighborhood_succession' OR v_def !~ 'service_order:view' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: allowlist nao contem as 12 keys esperadas (terreno divergente).';
  END IF;
  IF v_def ~ 'treasury:' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: allowlist ja contem treasury:* — estado divergente/reaplicacao.';
  END IF;
  IF v_def ~ 'scope_type' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_nonfinancial ja e condicional por scope — reaplicacao/estado divergente.';
  END IF;

  -- matriz viva = 2 ramos (actor|territory), sem regional_treasury
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_capability_matrix';
  IF v_def IS NULL OR v_def !~ $re$scope_type = 'actor'$re$ OR v_def !~ $re$scope_type = 'territory'$re$ THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_capability_matrix divergente dos 2 ramos esperados.';
  END IF;
  IF v_def ~ 'regional_treasury' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: matriz ja contem regional_treasury — estado divergente.';
  END IF;

  -- shape vivo = 2 ramos (actor|territory), sem regional_treasury
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_shape';
  IF v_def IS NULL OR v_def ~ 'regional_treasury' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_shape ausente ou ja contem regional_treasury — estado divergente.';
  END IF;

  -- objetos novos ainda nao existem (idempotencia contra reaplicacao com estado divergente)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
              AND conname='chk_acg_capability_regional_treasury') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_regional_treasury ja existe — estado divergente.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
              AND indexname='uidx_actor_capability_grants_regional_treasury_active') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uidx_actor_capability_grants_regional_treasury_active ja existe — estado divergente.';
  END IF;

  -- shape/lifecycle da D.1/D.2 intactos (pre-requisito; nao serao tocados)
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
   AND conname IN ('chk_acg_scope_shape','chk_acg_territory_not_suspended','fk_acg_scope_city',
                   'chk_acg_scope_type','chk_acg_revoke_reason_shape');
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraints da D.1/D.2 incompletas/divergentes (achado % de 5).', v_cnt;
  END IF;
  SELECT count(*) INTO v_cnt FROM pg_indexes WHERE schemaname='public'
   AND indexname IN ('uidx_actor_capability_grants_active','uidx_actor_capability_grants_territory_active');
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: indices ativos da D.1 incompletos/divergentes.';
  END IF;

  -- nenhum grant regional_treasury preexistente
  SELECT count(*) INTO v_cnt FROM actor_capability_grants WHERE scope_type='regional_treasury';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % grant(s) regional_treasury preexistente(s) — terreno divergente.', v_cnt;
  END IF;

  -- FRONTEIRA DE ESCRITA da D.2 intacta: app SEM DML direto (nenhum grant real e possivel — dormencia por construcao)
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='actor_capability_grants' AND grantee='unificard_app' AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app possui DML direto em actor_capability_grants — fronteira da D.2 divergente.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- A. SCOPE TYPE: vocabulario fechado actor | territory | regional_treasury.
--    Nenhum quarto valor; nenhum alias (financial/treasury/regional_finance/city_treasury); nenhum wildcard.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants DROP CONSTRAINT chk_acg_scope_type;
ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_scope_type CHECK (scope_type IN ('actor', 'territory', 'regional_treasury'));

COMMENT ON CONSTRAINT chk_acg_scope_type ON actor_capability_grants IS
  'DECISION-0185 D2: vocabulario fechado de scope — actor | territory | regional_treasury. regional_treasury e financeiro, city+tenant-scoped, fechado; NAO e subtipo de territory. Quarto valor/alias/wildcard exige decisao propria. Shape por chk_acg_scope_shape; compatibilidade por chk_acg_scope_capability_matrix.';

-- ────────────────────────────────────────────────────────────────────────────
-- B. SHAPE: +ramo regional_treasury = tenant NOT NULL + scope_actor_id NULL + scope_city_id NOT NULL.
--    actor e territory PRESERVADOS byte-a-byte. Tres formatos mutuamente exclusivos.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants DROP CONSTRAINT chk_acg_scope_shape;
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
    OR
    (
      scope_type = 'regional_treasury'
      AND tenant_id IS NOT NULL
      AND scope_actor_id IS NULL
      AND scope_city_id IS NOT NULL
    )
  );

COMMENT ON CONSTRAINT chk_acg_scope_shape ON actor_capability_grants IS
  'DECISION-0185 D3: tres shapes mutuamente exclusivos. actor = tenant+scope_actor (city NULL); territory = city NOT NULL, tenant/scope_actor NULL (global); regional_treasury = tenant NOT NULL + scope_city_id NOT NULL + scope_actor_id NULL (financeiro tenant+city-scoped — tenant NAO e NULL, ao contrario de territory: NULL globalizaria a autoridade financeira sobre todos os tenants da cidade). scope_city_id via fk_acg_scope_city (cities). grantee_actor_id (quem recebe) e independente de scope_actor_id.';

-- ────────────────────────────────────────────────────────────────────────────
-- C. EXISTENCIA NAO-FINANCEIRA: deixa de ser incondicional; vira implicacao fechada
--    scope_type IN ('actor','territory') => as 12 keys atuais. regional_treasury nao passa por aqui
--    (sua existencia e garantida por chk_acg_capability_regional_treasury). As 12 keys ficam INTACTAS.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants DROP CONSTRAINT chk_acg_capability_nonfinancial;
ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_capability_nonfinancial CHECK (
    scope_type NOT IN ('actor', 'territory')
    OR capability_key IN (
      'calendar:block',
      'calendar:unblock',
      'services:create',
      'services:edit',
      'services:disable',
      'service_order:view',
      'territory:create_neighborhood',
      'territory:approve_neighborhood',
      'territory:correct_neighborhood',
      'territory:deactivate_neighborhood',
      'territory:manage_neighborhood_aliases',
      'territory:register_neighborhood_succession'
    )
  );

COMMENT ON CONSTRAINT chk_acg_capability_nonfinancial ON actor_capability_grants IS
  'DECISION-0185 D6: existencia das 12 keys NAO-FINANCEIRAS, agora IMPLICACAO fechada guardada por scope (actor|territory => as 12; vacuo para regional_treasury). As 12 keys permanecem byte-intactas (6 actor + 6 territory:*). PROIBIDO conter capability financeira. regional_treasury tem CHECK proprio (chk_acg_capability_regional_treasury).';

-- ────────────────────────────────────────────────────────────────────────────
-- D. EXISTENCIA FINANCEIRA REGIONAL (NOVO, fechado): regional_treasury => EXATAMENTE as 2 keys.
--    Nenhuma terceira key; nenhum treasury:*; nenhum prefix/startsWith; nenhum alias.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_capability_regional_treasury CHECK (
    scope_type <> 'regional_treasury'
    OR capability_key IN (
      'treasury:regional_policy_manage',
      'treasury:regional_fund_activation_manage'
    )
  );

COMMENT ON CONSTRAINT chk_acg_capability_regional_treasury ON actor_capability_grants IS
  'DECISION-0185 D5/D7: existencia FECHADA das 2 Authority Grant Keys financeiras regionais — treasury:regional_policy_manage (lifecycle da policy) + treasury:regional_fund_activation_manage (PORTA). Ambas CRITICAL_FINANCIAL, separadas e nao fusiveis. Correspondencia por conjunto EXATO, nunca prefixo/wildcard/startsWith. Espelho fisico de REGIONAL_TREASURY_CAPABILITY_KEYS (actor-capability-grant.types.ts). NAO registrar em permission-keys.ts nem TreasuryOperationSource.';

-- ────────────────────────────────────────────────────────────────────────────
-- E. MATRIZ scope x capability: +ramo fechado regional_treasury => as 2 keys financeiras.
--    actor => 6 actor-scoped; territory => 6 territoriais; regional_treasury => 2 financeiras. Conjuntos EXATOS.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants DROP CONSTRAINT chk_acg_scope_capability_matrix;
ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_scope_capability_matrix CHECK (
    (
      scope_type = 'actor'
      AND capability_key IN (
        'calendar:block',
        'calendar:unblock',
        'services:create',
        'services:edit',
        'services:disable',
        'service_order:view'
      )
    )
    OR
    (
      scope_type = 'territory'
      AND capability_key IN (
        'territory:create_neighborhood',
        'territory:approve_neighborhood',
        'territory:correct_neighborhood',
        'territory:deactivate_neighborhood',
        'territory:manage_neighborhood_aliases',
        'territory:register_neighborhood_succession'
      )
    )
    OR
    (
      scope_type = 'regional_treasury'
      AND capability_key IN (
        'treasury:regional_policy_manage',
        'treasury:regional_fund_activation_manage'
      )
    )
  );

COMMENT ON CONSTRAINT chk_acg_scope_capability_matrix ON actor_capability_grants IS
  'DECISION-0185 D5: matriz FECHADA e PARTICIONADA scope_type x capability_key (3 ramos, conjuntos EXATOS, nunca prefixo/wildcard). actor => 6 actor-scoped; territory => 6 territoriais; regional_treasury => 2 financeiras. Impede capability financeira em actor/territory e capability nao-financeira em regional_treasury. Coexiste com chk_acg_scope_shape, chk_acg_capability_nonfinancial e chk_acg_capability_regional_treasury.';

-- ────────────────────────────────────────────────────────────────────────────
-- F. UNICIDADE ATIVA REGIONAL: (tenant_id, grantee_actor_id, capability_key, scope_city_id)
--    WHERE regional_treasury AND active. tenant_id ENTRA no predicado (DECISION-0185 D3/D9 — financeiro e
--    tenant-scoped, ao contrario da casa territory global). Preserva historico (parcial em active).
-- ────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX uidx_actor_capability_grants_regional_treasury_active
  ON actor_capability_grants (tenant_id, grantee_actor_id, capability_key, scope_city_id)
  WHERE scope_type = 'regional_treasury' AND status = 'active';

COMMENT ON INDEX uidx_actor_capability_grants_regional_treasury_active IS
  'DECISION-0185 D9: unicidade ATIVA regional (tenant_id, grantee_actor_id, capability_key, scope_city_id) — COM tenant_id (financeiro tenant-scoped, diferente do indice territory global sem tenant). Parcial em status=active: preserva lifecycle historico (revoked/expired nao colidem). Sem now()/vigencia no predicado (explicit-expire pertence ao lifecycle canonico).';

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (POS): prova o shape final + tabela-verdade; aborta (rollback total) se divergir.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt BIGINT;
  v_def TEXT;
  v_ok  BOOLEAN;
BEGIN
  -- scope_type: 3 valores, com regional_treasury, sem quarto proibido
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_type' AND convalidated;
  IF v_def IS NULL OR v_def !~ '''actor''' OR v_def !~ '''territory''' OR v_def !~ 'regional_treasury' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_type nao cobre actor|territory|regional_treasury (achado: %).', COALESCE(v_def,'ausente');
  END IF;
  IF v_def ~* '''(global|city|neighborhood|state|country|region|system|financial|treasury|city_treasury|regional_finance)''' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_type admite valor/alias proibido (achado: %).', v_def;
  END IF;

  -- shape: presente/validada + auto-prova da tabela-verdade dos 3 formatos validos + invalidos
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_shape' AND convalidated;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_shape ausente/NOT VALID.'; END IF;
  FOR v_ok IN
    SELECT (
      (t.st='actor' AND t.ten IS NOT NULL AND t.sa IS NOT NULL AND t.sc IS NULL)
      OR (t.st='territory' AND t.ten IS NULL AND t.sa IS NULL AND t.sc IS NOT NULL)
      OR (t.st='regional_treasury' AND t.ten IS NOT NULL AND t.sa IS NULL AND t.sc IS NOT NULL)
    ) = t.expected
    FROM (VALUES
      ('actor',             gen_random_uuid(), gen_random_uuid(), NULL::uuid,        true ), -- valido
      ('territory',         NULL::uuid,        NULL::uuid,        gen_random_uuid(), true ), -- valido
      ('regional_treasury', gen_random_uuid(), NULL::uuid,        gen_random_uuid(), true ), -- valido
      ('regional_treasury', NULL::uuid,        NULL::uuid,        gen_random_uuid(), false), -- rt sem tenant
      ('regional_treasury', gen_random_uuid(), NULL::uuid,        NULL::uuid,        false), -- rt sem city
      ('regional_treasury', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), false), -- rt com scope_actor
      ('actor',             gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), false), -- actor com city
      ('territory',         gen_random_uuid(), NULL::uuid,        gen_random_uuid(), false)  -- territory com tenant
    ) AS t(st, ten, sa, sc, expected)
  LOOP
    IF NOT v_ok THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova da tabela-verdade do shape (3-way) falhou.';
    END IF;
  END LOOP;

  -- nonfinancial: agora condicional por scope; 12 keys presentes; sem treasury:*
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_capability_nonfinancial' AND convalidated;
  IF v_def IS NULL OR v_def !~ 'scope_type' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_nonfinancial nao virou implicacao por scope.';
  END IF;
  IF v_def !~ 'territory:register_neighborhood_succession' OR v_def !~ 'service_order:view' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_nonfinancial perdeu alguma das 12 keys.';
  END IF;
  IF v_def ~ 'treasury:' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_nonfinancial contem treasury:* (proibido).';
  END IF;

  -- regional_treasury check: presente/validada, exatamente 2 keys, sem terceira/wildcard
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_capability_regional_treasury' AND convalidated;
  IF v_def IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_regional_treasury ausente/NOT VALID.'; END IF;
  IF v_def !~ 'treasury:regional_policy_manage' OR v_def !~ 'treasury:regional_fund_activation_manage' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_regional_treasury nao contem as 2 keys exatas.';
  END IF;
  SELECT count(*) INTO v_cnt FROM regexp_matches(v_def, 'treasury:[a-z_]+', 'g');
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_regional_treasury tem % keys treasury (esperado 2).', v_cnt; END IF;
  IF v_def ~ '%' OR v_def ~* 'like|~~' THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_regional_treasury usa prefixo/LIKE (proibido).'; END IF;

  -- matriz: 3 ramos, regional_treasury => 2 keys
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_capability_matrix' AND convalidated;
  IF v_def IS NULL OR v_def !~ $re$scope_type = 'actor'$re$ OR v_def !~ $re$scope_type = 'territory'$re$
     OR v_def !~ $re$scope_type = 'regional_treasury'$re$ THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: matriz nao cobre os 3 ramos de scope.';
  END IF;
  IF v_def !~ 'treasury:regional_policy_manage' OR v_def !~ 'treasury:regional_fund_activation_manage' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ramo regional_treasury da matriz sem as 2 keys.';
  END IF;

  -- indice de unicidade regional: unico, parcial regional_treasury+active, colunas exatas COM tenant, sem now()/vigencia
  SELECT indexdef INTO v_def FROM pg_indexes
   WHERE schemaname='public' AND indexname='uidx_actor_capability_grants_regional_treasury_active';
  IF v_def IS NULL
     OR v_def !~ 'UNIQUE'
     OR v_def !~ '\(tenant_id, grantee_actor_id, capability_key, scope_city_id\)'
     OR v_def !~ $re$scope_type = 'regional_treasury'$re$
     OR v_def !~ $re$status = 'active'$re$ THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uidx_actor_capability_grants_regional_treasury_active divergente (achado: %).', COALESCE(v_def,'ausente');
  END IF;
  IF v_def ~* 'now\(\)' OR v_def ~ 'valid_from' OR v_def ~ 'valid_until' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: indice regional contem now()/vigencia — proibido.';
  END IF;

  -- shapes/lifecycle da D.1/D.2 preservados (nenhum tocado)
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
   AND conname IN ('chk_acg_territory_not_suspended','fk_acg_scope_city','chk_acg_revoke_reason_shape','chk_acg_status');
  IF v_cnt <> 4 THEN RAISE EXCEPTION 'MIGRATION_ABORT: constraint da D.1/D.2 alterada/ausente (achado % de 4).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM pg_indexes WHERE schemaname='public'
   AND indexname IN ('uidx_actor_capability_grants_active','uidx_actor_capability_grants_territory_active');
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'MIGRATION_ABORT: indices ativos da D.1 alterados.'; END IF;

  -- imutabilidade + eventos + 4 funcoes canonicas intactos (nenhuma funcao nova/alterada aqui)
  SELECT count(*) INTO v_cnt FROM pg_trigger WHERE tgrelid='public.actor_capability_grants'::regclass AND tgname='trg_acg_immutability';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: trg_acg_immutability alterado/ausente.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_proc WHERE pronamespace='public'::regnamespace
   AND proname IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant',
                    'fn_expire_actor_capability_grant','fn_regrant_actor_capability');
  IF v_cnt <> 4 THEN RAISE EXCEPTION 'MIGRATION_ABORT: funcoes canonicas da D.2 alteradas (achado % de 4).', v_cnt; END IF;

  -- FRONTEIRA DE ESCRITA preservada: app SEM DML direto (substrato dormente — nenhum grant real e possivel)
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='actor_capability_grants' AND grantee='unificard_app' AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app ganhou DML direto — fronteira de escrita violada.'; END IF;

  -- ZERO grant regional_treasury real nesta fatia (substrato dormente)
  SELECT count(*) INTO v_cnt FROM actor_capability_grants WHERE scope_type='regional_treasury';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % grant(s) regional_treasury — seed proibido (dormente).', v_cnt; END IF;

  -- legado preservado: todas as linhas continuam validas nos shapes actor/territory
  SELECT count(*) INTO v_cnt FROM actor_capability_grants
   WHERE NOT (
     (scope_type='actor' AND tenant_id IS NOT NULL AND scope_actor_id IS NOT NULL AND scope_city_id IS NULL)
     OR (scope_type='territory' AND tenant_id IS NULL AND scope_actor_id IS NULL AND scope_city_id IS NOT NULL)
   );
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % linha(s) legada(s) fora dos shapes actor/territory apos a fatia.', v_cnt; END IF;
END $$;

COMMIT;

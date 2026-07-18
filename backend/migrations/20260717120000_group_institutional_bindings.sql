-- ============================================================
-- D9.1 / F-ORGANIZATIONAL-ACTOR-COMPOSITION — GROUP INSTITUTIONAL BINDING (DECISION-0186 + DECISION-0187)
-- Casa canonica UNICA e FUTURA do vinculo Group interno -> Actor organizacional institucional.
--
-- O QUE E (DECISION-0187 D1/D2): tabela dedicada ESTREITA group_institutional_bindings —
--   group_id -> groups.id  ·  institution_actor_id -> actors.id (page formal | group-actor RAIZ informal).
--   Composicao com vigencia: lifecycle active->retired append-only; reparent = retire + NOVA linha;
--   historico civil preservado (DELETE proibido; retired TERMINAL; campos decisorios imutaveis).
--
-- O QUE NAO E (DECISION-0187 D1/D9): membership · relacao social (actor_relationships INTOCADA) ·
--   GRAPH · authority (zero capability/grant; canRepresentActor INALTERADO) · delegacao · endereco ·
--   conta · estrutura financeira (Bank INTOCADO; Δbank=0) · revival de organization_* (tombstones
--   permanecem ausentes; blanket 501 intacto). O vinculo NAO concede/herda NADA (D9 nao-heranca).
--
-- ESCRITA GOVERNADA (padrao selado das casas 0136/N2-D.2, migration 20260711170000):
--   unificard_app SEM INSERT/UPDATE/DELETE diretos; escrita SOMENTE pelas funcoes canonicas
--   SECURITY DEFINER (search_path pinado, EXECUTE governado):
--     fn_bind_group_to_institution(...)      — cria vinculo (idempotente por chave+fingerprint)
--     fn_retire_group_institutional_binding(...) — retira (terminal; idempotente)
--     fn_reparent_group_institution(...)     — retire+bind ATOMICO reutilizando as DUAS primitivas
--   Autoridade dual (canRepresentActor dos DOIS lados) e provada no service (camada canonica de
--   authority §4.9); as funcoes revalidam TODOS os fatos ESTRUTURAIS sob lock na mesma transacao.
--
-- COERENCIA TENANT COMPOSTA (nao apenas FK simples): candidate keys minimas (tenant_id,id) em
--   groups e actors (SUPORTE MINIMO NOVO — registrado; zero mudanca de semantica/lifecycle/RLS
--   das tabelas existentes) + FKs compostas na casa nova + fn_assert_actors_in_tenant (REUSO da
--   helper selada 20260711190000; FOR SHARE deterministico; erro nao-vazante).
--
-- ANTI-CICLO V1 (DECISION-0187 D5): parent so page|group-RAIZ; self-link proibido; Group interno
--   nao e parent; Group com filhos ativos nao recebe parent; cadeia/ciclo proibidos; serializacao
--   por advisory lock transacional POR TENANT (ordem deterministica; sem deadlock; sem TOCTOU).
--
-- FORWARD-ONLY · TRANSACIONAL · HARD-FAIL (Lei 3: sem IF NOT EXISTS permissivo em objetos novos;
-- preflight aborta em estado divergente). SEM seed · SEM backfill · SEM vinculo real ·
-- NAO aplicar em unificard_dev (prova SOMENTE em clone efemero). Δbank=0.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- PREFLIGHT FAIL-CLOSED: terreno exato exigido pela DECISION-0187.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  IF to_regclass('public.group_institutional_bindings') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: group_institutional_bindings ja existe — estado divergente.';
  END IF;
  IF to_regclass('public.groups') IS NULL OR to_regclass('public.actors') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: groups/actors/tenants ausentes.';
  END IF;
  -- 1:1 Group<->group-actor selado (3C.3) presente
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='actors' AND indexname='uq_actors_group') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uq_actors_group ausente (3C.3 nao aplicada).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='groups' AND indexname='uq_groups_actor') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uq_groups_actor ausente (3C.3 nao aplicada).';
  END IF;
  -- helper de coerencia tenant (REUSO — 20260711190000)
  IF to_regprocedure('public.fn_assert_actors_in_tenant(uuid,uuid[])') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_assert_actors_in_tenant ausente (R2 nao aplicada).';
  END IF;
  -- role de runtime existe (fronteira de escrita depende dele)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unificard_app') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: role unificard_app ausente.';
  END IF;
  -- groups NAO tem coluna institucional paralela (D1 rejeitou coluna)
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema='public' AND table_name='groups'
     AND column_name ~ '(institution|parent|organization)';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: groups possui coluna institucional/parent (% col) — casa paralela.', v_cnt;
  END IF;
  -- candidate keys de suporte ainda nao existem (esta migration as cria)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('uq_groups_tenant_id_id','uq_actors_tenant_id_id')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: candidate key de suporte ja existe — estado divergente.';
  END IF;
  -- funcoes canonicas ainda nao existem
  IF to_regprocedure('public.fn_bind_group_to_institution(uuid,uuid,uuid,uuid,text)') IS NOT NULL
     OR to_regprocedure('public.fn_retire_group_institutional_binding(uuid,uuid,uuid,text)') IS NOT NULL
     OR to_regprocedure('public.fn_reparent_group_institution(uuid,uuid,uuid,uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: funcao canonica do binding ja existe — estado divergente.';
  END IF;
  -- organization_* segue tombstone (D6 da 0186)
  IF to_regclass('public.organization_members') IS NOT NULL OR to_regclass('public.organization_units') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: organization_* materializada — violacao da DECISION-0186 D6.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. SUPORTE MINIMO DE COERENCIA COMPOSTA (REGISTRADO): candidate keys (tenant_id,id).
--    (id) ja e PK — a unicidade composta e trivialmente verdadeira; o constraint existe APENAS
--    como alvo de FK composta. Zero mudanca de semantica/lifecycle/RLS de groups/actors.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE groups ADD CONSTRAINT uq_groups_tenant_id_id UNIQUE (tenant_id, id);
ALTER TABLE actors ADD CONSTRAINT uq_actors_tenant_id_id UNIQUE (tenant_id, id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. TABELA CANONICA (DECISION-0187 D1/D2/D3/D6)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE group_institutional_bindings (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID        NOT NULL REFERENCES tenants(id),
  group_id               UUID        NOT NULL,
  institution_actor_id   UUID        NOT NULL,
  status                 TEXT        NOT NULL DEFAULT 'active'
    CONSTRAINT chk_gib_status CHECK (status IN ('active', 'retired')),
  -- idempotencia de criacao: chave do chamador + fingerprint deterministico dos campos decisorios
  create_idempotency_key TEXT        NOT NULL,
  create_fingerprint     TEXT        NOT NULL,
  created_by_actor_id    UUID        NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- retirada (terminal): so preenchida UMA vez, nunca alterada/apagada depois (trigger)
  retire_idempotency_key TEXT,
  retired_by_actor_id    UUID,
  retired_at             TIMESTAMPTZ,
  -- shape fisico do lifecycle (DECISION-0187 D6 / envelope §5)
  CONSTRAINT chk_gib_lifecycle_shape CHECK (
    (status = 'active'  AND retired_at IS NULL     AND retired_by_actor_id IS NULL     AND retire_idempotency_key IS NULL)
    OR
    (status = 'retired' AND retired_at IS NOT NULL AND retired_by_actor_id IS NOT NULL AND retire_idempotency_key IS NOT NULL)
  ),
  -- coerencia tenant COMPOSTA (nao apenas FK simples): todos os participantes no MESMO tenant
  CONSTRAINT fk_gib_group_tenant       FOREIGN KEY (tenant_id, group_id)             REFERENCES groups (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gib_institution_tenant FOREIGN KEY (tenant_id, institution_actor_id) REFERENCES actors (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gib_created_by_tenant  FOREIGN KEY (tenant_id, created_by_actor_id)  REFERENCES actors (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gib_retired_by_tenant  FOREIGN KEY (tenant_id, retired_by_actor_id)  REFERENCES actors (tenant_id, id) ON DELETE RESTRICT
);

COMMENT ON TABLE group_institutional_bindings IS
  'D9.1 (DECISION-0186/0187): vinculo Group interno -> Actor organizacional institucional. Composicao com vigencia; NAO e membership/relacao/authority/conta/endereco. Escrita SOMENTE via fn_bind/fn_retire/fn_reparent. Historico append-only; retired TERMINAL; DELETE proibido.';

-- unicidade ATIVA (DECISION-0187 D3): no maximo UM parent ativo por (tenant, group);
-- historicos retired plurais permitidos; NAO limita a instituicao a um unico Group.
CREATE UNIQUE INDEX uq_gib_active_parent
  ON group_institutional_bindings (tenant_id, group_id)
  WHERE status = 'active';

-- idempotencia tenant-scoped: chave de criacao unica; chave de retirada unica quando presente
CREATE UNIQUE INDEX uq_gib_create_idempotency
  ON group_institutional_bindings (tenant_id, create_idempotency_key);
CREATE UNIQUE INDEX uq_gib_retire_idempotency
  ON group_institutional_bindings (tenant_id, retire_idempotency_key)
  WHERE retire_idempotency_key IS NOT NULL;

-- leitura operacional (read-model interno): por instituicao (filhos) e por group (historia)
CREATE INDEX idx_gib_institution ON group_institutional_bindings (tenant_id, institution_actor_id, status);
CREATE INDEX idx_gib_group       ON group_institutional_bindings (tenant_id, group_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. IMUTABILIDADE FISICA (DECISION-0187 D6 / envelope §5):
--    retired e TERMINAL; campos decisorios imutaveis; retirada preenchida UMA vez; DELETE proibido.
--    Trigger BEFORE — vale para QUALQUER caminho de escrita, inclusive owner/definer.
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_gib_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $func$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GIB_DELETE_FORBIDDEN: historico do vinculo institucional e append-only (DECISION-0187 D6).';
  END IF;
  -- retired e TERMINAL: nenhuma alteracao posterior (inclui reativacao e edicao de trilha)
  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION 'GIB_IMMUTABLE_RETIRED: vinculo retired e terminal — reativacao/edicao proibida (DECISION-0187 D6).';
  END IF;
  -- campos decisorios/autoria de criacao: imutaveis desde o INSERT
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.institution_actor_id IS DISTINCT FROM OLD.institution_actor_id
     OR NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.create_idempotency_key IS DISTINCT FROM OLD.create_idempotency_key
     OR NEW.create_fingerprint IS DISTINCT FROM OLD.create_fingerprint THEN
    RAISE EXCEPTION 'GIB_IMMUTABLE_FIELD: group_id/institution_actor_id/tenant_id/autoria/criacao sao imutaveis — reparent = retire + NOVA linha (DECISION-0187 D6).';
  END IF;
  -- unica transicao permitida: active -> retired com a trilha completa preenchida de uma vez
  IF NEW.status = 'active' THEN
    IF NEW.retired_at IS NOT NULL OR NEW.retired_by_actor_id IS NOT NULL OR NEW.retire_idempotency_key IS NOT NULL THEN
      RAISE EXCEPTION 'GIB_INVALID_TRANSITION: campos de retirada exigem status=retired.';
    END IF;
  ELSIF NEW.status = 'retired' THEN
    IF NEW.retired_at IS NULL OR NEW.retired_by_actor_id IS NULL OR NEW.retire_idempotency_key IS NULL THEN
      RAISE EXCEPTION 'GIB_INVALID_TRANSITION: retirada exige retired_at + retired_by_actor_id + retire_idempotency_key.';
    END IF;
  ELSE
    RAISE EXCEPTION 'GIB_INVALID_TRANSITION: status % fora do vocabulario active|retired.', NEW.status;
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_gib_immutability
  BEFORE UPDATE OR DELETE ON group_institutional_bindings
  FOR EACH ROW EXECUTE FUNCTION fn_gib_enforce_immutability();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. WRITER CANONICO A — CRIAR VINCULO (SECURITY DEFINER; search_path pinado).
--    Serializacao por advisory lock transacional POR TENANT (deterministico; sem deadlock) +
--    row locks FOR UPDATE. Revalidacao ESTRUTURAL completa DENTRO da transacao. Fail-closed.
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_bind_group_to_institution(
  p_tenant_id            UUID,
  p_group_id             UUID,
  p_institution_actor_id UUID,
  p_acting_actor_id      UUID,
  p_idempotency_key      TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_fingerprint TEXT;
  v_existing    public.group_institutional_bindings%ROWTYPE;
  v_group       RECORD;
  v_group_actor RECORD;
  v_inst        RECORD;
  v_parent_grp  RECORD;
  v_new_id      UUID;
BEGIN
  IF p_tenant_id IS NULL OR p_group_id IS NULL OR p_institution_actor_id IS NULL
     OR p_acting_actor_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'GIB_INPUT_NULL: tenant/group/institution/acting/idempotency_key obrigatorios.';
  END IF;

  -- fingerprint deterministico dos campos DECISORIOS (mismatch de replay = fail-closed)
  v_fingerprint := md5(p_tenant_id::text || ':' || p_group_id::text || ':' || p_institution_actor_id::text || ':' || p_acting_actor_id::text);

  -- serializacao deterministica por tenant (uma unica chave de lock -> sem deadlock; sem TOCTOU)
  PERFORM pg_advisory_xact_lock(hashtextextended('group_institutional_bindings:' || p_tenant_id::text, 0));

  -- idempotencia (create): replay exato retorna o MESMO id; chave reusada com payload divergente falha
  SELECT * INTO v_existing FROM public.group_institutional_bindings
   WHERE tenant_id = p_tenant_id AND create_idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.create_fingerprint = v_fingerprint THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'GIB_IDEMPOTENCY_MISMATCH: chave de criacao reutilizada com payload divergente.';
  END IF;

  -- coerencia tenant dos actors participantes (REUSO da helper selada; FOR SHARE; nao-vazante)
  PERFORM public.fn_assert_actors_in_tenant(p_tenant_id, ARRAY[p_institution_actor_id, p_acting_actor_id]);

  -- Group filho: existe no tenant, ativo, com group-actor materializado (1:1 vivo)
  SELECT g.id, g.tenant_id, g.actor_id, g.status INTO v_group
    FROM public.groups g
   WHERE g.id = p_group_id AND g.tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GIB_GROUP_NOT_FOUND: group inexistente no tenant.';
  END IF;
  IF v_group.status <> 'active' THEN
    RAISE EXCEPTION 'GIB_GROUP_NOT_ACTIVE: group nao esta ativo.';
  END IF;
  IF v_group.actor_id IS NULL THEN
    RAISE EXCEPTION 'GIB_GROUP_ACTOR_MISSING: group sem group-actor materializado (momento 1 da 3C).';
  END IF;

  -- coerencia do 1:1 (defesa em profundidade; nunca persiste 2a referencia ao group-actor)
  SELECT a.id, a.actor_type, a.group_id INTO v_group_actor
    FROM public.actors a
   WHERE a.id = v_group.actor_id AND a.tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND OR v_group_actor.actor_type <> 'group' OR v_group_actor.group_id IS DISTINCT FROM v_group.id THEN
    RAISE EXCEPTION 'GIB_GROUP_ACTOR_INCOHERENT: 1:1 group<->group-actor divergente.';
  END IF;

  -- self-link (DECISION-0187 D5): o proprio group-actor do filho nao pode ser o parent
  IF p_institution_actor_id = v_group.actor_id THEN
    RAISE EXCEPTION 'GIB_SELF_LINK: group nao pode ser vinculado ao seu proprio group-actor.';
  END IF;

  -- Actor institucional: page formal OU group-actor RAIZ informal (DECISION-0187 D4)
  SELECT a.id, a.actor_type, a.company_id, a.group_id INTO v_inst
    FROM public.actors a
   WHERE a.id = p_institution_actor_id AND a.tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GIB_INSTITUTION_NOT_FOUND: actor institucional inexistente no tenant.';
  END IF;
  IF v_inst.actor_type NOT IN ('page', 'group') THEN
    -- user/channel/system/legados/futuros: NUNCA parent (DECISION-0187 D4)
    RAISE EXCEPTION 'GIB_INSTITUTION_TYPE_INVALID: actor_type % nao pode ser instituicao pai (permitidos: page, group-raiz).', v_inst.actor_type;
  END IF;
  IF v_inst.actor_type = 'page' THEN
    IF v_inst.company_id IS NULL THEN
      RAISE EXCEPTION 'GIB_INSTITUTION_PAGE_INCOHERENT: page-actor sem company vinculada.';
    END IF;
  ELSE
    -- parent group-actor: precisa do proprio Group coerente E estar em modo RAIZ (sem parent ativo)
    IF v_inst.group_id IS NULL THEN
      RAISE EXCEPTION 'GIB_INSTITUTION_GROUP_INCOHERENT: group-actor institucional sem group_id.';
    END IF;
    SELECT g.id INTO v_parent_grp
      FROM public.groups g
     WHERE g.id = v_inst.group_id AND g.tenant_id = p_tenant_id AND g.actor_id = v_inst.id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'GIB_INSTITUTION_GROUP_INCOHERENT: 1:1 do group-actor institucional divergente.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.group_institutional_bindings b
       WHERE b.tenant_id = p_tenant_id AND b.group_id = v_inst.group_id AND b.status = 'active'
    ) THEN
      -- parent que ja e INTERNO nao pode ser instituicao (anti-cadeia/anti-ciclo v1)
      RAISE EXCEPTION 'GIB_PARENT_IS_INTERNAL: group-actor institucional possui parent ativo — nao e raiz (DECISION-0187 D5).';
    END IF;
  END IF;

  -- filho com FILHOS ativos nao recebe parent (anti-cadeia/anti-ciclo v1)
  IF EXISTS (
    SELECT 1 FROM public.group_institutional_bindings b
     WHERE b.tenant_id = p_tenant_id AND b.institution_actor_id = v_group.actor_id AND b.status = 'active'
  ) THEN
    RAISE EXCEPTION 'GIB_GROUP_HAS_CHILDREN: group possui filhos institucionais ativos — nao pode receber parent (DECISION-0187 D5).';
  END IF;

  -- exclusividade de parent ativo (rede fisica adicional: uq_gib_active_parent)
  IF EXISTS (
    SELECT 1 FROM public.group_institutional_bindings b
     WHERE b.tenant_id = p_tenant_id AND b.group_id = p_group_id AND b.status = 'active'
  ) THEN
    RAISE EXCEPTION 'GIB_ACTIVE_BINDING_EXISTS: group ja possui parent institucional ativo (retire antes; reparent = retire + novo).';
  END IF;

  INSERT INTO public.group_institutional_bindings
    (tenant_id, group_id, institution_actor_id, status, create_idempotency_key, create_fingerprint, created_by_actor_id)
  VALUES
    (p_tenant_id, p_group_id, p_institution_actor_id, 'active', p_idempotency_key, v_fingerprint, p_acting_actor_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$func$;

COMMENT ON FUNCTION fn_bind_group_to_institution(UUID,UUID,UUID,UUID,TEXT) IS
  'D9.1: cria vinculo institucional (unico caminho de INSERT). Advisory lock por tenant + FOR UPDATE + revalidacao estrutural completa in-tx. Idempotente (chave+fingerprint; mismatch fail-closed). PUBLICA — EXECUTE concedido a unificard_app; autoridade dual (canRepresentActor 2 lados) provada no service ANTES da chamada.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. WRITER CANONICO B — RETIRAR VINCULO (terminal; idempotente).
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_retire_group_institutional_binding(
  p_tenant_id       UUID,
  p_binding_id      UUID,
  p_acting_actor_id UUID,
  p_idempotency_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_binding public.group_institutional_bindings%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL OR p_binding_id IS NULL OR p_acting_actor_id IS NULL
     OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'GIB_INPUT_NULL: tenant/binding/acting/idempotency_key obrigatorios.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('group_institutional_bindings:' || p_tenant_id::text, 0));
  PERFORM public.fn_assert_actors_in_tenant(p_tenant_id, ARRAY[p_acting_actor_id]);

  SELECT * INTO v_binding FROM public.group_institutional_bindings
   WHERE id = p_binding_id AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GIB_BINDING_NOT_FOUND: vinculo inexistente no tenant.';
  END IF;

  -- chave de retirada reutilizada em OUTRO vinculo = mismatch (nunca colisao silenciosa)
  IF EXISTS (
    SELECT 1 FROM public.group_institutional_bindings b
     WHERE b.tenant_id = p_tenant_id AND b.retire_idempotency_key = p_idempotency_key AND b.id <> p_binding_id
  ) THEN
    RAISE EXCEPTION 'GIB_IDEMPOTENCY_MISMATCH: chave de retirada ja consumida por outro vinculo.';
  END IF;

  IF v_binding.status = 'retired' THEN
    IF v_binding.retire_idempotency_key = p_idempotency_key THEN
      RETURN v_binding.id;  -- replay exato
    END IF;
    RAISE EXCEPTION 'GIB_ALREADY_RETIRED: vinculo ja retirado (retired e terminal; sem reativacao).';
  END IF;

  UPDATE public.group_institutional_bindings
     SET status = 'retired',
         retired_at = now(),
         retired_by_actor_id = p_acting_actor_id,
         retire_idempotency_key = p_idempotency_key
   WHERE id = v_binding.id;

  RETURN v_binding.id;
END;
$func$;

COMMENT ON FUNCTION fn_retire_group_institutional_binding(UUID,UUID,UUID,TEXT) IS
  'D9.1: retira vinculo institucional (unico caminho de retirada; terminal). Idempotente (replay pela mesma chave; mismatch fail-closed). Preserva linha historica (sem DELETE). PUBLICA — EXECUTE concedido a unificard_app; autoridade dual provada no service.';

-- ────────────────────────────────────────────────────────────────────────────
-- 6. WRITER CANONICO C — REPARENT (retire + bind ATOMICO; reusa as DUAS primitivas;
--    NAO e terceiro caminho de escrita independente).
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_reparent_group_institution(
  p_tenant_id                UUID,
  p_group_id                 UUID,
  p_new_institution_actor_id UUID,
  p_acting_actor_id          UUID,
  p_idempotency_key          TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_fingerprint TEXT;
  v_existing    public.group_institutional_bindings%ROWTYPE;
  v_current     public.group_institutional_bindings%ROWTYPE;
BEGIN
  IF p_tenant_id IS NULL OR p_group_id IS NULL OR p_new_institution_actor_id IS NULL
     OR p_acting_actor_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'GIB_INPUT_NULL: tenant/group/new_institution/acting/idempotency_key obrigatorios.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('group_institutional_bindings:' || p_tenant_id::text, 0));

  -- replay exato do reparent: a NOVA linha ja nasceu com esta chave e o mesmo payload
  v_fingerprint := md5(p_tenant_id::text || ':' || p_group_id::text || ':' || p_new_institution_actor_id::text || ':' || p_acting_actor_id::text);
  SELECT * INTO v_existing FROM public.group_institutional_bindings
   WHERE tenant_id = p_tenant_id AND create_idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.create_fingerprint = v_fingerprint THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'GIB_IDEMPOTENCY_MISMATCH: chave de reparent reutilizada com payload divergente.';
  END IF;

  SELECT * INTO v_current FROM public.group_institutional_bindings
   WHERE tenant_id = p_tenant_id AND group_id = p_group_id AND status = 'active'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GIB_NO_ACTIVE_BINDING: reparent exige vinculo ativo (para primeiro vinculo use fn_bind_group_to_institution).';
  END IF;
  IF v_current.institution_actor_id = p_new_institution_actor_id THEN
    RAISE EXCEPTION 'GIB_REPARENT_SAME_PARENT: novo parent identico ao atual.';
  END IF;

  -- retire + bind na MESMA transacao, reutilizando as primitivas canonicas (atomico; rollback total)
  PERFORM public.fn_retire_group_institutional_binding(
    p_tenant_id, v_current.id, p_acting_actor_id, p_idempotency_key || ':retire:' || v_current.id::text);

  RETURN public.fn_bind_group_to_institution(
    p_tenant_id, p_group_id, p_new_institution_actor_id, p_acting_actor_id, p_idempotency_key);
END;
$func$;

COMMENT ON FUNCTION fn_reparent_group_institution(UUID,UUID,UUID,UUID,TEXT) IS
  'D9.1: reparent = retire do vinculo ativo + criacao de NOVA linha, ATOMICO na mesma transacao, reutilizando fn_retire+fn_bind (nao e terceiro caminho de escrita). Historico integral preservado; nunca dois parents ativos; idempotente. PUBLICA — EXECUTE concedido a unificard_app; autoridade dual (incl. parent antigo) provada no service.';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. RLS (ENABLE + FORCE, tenant-scoped fechada) + FRONTEIRA DE ESCRITA
--    (padrao selado 20260711170000: app SEM DML direto; EXECUTE governado por funcao).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE group_institutional_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_institutional_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY group_institutional_bindings_rls ON group_institutional_bindings
  USING (tenant_id::text = current_setting('app.current_tenant', true));

REVOKE ALL ON group_institutional_bindings FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON group_institutional_bindings FROM unificard_app;
GRANT SELECT ON group_institutional_bindings TO unificard_app;

REVOKE EXECUTE ON FUNCTION fn_bind_group_to_institution(UUID,UUID,UUID,UUID,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_retire_group_institutional_binding(UUID,UUID,UUID,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_reparent_group_institution(UUID,UUID,UUID,UUID,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_gib_enforce_immutability() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fn_bind_group_to_institution(UUID,UUID,UUID,UUID,TEXT) TO unificard_app;
GRANT EXECUTE ON FUNCTION fn_retire_group_institutional_binding(UUID,UUID,UUID,TEXT) TO unificard_app;
GRANT EXECUTE ON FUNCTION fn_reparent_group_institution(UUID,UUID,UUID,UUID,TEXT) TO unificard_app;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. POS-VERIFICACAO FAIL-CLOSED
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname='group_institutional_bindings' AND relrowsecurity AND relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS ENABLE+FORCE ausente na casa nova.';
  END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='group_institutional_bindings' AND grantee='unificard_app'
     AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app ganhou DML direto (%) — fronteira de escrita violada.', v_cnt;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uq_gib_active_parent' AND indexdef LIKE '%tenant_id%' AND indexdef LIKE '%WHERE%') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unicidade ativa (tenant_id, group_id) WHERE active ausente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_gib_immutability') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger de imutabilidade ausente.';
  END IF;
  SELECT count(*) INTO v_cnt FROM public.group_institutional_bindings;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: casa nasceu com % linha(s) — deveria nascer vazia (sem seed/backfill).', v_cnt;
  END IF;
END $$;

COMMIT;

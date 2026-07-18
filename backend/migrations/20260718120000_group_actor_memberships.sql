-- ============================================================
-- D9.2-A / F-ORGANIZATIONAL-ACTOR-COMPOSITION — FUNDACAO ACTOR-FIRST DORMENTE DA MEMBERSHIP
-- (DECISION-0186 · DECISION-0188; posterior e DEPENDENTE da migration D9.1 20260717120000)
--
-- O QUE E (DECISION-0188 D1-D9): nova casa canonica FUTURA `group_actor_memberships` —
--   membership = fato historico e governado de que um ACTOR pertence a um Group.
--   Identidade UNICA persistida = member_actor_id (actors.id). user_id/global_user_id NAO sao
--   colunas de membership (servem apenas a resolucao no mapper/read-model — DECISION-0131 B3).
--   Lifecycle historico active -> left | removed (terminais; DELETE proibido; reentrada = NOVA
--   linha). Unicidade ATIVA por tenant+group+member_actor. Idempotencia tenant-scoped com
--   fingerprint fail-closed. Coerencia tenant COMPOSTA (reusa candidate keys do D9.1).
--   + EVOLUCAO DORMENTE de group_invites: colunas de INTENCAO explicita (intent_kind
--   invite|request + idempotencia) NULAS e ignoradas pelos callers legados; NULL NUNCA e
--   interpretado como invite; caminho novo protegido por CHECK/uniques parciais/trigger.
--   + ACEITE TRANSACIONAL interno: intent accepted E membership nascem na MESMA transacao.
--
-- O QUE NAO E / NAO FAZ (dormencia D9.2-A): NENHUM caller de produto; NENHUMA rota; NENHUM
--   flip; NENHUM backfill; NENHUM dual-write; group_members INTOCADA (segue legado vivo);
--   as 6 superficies de namespace INTOCADAS; events-B3 INTOCADO; role-authority INTOCADA;
--   caps 1/3 INTOCADOS; ZERO membership/intent real em dev (migration NAO aplicada em
--   unificard_dev — prova SOMENTE em clone efemero, apos aplicar a D9.1).
--   Membership NAO e: ownership civil · binding (D9.1) · role · authority · audience ·
--   category/N0/N1/N2 (navegacao NUNCA decide pertencimento) · conta/saldo (Bank intocado).
--
-- ESCRITA GOVERNADA (padrao selado D9.1): unificard_app SEM DML direto na casa nova; escrita
--   SOMENTE pelas funcoes canonicas SECURITY DEFINER (search_path pinado; EXECUTE governado):
--     fn_enter_group_actor_membership    — entrada (self ou representada; estrutural)
--     fn_leave_group_actor_membership    — saida voluntaria (terminal left)
--     fn_remove_group_actor_membership   — remocao administrativa (terminal removed)
--     fn_create_group_membership_intent  — intencao explicita invite|request (caminho novo)
--     fn_accept_group_membership_intent  — aceite ATOMICO (intent accepted + membership)
--   AUTHORITY (canRepresentActor) permanece no service canonico TS (transaction owner unico,
--   mesmo client — padrao selado na remediacao D9.1); as fns validam SOMENTE fatos ESTRUTURAIS.
--
-- ELEGIBILIDADE ESTRUTURAL v1 (DECISION-0188 D2): member_actor_type IN (user, page, group).
--   user  -> user_id + global_user_id coerentes;  page -> company viva;
--   group -> 1:1 coerente + group ativo + RAIZ (sem parent ativo no D9.1) + nao-self +
--            parent-do-alvo nao entra no filho. channel/system/legados/cross-tenant PROIBIDOS.
--
-- FORWARD-ONLY · TRANSACIONAL · HARD-FAIL. SEM seed · SEM backfill · SEM linha real.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- PREFLIGHT FAIL-CLOSED (depende da D9.1 aplicada no ambiente-alvo: clone/efemero)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  IF to_regclass('public.group_actor_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: group_actor_memberships ja existe — estado divergente.';
  END IF;
  IF to_regclass('public.groups') IS NULL OR to_regclass('public.actors') IS NULL
     OR to_regclass('public.group_invites') IS NULL OR to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: groups/actors/group_invites/tenants ausentes.';
  END IF;
  -- D9.1 aplicada: casa do binding + candidate keys compostas (REUSO — nao duplicar)
  IF to_regclass('public.group_institutional_bindings') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: group_institutional_bindings ausente — aplicar a migration D9.1 (20260717120000) antes.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_groups_tenant_id_id')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_actors_tenant_id_id') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: candidate keys compostas do D9.1 ausentes.';
  END IF;
  IF to_regprocedure('public.fn_assert_actors_in_tenant(uuid,uuid[])') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_assert_actors_in_tenant ausente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unificard_app') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: role unificard_app ausente.';
  END IF;
  -- group_invites: legado esperado (tenant_id NOT NULL ja existe; novas colunas ausentes)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='group_invites'
                    AND column_name='tenant_id' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: group_invites.tenant_id divergente do legado esperado.';
  END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema='public' AND table_name='group_invites'
     AND column_name IN ('intent_kind','intent_idempotency_key','intent_fingerprint');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: colunas de intent ja existem em group_invites — estado divergente.';
  END IF;
  -- funcoes novas ainda nao existem
  IF to_regprocedure('public.fn_enter_group_actor_membership(uuid,uuid,uuid,uuid,text,uuid)') IS NOT NULL
     OR to_regprocedure('public.fn_leave_group_actor_membership(uuid,uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.fn_remove_group_actor_membership(uuid,uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.fn_create_group_membership_intent(uuid,uuid,uuid,uuid,text,text)') IS NOT NULL
     OR to_regprocedure('public.fn_accept_group_membership_intent(uuid,uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: funcao canonica D9.2-A ja existe — estado divergente.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. NOVA CASA CANONICA FUTURA (DECISION-0188 D3/D5/D6/D7)
--    SEM user_id · SEM global_user_id · SEM member_type · SEM role/is_admin/is_owner ·
--    SEM category/N0/N1/N2 · SEM authority/capability/grant · SEM coluna financeira.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE group_actor_memberships (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id),
  group_id              UUID        NOT NULL,
  member_actor_id       UUID        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'active'
    CONSTRAINT chk_gam_status CHECK (status IN ('active', 'left', 'removed')),
  entry_idempotency_key TEXT        NOT NULL,
  entry_fingerprint     TEXT        NOT NULL,
  created_by_actor_id   UUID        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_intent_id      UUID,
  left_by_actor_id      UUID,
  left_at               TIMESTAMPTZ,
  removed_by_actor_id   UUID,
  removed_at            TIMESTAMPTZ,
  -- shape fisico do lifecycle (DECISION-0188 D7): trilhas de left e removed EXCLUSIVAS
  CONSTRAINT chk_gam_lifecycle_shape CHECK (
    (status = 'active'  AND left_by_actor_id IS NULL     AND left_at IS NULL
                        AND removed_by_actor_id IS NULL  AND removed_at IS NULL)
    OR
    (status = 'left'    AND left_by_actor_id IS NOT NULL AND left_at IS NOT NULL
                        AND removed_by_actor_id IS NULL  AND removed_at IS NULL)
    OR
    (status = 'removed' AND removed_by_actor_id IS NOT NULL AND removed_at IS NOT NULL
                        AND left_by_actor_id IS NULL     AND left_at IS NULL)
  ),
  -- coerencia tenant COMPOSTA (reusa candidate keys do D9.1) — fail-closed, sem cascade
  CONSTRAINT fk_gam_group_tenant      FOREIGN KEY (tenant_id, group_id)            REFERENCES groups (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gam_member_tenant     FOREIGN KEY (tenant_id, member_actor_id)     REFERENCES actors (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gam_created_by_tenant FOREIGN KEY (tenant_id, created_by_actor_id) REFERENCES actors (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gam_left_by_tenant    FOREIGN KEY (tenant_id, left_by_actor_id)    REFERENCES actors (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_gam_removed_by_tenant FOREIGN KEY (tenant_id, removed_by_actor_id) REFERENCES actors (tenant_id, id) ON DELETE RESTRICT
);

COMMENT ON TABLE group_actor_memberships IS
  'D9.2-A (DECISION-0188): casa canonica FUTURA da membership Actor-first — DORMENTE (zero caller de produto ate o cutover D9.2-B). Identidade = member_actor_id. Lifecycle historico active->left|removed; DELETE proibido; reentrada = nova linha. Escrita SOMENTE via fn_enter/fn_leave/fn_remove/fn_accept_intent.';

-- unicidade ATIVA (D6): 1 membership active por tenant+group+member; historicos plurais livres
CREATE UNIQUE INDEX uq_gam_active_membership
  ON group_actor_memberships (tenant_id, group_id, member_actor_id)
  WHERE status = 'active';

-- idempotencia de ENTRADA tenant-scoped (nunca global/cross-tenant)
CREATE UNIQUE INDEX uq_gam_entry_idempotency
  ON group_actor_memberships (tenant_id, entry_idempotency_key);

CREATE INDEX idx_gam_group  ON group_actor_memberships (tenant_id, group_id, status);
CREATE INDEX idx_gam_member ON group_actor_memberships (tenant_id, member_actor_id, status);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. EVOLUCAO DORMENTE DE group_invites (DECISION-0188 D9 / envelope §13)
--    Colunas NOVAS nulas e invisiveis ao legado; NULL NUNCA e interpretado como invite.
--    Nada dropado/renomeado; UNIQUE legado uq_group_invite PRESERVADO (residual conhecido:
--    ele cobre historicos — a substituicao governada e ato do cutover D9.2-B).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE group_invites ADD COLUMN intent_kind TEXT;
ALTER TABLE group_invites ADD COLUMN intent_idempotency_key TEXT;
ALTER TABLE group_invites ADD COLUMN intent_fingerprint TEXT;

ALTER TABLE group_invites ADD CONSTRAINT chk_gi_intent_kind
  CHECK (intent_kind IS NULL OR intent_kind IN ('invite', 'request'));
-- caminho novo carrega o trio completo; linha legada carrega NENHUM (sem estado hibrido)
ALTER TABLE group_invites ADD CONSTRAINT chk_gi_intent_coherence
  CHECK (
    (intent_kind IS NULL AND intent_idempotency_key IS NULL AND intent_fingerprint IS NULL)
    OR
    (intent_kind IS NOT NULL AND intent_idempotency_key IS NOT NULL AND intent_fingerprint IS NOT NULL)
  );

-- suporte MINIMO para FK composta do source_intent (group_invites nao possuia candidate key composta)
ALTER TABLE group_invites ADD CONSTRAINT uq_group_invites_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE group_actor_memberships
  ADD CONSTRAINT fk_gam_source_intent_tenant
  FOREIGN KEY (tenant_id, source_intent_id) REFERENCES group_invites (tenant_id, id) ON DELETE RESTRICT;

-- caminho novo: UMA intencao pendente por par (invite e request NAO coexistem pendentes);
-- parcial em pending — NAO cobre historicos (terminais nao bloqueiam o caminho novo em si)
CREATE UNIQUE INDEX uq_gi_new_intent_pending
  ON group_invites (tenant_id, group_id, invited_actor_id)
  WHERE intent_kind IS NOT NULL AND status = 'pending';

-- idempotencia de INTENCAO tenant-scoped (so caminho novo)
CREATE UNIQUE INDEX uq_gi_intent_idempotency
  ON group_invites (tenant_id, intent_idempotency_key)
  WHERE intent_idempotency_key IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. IMUTABILIDADE FISICA DA CASA NOVA (D7): DELETE proibido; terminais imutaveis;
--    campos decisorios imutaveis; transicoes SOMENTE active->left | active->removed.
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_gam_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $func$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GAM_DELETE_FORBIDDEN: historico de membership e append-only (DECISION-0188 D7).';
  END IF;
  IF OLD.status IN ('left', 'removed') THEN
    RAISE EXCEPTION 'GAM_IMMUTABLE_TERMINAL: linha terminal (%) nunca e reativada/editada — reentrada = NOVA linha.', OLD.status;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.member_actor_id IS DISTINCT FROM OLD.member_actor_id
     OR NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.source_intent_id IS DISTINCT FROM OLD.source_intent_id
     OR NEW.entry_idempotency_key IS DISTINCT FROM OLD.entry_idempotency_key
     OR NEW.entry_fingerprint IS DISTINCT FROM OLD.entry_fingerprint THEN
    RAISE EXCEPTION 'GAM_IMMUTABLE_FIELD: tenant/group/membro/autor/origem/idempotencia/created_at sao imutaveis.';
  END IF;
  IF NEW.status = 'left' THEN
    IF NEW.left_by_actor_id IS NULL OR NEW.left_at IS NULL THEN
      RAISE EXCEPTION 'GAM_INVALID_TRANSITION: left exige left_by_actor_id + left_at.';
    END IF;
  ELSIF NEW.status = 'removed' THEN
    IF NEW.removed_by_actor_id IS NULL OR NEW.removed_at IS NULL THEN
      RAISE EXCEPTION 'GAM_INVALID_TRANSITION: removed exige removed_by_actor_id + removed_at.';
    END IF;
  ELSIF NEW.status = 'active' THEN
    IF NEW.left_at IS NOT NULL OR NEW.removed_at IS NOT NULL
       OR NEW.left_by_actor_id IS NOT NULL OR NEW.removed_by_actor_id IS NOT NULL THEN
      RAISE EXCEPTION 'GAM_INVALID_TRANSITION: campos terminais exigem status terminal.';
    END IF;
  ELSE
    RAISE EXCEPTION 'GAM_INVALID_TRANSITION: status % fora do vocabulario active|left|removed.', NEW.status;
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_gam_immutability
  BEFORE UPDATE OR DELETE ON group_actor_memberships
  FOR EACH ROW EXECUTE FUNCTION fn_gam_enforce_immutability();

-- protecao do CAMINHO NOVO de group_invites (linhas legadas NAO passam por aqui):
-- intent_* imutaveis; DELETE proibido em linha nova; transicoes so a partir de pending.
CREATE FUNCTION fn_gi_intent_enforce_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $func$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GAM_INTENT_DELETE_FORBIDDEN: intencao do caminho novo e historico append-only.';
  END IF;
  IF NEW.intent_kind IS DISTINCT FROM OLD.intent_kind
     OR NEW.intent_idempotency_key IS DISTINCT FROM OLD.intent_idempotency_key
     OR NEW.intent_fingerprint IS DISTINCT FROM OLD.intent_fingerprint
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.invited_actor_id IS DISTINCT FROM OLD.invited_actor_id
     OR NEW.invited_by_actor_id IS DISTINCT FROM OLD.invited_by_actor_id THEN
    RAISE EXCEPTION 'GAM_INTENT_IMMUTABLE_FIELD: campos decisorios da intencao sao imutaveis.';
  END IF;
  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'GAM_INTENT_TERMINAL: intencao terminal nao muda de status (nova intencao = nova linha).';
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_gi_intent_immutability
  BEFORE UPDATE OR DELETE ON group_invites
  FOR EACH ROW
  WHEN (OLD.intent_kind IS NOT NULL)
  EXECUTE FUNCTION fn_gi_intent_enforce_immutability();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. WRITER CANONICO — ENTRADA (estrutural; authority no service canonico TS)
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_enter_group_actor_membership(
  p_tenant_id        UUID,
  p_group_id         UUID,
  p_member_actor_id  UUID,
  p_acting_actor_id  UUID,
  p_idempotency_key  TEXT,
  p_source_intent_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_fingerprint TEXT;
  v_existing    public.group_actor_memberships%ROWTYPE;
  v_group       RECORD;
  v_member      RECORD;
  v_member_grp  RECORD;
  v_new_id      UUID;
BEGIN
  IF p_tenant_id IS NULL OR p_group_id IS NULL OR p_member_actor_id IS NULL
     OR p_acting_actor_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'GAM_INPUT_NULL: tenant/group/member/acting/idempotency_key obrigatorios.';
  END IF;

  v_fingerprint := md5(p_tenant_id::text || ':' || p_group_id::text || ':' || p_member_actor_id::text
                       || ':' || p_acting_actor_id::text || ':' || coalesce(p_source_intent_id::text, ''));

  -- serializacao deterministica por tenant+group (advisory unico -> sem deadlock; sem TOCTOU)
  PERFORM pg_advisory_xact_lock(hashtextextended('group_actor_memberships:' || p_tenant_id::text || ':' || p_group_id::text, 0));

  -- idempotencia (entrada): replay exato retorna o MESMO id; chave reusada com payload divergente falha
  SELECT * INTO v_existing FROM public.group_actor_memberships
   WHERE tenant_id = p_tenant_id AND entry_idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.entry_fingerprint = v_fingerprint THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'GAM_IDEMPOTENCY_MISMATCH: chave de entrada reutilizada com payload divergente.';
  END IF;

  PERFORM public.fn_assert_actors_in_tenant(p_tenant_id, ARRAY[p_member_actor_id, p_acting_actor_id]);

  -- Group alvo: existe no tenant, ativo (row lock)
  SELECT g.id, g.actor_id, g.status, g.owner_actor_id INTO v_group
    FROM public.groups g
   WHERE g.id = p_group_id AND g.tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAM_GROUP_NOT_FOUND: group inexistente no tenant.';
  END IF;
  IF v_group.status <> 'active' THEN
    RAISE EXCEPTION 'GAM_GROUP_NOT_ACTIVE: group nao esta ativo.';
  END IF;

  -- membro: classes v1 fechadas (user | page | group-RAIZ) — DECISION-0188 D2
  SELECT a.id, a.actor_type, a.user_id, a.global_user_id, a.company_id, a.group_id INTO v_member
    FROM public.actors a
   WHERE a.id = p_member_actor_id AND a.tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAM_MEMBER_NOT_FOUND: actor membro inexistente no tenant.';
  END IF;
  IF v_member.actor_type NOT IN ('user', 'page', 'group') THEN
    -- channel/system/legados/futuros: NUNCA membros (DECISION-0188 D2)
    RAISE EXCEPTION 'GAM_MEMBER_TYPE_INVALID: actor_type % nao e elegivel a membership (permitidos: user, page, group-raiz).', v_member.actor_type;
  END IF;

  IF v_member.actor_type = 'user' THEN
    IF v_member.user_id IS NULL OR v_member.global_user_id IS NULL THEN
      RAISE EXCEPTION 'GAM_USER_ACTOR_INCOHERENT: user-actor sem vinculo tecnico user/identidade.';
    END IF;
  ELSIF v_member.actor_type = 'page' THEN
    IF v_member.company_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.companies c WHERE c.company_id = v_member.company_id AND c.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'GAM_PAGE_INCOHERENT: page-actor sem Company viva no tenant.';
    END IF;
  ELSE
    -- group-actor: 1:1 coerente + proprio group ativo + RAIZ + anti-self + anti parent<->filho
    IF v_member.group_id IS NULL THEN
      RAISE EXCEPTION 'GAM_MEMBER_GROUP_INCOHERENT: group-actor membro sem group_id.';
    END IF;
    IF v_member.group_id = p_group_id THEN
      RAISE EXCEPTION 'GAM_SELF_MEMBERSHIP: group nao pode ser membro de si mesmo.';
    END IF;
    SELECT g.id, g.status INTO v_member_grp
      FROM public.groups g
     WHERE g.id = v_member.group_id AND g.tenant_id = p_tenant_id AND g.actor_id = v_member.id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'GAM_MEMBER_GROUP_INCOHERENT: 1:1 do group-actor membro divergente.';
    END IF;
    IF v_member_grp.status <> 'active' THEN
      RAISE EXCEPTION 'GAM_MEMBER_GROUP_NOT_ACTIVE: group do actor membro nao esta ativo.';
    END IF;
    -- RAIZ: sem parent institucional ativo (Group interno do D9.1 NAO entra como membro)
    IF EXISTS (
      SELECT 1 FROM public.group_institutional_bindings b
       WHERE b.tenant_id = p_tenant_id AND b.group_id = v_member.group_id AND b.status = 'active'
    ) THEN
      RAISE EXCEPTION 'GAM_MEMBER_GROUP_NOT_ROOT: group-actor membro possui parent institucional ativo (interno) — apenas raiz e elegivel.';
    END IF;
  END IF;

  -- anti parent->filho: a instituicao-parent do group ALVO nao vira membro do proprio filho
  IF EXISTS (
    SELECT 1 FROM public.group_institutional_bindings b
     WHERE b.tenant_id = p_tenant_id AND b.group_id = p_group_id
       AND b.institution_actor_id = p_member_actor_id AND b.status = 'active'
  ) THEN
    RAISE EXCEPTION 'GAM_PARENT_CANNOT_JOIN_CHILD: instituicao-parent nao vira membro do Group interno (composicao = binding, nunca membership).';
  END IF;
  -- anti-self via actor do proprio group alvo
  IF v_group.actor_id IS NOT NULL AND v_group.actor_id = p_member_actor_id THEN
    RAISE EXCEPTION 'GAM_SELF_MEMBERSHIP: group nao pode ser membro de si mesmo.';
  END IF;

  -- unicidade ativa (erro canonico; rede fisica adicional: uq_gam_active_membership)
  IF EXISTS (
    SELECT 1 FROM public.group_actor_memberships m
     WHERE m.tenant_id = p_tenant_id AND m.group_id = p_group_id
       AND m.member_actor_id = p_member_actor_id AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'GAM_ACTIVE_MEMBERSHIP_EXISTS: ja existe membership ativa deste actor neste group.';
  END IF;

  INSERT INTO public.group_actor_memberships
    (tenant_id, group_id, member_actor_id, status, entry_idempotency_key, entry_fingerprint,
     created_by_actor_id, source_intent_id)
  VALUES
    (p_tenant_id, p_group_id, p_member_actor_id, 'active', p_idempotency_key, v_fingerprint,
     p_acting_actor_id, p_source_intent_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$func$;

COMMENT ON FUNCTION fn_enter_group_actor_membership(UUID,UUID,UUID,UUID,TEXT,UUID) IS
  'D9.2-A: unico caminho de INSERT da membership Actor-first (DORMENTE — zero caller de produto). Estrutural: classes v1 user|page|group-raiz; anti-self/anti-parent-filho; unicidade ativa; idempotencia fingerprint. Authority (canRepresentActor) e provada no service canonico, no MESMO client/transacao.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. WRITERS CANONICOS — SAIDA VOLUNTARIA E REMOCAO ADMINISTRATIVA
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_leave_group_actor_membership(
  p_tenant_id       UUID,
  p_membership_id   UUID,
  p_acting_actor_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_m     public.group_actor_memberships%ROWTYPE;
  v_owner UUID;
BEGIN
  IF p_tenant_id IS NULL OR p_membership_id IS NULL OR p_acting_actor_id IS NULL THEN
    RAISE EXCEPTION 'GAM_INPUT_NULL: tenant/membership/acting obrigatorios.';
  END IF;
  PERFORM public.fn_assert_actors_in_tenant(p_tenant_id, ARRAY[p_acting_actor_id]);

  SELECT * INTO v_m FROM public.group_actor_memberships
   WHERE id = p_membership_id AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAM_MEMBERSHIP_NOT_FOUND: membership inexistente no tenant.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('group_actor_memberships:' || p_tenant_id::text || ':' || v_m.group_id::text, 0));

  IF v_m.status = 'left' THEN
    RETURN v_m.id;  -- replay tolerante da MESMA transicao
  END IF;
  IF v_m.status = 'removed' THEN
    RAISE EXCEPTION 'GAM_ALREADY_REMOVED: membership ja removida (terminal).';
  END IF;

  SELECT g.owner_actor_id INTO v_owner FROM public.groups g
   WHERE g.id = v_m.group_id AND g.tenant_id = p_tenant_id FOR UPDATE;
  IF v_owner = v_m.member_actor_id THEN
    RAISE EXCEPTION 'GAM_OWNER_CANNOT_LEAVE: owner civil nao sai enquanto for groups.owner_actor_id (DECISION-0188 D8).';
  END IF;

  UPDATE public.group_actor_memberships
     SET status = 'left', left_by_actor_id = p_acting_actor_id, left_at = now()
   WHERE id = v_m.id;
  RETURN v_m.id;
END;
$func$;

COMMENT ON FUNCTION fn_leave_group_actor_membership(UUID,UUID,UUID) IS
  'D9.2-A: saida voluntaria (terminal left; historia preservada; owner bloqueado). DORMENTE — zero caller de produto. Authority no service canonico (self ou representante do membro), mesmo client.';

CREATE FUNCTION fn_remove_group_actor_membership(
  p_tenant_id       UUID,
  p_membership_id   UUID,
  p_acting_actor_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_m     public.group_actor_memberships%ROWTYPE;
  v_owner UUID;
BEGIN
  IF p_tenant_id IS NULL OR p_membership_id IS NULL OR p_acting_actor_id IS NULL THEN
    RAISE EXCEPTION 'GAM_INPUT_NULL: tenant/membership/acting obrigatorios.';
  END IF;
  PERFORM public.fn_assert_actors_in_tenant(p_tenant_id, ARRAY[p_acting_actor_id]);

  SELECT * INTO v_m FROM public.group_actor_memberships
   WHERE id = p_membership_id AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAM_MEMBERSHIP_NOT_FOUND: membership inexistente no tenant.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('group_actor_memberships:' || p_tenant_id::text || ':' || v_m.group_id::text, 0));

  IF v_m.status = 'removed' THEN
    RETURN v_m.id;  -- replay tolerante da MESMA transicao
  END IF;
  IF v_m.status = 'left' THEN
    RAISE EXCEPTION 'GAM_ALREADY_LEFT: membership ja encerrada por saida voluntaria (terminal).';
  END IF;

  SELECT g.owner_actor_id INTO v_owner FROM public.groups g
   WHERE g.id = v_m.group_id AND g.tenant_id = p_tenant_id FOR UPDATE;
  IF v_owner = v_m.member_actor_id THEN
    RAISE EXCEPTION 'GAM_OWNER_CANNOT_BE_REMOVED: owner civil nao e removido enquanto for groups.owner_actor_id (DECISION-0188 D8).';
  END IF;

  UPDATE public.group_actor_memberships
     SET status = 'removed', removed_by_actor_id = p_acting_actor_id, removed_at = now()
   WHERE id = v_m.id;
  RETURN v_m.id;
END;
$func$;

COMMENT ON FUNCTION fn_remove_group_actor_membership(UUID,UUID,UUID) IS
  'D9.2-A: remocao administrativa (terminal removed; historia preservada; owner bloqueado). DORMENTE. Authority no service canonico (canRepresentActor do group-actor do Group), mesmo client.';

-- ────────────────────────────────────────────────────────────────────────────
-- 6. WRITERS CANONICOS — INTENCAO EXPLICITA (caminho novo de group_invites) + ACEITE ATOMICO
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_create_group_membership_intent(
  p_tenant_id          UUID,
  p_group_id           UUID,
  p_candidate_actor_id UUID,
  p_initiator_actor_id UUID,
  p_intent_kind        TEXT,
  p_idempotency_key    TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_fingerprint TEXT;
  v_existing    RECORD;
  v_candidate   RECORD;
  v_new_id      UUID;
BEGIN
  IF p_tenant_id IS NULL OR p_group_id IS NULL OR p_candidate_actor_id IS NULL
     OR p_initiator_actor_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'GAM_INPUT_NULL: tenant/group/candidate/initiator/idempotency_key obrigatorios.';
  END IF;
  IF p_intent_kind IS NULL OR p_intent_kind NOT IN ('invite', 'request') THEN
    -- direcao SEMPRE explicita (DECISION-0188 D9) — NULL nunca e interpretado como invite
    RAISE EXCEPTION 'GAM_INTENT_KIND_INVALID: intent_kind deve ser invite|request (explicito).';
  END IF;

  v_fingerprint := md5(p_tenant_id::text || ':' || p_group_id::text || ':' || p_candidate_actor_id::text
                       || ':' || p_initiator_actor_id::text || ':' || p_intent_kind);

  PERFORM pg_advisory_xact_lock(hashtextextended('group_actor_memberships:' || p_tenant_id::text || ':' || p_group_id::text, 0));

  -- idempotencia da intencao (tenant-scoped; caminho novo)
  SELECT id, intent_fingerprint INTO v_existing FROM public.group_invites
   WHERE tenant_id = p_tenant_id AND intent_idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.intent_fingerprint = v_fingerprint THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'GAM_IDEMPOTENCY_MISMATCH: chave de intencao reutilizada com payload divergente.';
  END IF;

  PERFORM public.fn_assert_actors_in_tenant(p_tenant_id, ARRAY[p_candidate_actor_id, p_initiator_actor_id]);

  IF NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = p_group_id AND g.tenant_id = p_tenant_id AND g.status = 'active' FOR UPDATE) THEN
    RAISE EXCEPTION 'GAM_GROUP_NOT_FOUND: group inexistente/inativo no tenant.';
  END IF;

  SELECT a.actor_type INTO v_candidate FROM public.actors a
   WHERE a.id = p_candidate_actor_id AND a.tenant_id = p_tenant_id FOR SHARE;
  IF v_candidate.actor_type NOT IN ('user', 'page', 'group') THEN
    RAISE EXCEPTION 'GAM_MEMBER_TYPE_INVALID: candidato % nao e elegivel (user|page|group-raiz).', v_candidate.actor_type;
  END IF;

  -- uma intencao NOVA pendente por par (rede fisica adicional: uq_gi_new_intent_pending)
  IF EXISTS (
    SELECT 1 FROM public.group_invites gi
     WHERE gi.tenant_id = p_tenant_id AND gi.group_id = p_group_id
       AND gi.invited_actor_id = p_candidate_actor_id
       AND gi.intent_kind IS NOT NULL AND gi.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'GAM_INTENT_PENDING_EXISTS: ja existe intencao pendente (invite ou request) para este actor neste group.';
  END IF;

  BEGIN
    INSERT INTO public.group_invites
      (tenant_id, group_id, invited_actor_id, invited_by_actor_id, status,
       intent_kind, intent_idempotency_key, intent_fingerprint)
    VALUES
      (p_tenant_id, p_group_id, p_candidate_actor_id, p_initiator_actor_id, 'pending',
       p_intent_kind, p_idempotency_key, v_fingerprint)
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN unique_violation THEN
    -- RESIDUAL CONHECIDO (registrado; substituicao governada = D9.2-B): o UNIQUE LEGADO
    -- uq_group_invite(group_id, invited_actor_id) cobre TODOS os status — um historico legado/novo
    -- do MESMO par ainda bloqueia nova linha. Fail-closed com marcador proprio; sem contorno.
    RAISE EXCEPTION 'GAM_INTENT_LEGACY_UNIQUE_RESIDUAL: par group+actor ja possui linha em group_invites (UNIQUE legado pre-cutover).';
  END;

  RETURN v_new_id;
END;
$func$;

COMMENT ON FUNCTION fn_create_group_membership_intent(UUID,UUID,UUID,UUID,TEXT,TEXT) IS
  'D9.2-A: cria intencao EXPLICITA (invite|request) no caminho novo de group_invites. DORMENTE. Direcao declarada; 1 pendente por par; idempotencia fingerprint; residual do UNIQUE legado sinalizado fail-closed (substituicao = D9.2-B). Authority no service canonico.';

CREATE FUNCTION fn_accept_group_membership_intent(
  p_tenant_id       UUID,
  p_intent_id       UUID,
  p_acting_actor_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_i   RECORD;
  v_mid UUID;
BEGIN
  IF p_tenant_id IS NULL OR p_intent_id IS NULL OR p_acting_actor_id IS NULL THEN
    RAISE EXCEPTION 'GAM_INPUT_NULL: tenant/intent/acting obrigatorios.';
  END IF;

  SELECT gi.id, gi.group_id, gi.invited_actor_id, gi.status, gi.expires_at, gi.intent_kind INTO v_i
    FROM public.group_invites gi
   WHERE gi.id = p_intent_id AND gi.tenant_id = p_tenant_id AND gi.intent_kind IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAM_INTENT_NOT_FOUND: intencao do caminho novo inexistente no tenant.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('group_actor_memberships:' || p_tenant_id::text || ':' || v_i.group_id::text, 0));

  IF v_i.status = 'accepted' THEN
    -- replay: aceite ja consumado DEVE ter membership ligada (atomicidade do caminho novo)
    SELECT m.id INTO v_mid FROM public.group_actor_memberships m
     WHERE m.tenant_id = p_tenant_id AND m.source_intent_id = v_i.id;
    IF v_mid IS NULL THEN
      RAISE EXCEPTION 'GAM_INTENT_INCONSISTENT: intent accepted sem membership — invariante violado.';
    END IF;
    RETURN v_mid;
  END IF;
  IF v_i.status <> 'pending' THEN
    RAISE EXCEPTION 'GAM_INTENT_NOT_PENDING: intencao em status % (terminal).', v_i.status;
  END IF;
  IF v_i.expires_at IS NOT NULL AND v_i.expires_at <= now() THEN
    RAISE EXCEPTION 'GAM_INTENT_EXPIRED: intencao expirada.';
  END IF;

  -- MESMA transacao: membership nasce (reusa a primitiva canonica de entrada) e intent termina
  v_mid := public.fn_enter_group_actor_membership(
    p_tenant_id, v_i.group_id, v_i.invited_actor_id, p_acting_actor_id,
    'gi-accept:' || v_i.id::text, v_i.id);

  UPDATE public.group_invites
     SET status = 'accepted', responded_at = now()
   WHERE id = v_i.id;

  RETURN v_mid;
END;
$func$;

COMMENT ON FUNCTION fn_accept_group_membership_intent(UUID,UUID,UUID) IS
  'D9.2-A: aceite ATOMICO do caminho novo — bloqueia a intent pending, valida via fn_enter (reuso da primitiva; elegibilidade estrutural completa), cria a membership com source_intent e termina a intent accepted NA MESMA TRANSACAO. Replay idempotente. accepted-sem-membership impossivel. DORMENTE. Authority no service canonico.';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. RLS + FRONTEIRA DE ESCRITA (casa nova; legadas INTOCADAS — DT-GROUPS-TABLE-NO-RLS segue OPEN)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE group_actor_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_actor_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY group_actor_memberships_rls ON group_actor_memberships
  USING (tenant_id::text = current_setting('app.current_tenant', true));

REVOKE ALL ON group_actor_memberships FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON group_actor_memberships FROM unificard_app;
GRANT SELECT ON group_actor_memberships TO unificard_app;

REVOKE EXECUTE ON FUNCTION fn_enter_group_actor_membership(UUID,UUID,UUID,UUID,TEXT,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_leave_group_actor_membership(UUID,UUID,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_remove_group_actor_membership(UUID,UUID,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_create_group_membership_intent(UUID,UUID,UUID,UUID,TEXT,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_accept_group_membership_intent(UUID,UUID,UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_gam_enforce_immutability() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_gi_intent_enforce_immutability() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fn_enter_group_actor_membership(UUID,UUID,UUID,UUID,TEXT,UUID) TO unificard_app;
GRANT EXECUTE ON FUNCTION fn_leave_group_actor_membership(UUID,UUID,UUID) TO unificard_app;
GRANT EXECUTE ON FUNCTION fn_remove_group_actor_membership(UUID,UUID,UUID) TO unificard_app;
GRANT EXECUTE ON FUNCTION fn_create_group_membership_intent(UUID,UUID,UUID,UUID,TEXT,TEXT) TO unificard_app;
GRANT EXECUTE ON FUNCTION fn_accept_group_membership_intent(UUID,UUID,UUID) TO unificard_app;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. POS-VERIFICACAO FAIL-CLOSED
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname='group_actor_memberships' AND relrowsecurity AND relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS ENABLE+FORCE ausente na casa nova.';
  END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='group_actor_memberships' AND grantee='unificard_app'
     AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app ganhou DML direto (%) na casa nova.', v_cnt;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='uq_gam_active_membership' AND indexdef LIKE '%tenant_id%' AND indexdef LIKE '%WHERE%') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unicidade ativa (tenant, group, member) WHERE active ausente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_gam_immutability') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger de imutabilidade da casa nova ausente.';
  END IF;
  -- casas nascem VAZIAS (sem seed/backfill); caminho novo de invites vazio
  SELECT count(*) INTO v_cnt FROM public.group_actor_memberships;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: casa nova nasceu com % linha(s).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.group_invites WHERE intent_kind IS NOT NULL;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: caminho novo de invites nasceu com % linha(s).', v_cnt; END IF;
END $$;

COMMIT;

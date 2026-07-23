-- ============================================================
-- D9.2-B / F-ORGANIZATIONAL-ACTOR-COMPOSITION — CUTOVER ACTOR-FIRST DA MEMBERSHIP
-- (DECISION-0188 D16 ato D9.2-B · GATE READ-ONLY D9.2-B 2026-07-18 · GO material do titular 2026-07-23)
--
-- O QUE FAZ (envelope material minimo, passos 2-5 e 10 do Gate):
--   1. Substitui o UNIQUE legado de group_invites (uq_group_invite: sem tenant, cobria TODOS os
--      status — historico bloqueava novo convite para sempre) por unicidade PARCIAL tenant-scoped
--      SOMENTE em pending (bloqueador B3 do Gate).
--   2. BACKFILL deterministico: cada linha legada de group_members de grupo ATIVO resolve
--      (tenant_id, user_id, actor_type='user') -> user-actor canonico EXATO (0 ambiguos, 0 orfaos;
--      qualquer divergencia = ABORT) e entra na casa nova SOMENTE pelo writer governado
--      fn_enter_group_actor_membership (idempotente por chave deterministica). Alem disso, o
--      invariante D8 e garantido: o owner civil de TODO grupo ativo possui membership ativa.
--   3. PROVA de igualdade legado x nova NA PROPRIA MIGRATION: toda linha legada de grupo ativo
--      tem correspondencia ATIVA na casa nova; mismatch = RAISE (fail-closed, sem tolerancia).
--   4. CONGELA a casa legada group_members (D4): REVOKE INSERT/UPDATE/DELETE de unificard_app
--      (e PUBLIC). SELECT permanece (projecao estritamente read-only). SEM remocao fisica
--      (remocao = frente posterior propria, D16).
--
-- O QUE NAO FAZ: nao cria casa nova (D9.2-A selada) · nao altera as 5 fns seladas · nao toca
--   Bank (Δbank=0) · nao abre D9.3/D9.4 · nao dropa group_members · nao cria capability/grant.
--
-- IDEMPOTENTE (re-execucao segura) · ADITIVA fora do UNIQUE legado substituido · FORWARD-ONLY ·
-- AGNOSTICA de contagem (DB fresca = 0 grupos; dev = poucos — mesmo resultado governado).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 0. PREFLIGHT FAIL-CLOSED (substrato D9.1 + D9.2-A obrigatorio no ambiente-alvo)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.group_actor_memberships') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: casa group_actor_memberships ausente — aplicar 20260718120000 (D9.2-A) antes do cutover.';
  END IF;
  IF to_regclass('public.group_members') IS NULL OR to_regclass('public.group_invites') IS NULL
     OR to_regclass('public.groups') IS NULL OR to_regclass('public.actors') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: casas legadas (group_members/group_invites/groups/actors) ausentes.';
  END IF;
  IF to_regprocedure('public.fn_enter_group_actor_membership(uuid,uuid,uuid,uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: writer governado fn_enter_group_actor_membership ausente (D9.2-A incompleta).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unificard_app') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: role unificard_app ausente.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. SUBSTITUICAO GOVERNADA DO UNIQUE LEGADO DE INVITES (Gate B3; DECISION-0188 D9)
--    Antes: uq_group_invite (group_id, invited_actor_id) — sem tenant, cobria historicos.
--    Depois: unicidade PARCIAL tenant-scoped SOMENTE pending — rejeicao/expiracao NAO bloqueia
--    novo convite; pending invite e pending request do mesmo par nao coexistem.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_dup BIGINT;
BEGIN
  -- fail-closed: duplicidade pendente impediria o indice parcial novo (nao ha em dev: 0 invites)
  SELECT count(*) INTO v_dup FROM (
    SELECT gi.tenant_id, gi.group_id, gi.invited_actor_id
      FROM public.group_invites gi
     WHERE gi.status = 'pending'
     GROUP BY gi.tenant_id, gi.group_id, gi.invited_actor_id
    HAVING count(*) > 1
  ) d;
  IF v_dup <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % par(es) com mais de uma intencao pendente — impossivel criar unicidade pending.', v_dup;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'uq_group_invite' AND conrelid = 'public.group_invites'::regclass
  ) THEN
    ALTER TABLE public.group_invites DROP CONSTRAINT uq_group_invite;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_gi_pending_per_pair
  ON group_invites (tenant_id, group_id, invited_actor_id)
  WHERE status = 'pending';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. BACKFILL DETERMINISTICO (writer governado; idempotente) + INVARIANTE D8
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r_gm    RECORD;
  r_g     RECORD;
  v_n     BIGINT;
  v_actor UUID;
  v_mid   UUID;
BEGIN
  -- 2a. cada linha legada de grupo ATIVO entra na casa nova via fn_enter (chave deterministica)
  FOR r_gm IN
    SELECT m.id, m.tenant_id, m.group_id, m.user_id
      FROM public.group_members m
      JOIN public.groups gg ON gg.id = m.group_id AND gg.tenant_id = m.tenant_id
     WHERE gg.status = 'active'
     ORDER BY m.created_at, m.id
  LOOP
    SELECT count(*) INTO v_n
      FROM public.actors a
     WHERE a.tenant_id = r_gm.tenant_id AND a.user_id = r_gm.user_id AND a.actor_type = 'user';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: resolucao NAO deterministica da linha legada % (% user-actor(s) para o par tenant+user).', r_gm.id, v_n;
    END IF;
    SELECT a.id INTO v_actor
      FROM public.actors a
     WHERE a.tenant_id = r_gm.tenant_id AND a.user_id = r_gm.user_id AND a.actor_type = 'user';
    IF NOT EXISTS (
      SELECT 1 FROM public.group_actor_memberships x
       WHERE x.tenant_id = r_gm.tenant_id AND x.group_id = r_gm.group_id
         AND x.member_actor_id = v_actor AND x.status = 'active'
    ) THEN
      v_mid := public.fn_enter_group_actor_membership(
        r_gm.tenant_id, r_gm.group_id, v_actor, v_actor, 'cutover-gm:' || r_gm.id::text, NULL);
    END IF;
  END LOOP;

  -- 2b. D8: owner civil de todo grupo ATIVO possui membership ativa (consistente com fn_enter)
  FOR r_g IN
    SELECT gg.id, gg.tenant_id, gg.owner_actor_id
      FROM public.groups gg
     WHERE gg.status = 'active'
     ORDER BY gg.created_at, gg.id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.group_actor_memberships x
       WHERE x.tenant_id = r_g.tenant_id AND x.group_id = r_g.id
         AND x.member_actor_id = r_g.owner_actor_id AND x.status = 'active'
    ) THEN
      v_mid := public.fn_enter_group_actor_membership(
        r_g.tenant_id, r_g.id, r_g.owner_actor_id, r_g.owner_actor_id, 'cutover-owner:' || r_g.id::text, NULL);
    END IF;
  END LOOP;

  -- 2c. PROVA DE IGUALDADE legado x nova (fail-closed; mismatch = ABORT)
  SELECT count(*) INTO v_n
    FROM public.group_members m
    JOIN public.groups gg ON gg.id = m.group_id AND gg.tenant_id = m.tenant_id AND gg.status = 'active'
    JOIN public.actors a  ON a.tenant_id = m.tenant_id AND a.user_id = m.user_id AND a.actor_type = 'user'
   WHERE NOT EXISTS (
     SELECT 1 FROM public.group_actor_memberships x
      WHERE x.tenant_id = m.tenant_id AND x.group_id = m.group_id
        AND x.member_actor_id = a.id AND x.status = 'active');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: igualdade legado x nova VIOLADA — % linha(s) legada(s) sem correspondencia ativa na casa nova.', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.groups gg
   WHERE gg.status = 'active'
     AND NOT EXISTS (
       SELECT 1 FROM public.group_actor_memberships x
        WHERE x.tenant_id = gg.tenant_id AND x.group_id = gg.id
          AND x.member_actor_id = gg.owner_actor_id AND x.status = 'active');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: invariante D8 VIOLADO — % grupo(s) ativo(s) sem membership ativa do owner.', v_n;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. CONGELAMENTO DA CASA LEGADA (D4): projecao estritamente read-only; SEM drop
-- ────────────────────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON group_members FROM unificard_app;
REVOKE INSERT, UPDATE, DELETE ON group_members FROM PUBLIC;

COMMENT ON TABLE group_members IS
  'D9.2-B (DECISION-0188 D4): casa LEGADA CONGELADA no cutover Actor-first — deixou de ser SSOT de membership. Verdade unica = group_actor_memberships (escrita SOMENTE via fns governadas). Aqui: SELECT de projecao apenas; DML revogado de unificard_app; remocao fisica = frente posterior propria.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. POS-VERIFICACAO FAIL-CLOSED
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  SELECT count(*) INTO v_cnt
    FROM information_schema.role_table_grants
   WHERE table_name = 'group_members' AND grantee = 'unificard_app'
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: congelamento falhou — % privilegio(s) DML de unificard_app remanescente(s) em group_members.', v_cnt;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_group_invite') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: UNIQUE legado uq_group_invite ainda existe.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE indexname = 'uq_gi_pending_per_pair'
       AND indexdef LIKE '%tenant_id%' AND indexdef LIKE '%WHERE%'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unicidade pending tenant-scoped (uq_gi_pending_per_pair) ausente.';
  END IF;
END $$;

COMMIT;

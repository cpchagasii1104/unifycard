-- ============================================================
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.2-R1 — UNICIDADE CANONICA DO ACTOR DE USUARIO
-- Fecha a R1 da auditoria Yala da N2-D.2 (responsible_human_actor_id via findByUserId + LIMIT 1 sobre
-- relacao NAO-unica escolhia arbitrariamente). Dominio: ACTORS SSOT (global).
-- ============================================================
-- No maximo UM actor_type='user' por ancora canonica (tenant_id, user_id). Espelha o padrao ja
-- promulgado uq_actors_company_page (WHERE actor_type='page' AND company_id NOT NULL) e uq_actors_group
-- (WHERE actor_type='group' AND group_id NOT NULL) — "uma ancora, um actor canonico". A unicidade e
-- FISICA e POSITIVA; LIMIT 1/ordenacao/documentacao nao decidem qual Actor humano representa o usuario.
-- ESCOPO: SOMENTE actor_type='user'. NAO amplia para actor_human/person/page/group/etc. user_id NULL
-- preserva o contrato atual (ON DELETE SET NULL) e NAO participa da unicidade. ZERO limpeza/backfill/
-- dedup/merge; ZERO alteracao de Authority/grants/eventos/RLS/policies/triggers/owner/ACL. Forward-only.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PRE): aborta se houver QUALQUER duplicidade (nao corrigir dados aqui).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_dups BIGINT;
  v_rows BIGINT;
BEGIN
  IF to_regclass('public.actors') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tabela actors ausente.';
  END IF;

  -- precondicao: o indice ainda nao existe (idempotencia contra reaplicacao divergente)
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_actors_user') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uq_actors_user ja existe — estado divergente.';
  END IF;

  -- ZERO duplicidades da ancora (STOP material se aparecer — nunca apagar/fundir)
  SELECT count(*), COALESCE(sum(n), 0) INTO v_dups, v_rows FROM (
    SELECT count(*) AS n FROM actors
     WHERE actor_type = 'user' AND tenant_id IS NOT NULL AND user_id IS NOT NULL
     GROUP BY tenant_id, user_id HAVING count(*) > 1
  ) d;
  IF v_dups <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % ancora(s) actor_type=user com % row(s) duplicada(s) — R1 NAO limpa dados; STOP para decisao (GO secao 0).', v_dups, v_rows;
  END IF;

  -- terreno esperado: indice historico nao-unico presente (nao sera removido)
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_actors_user_id') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: idx_actors_user_id historico ausente — terreno divergente.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- UNIQUE parcial canonico da ancora do Actor de usuario.
-- ────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX uq_actors_user
  ON actors (tenant_id, user_id)
  WHERE actor_type = 'user' AND tenant_id IS NOT NULL AND user_id IS NOT NULL;

COMMENT ON INDEX uq_actors_user IS
  'N2-D.2-R1 (ressalva Yala R1 da N2-D.2): no maximo UM actor_type=''user'' por ancora (tenant_id, user_id). Barreira FISICA da identidade humana usada como responsible_human_actor_id (findByUserId). Espelha uq_actors_company_page/uq_actors_group. SO actor_type=''user''; user_id NULL fora da unicidade (contrato ON DELETE SET NULL preservado); mesmo user em tenants distintos permitido.';

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (POS): prova a forma exata do indice; aborta (rollback total) se divergir.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def TEXT;
BEGIN
  SELECT indexdef INTO v_def FROM pg_indexes WHERE schemaname='public' AND indexname='uq_actors_user';
  IF v_def IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: uq_actors_user nao foi criado.'; END IF;
  IF v_def !~ 'UNIQUE' THEN RAISE EXCEPTION 'MIGRATION_ABORT: uq_actors_user nao e UNIQUE.'; END IF;
  IF v_def !~ '\(tenant_id, user_id\)' THEN RAISE EXCEPTION 'MIGRATION_ABORT: colunas de uq_actors_user divergentes (esperado tenant_id, user_id): %', v_def; END IF;
  IF v_def !~ $re$actor_type = 'user'$re$ THEN RAISE EXCEPTION 'MIGRATION_ABORT: predicate sem actor_type=user: %', v_def; END IF;
  IF v_def !~ 'user_id IS NOT NULL' OR v_def !~ 'tenant_id IS NOT NULL' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: predicate nao exclui NULLs (tenant_id/user_id IS NOT NULL): %', v_def;
  END IF;
  -- NAO pode ter virado unicidade global por user_id nem abranger outros actor_types
  IF v_def ~* 'actor_human|person|page|group|channel|company' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: predicate amplia alem de actor_type=user: %', v_def;
  END IF;
  -- indice historico preservado
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_actors_user_id') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: idx_actors_user_id historico foi removido — proibido.';
  END IF;
END $$;

COMMIT;

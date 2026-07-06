-- 20260706130000_r2_delegation_rls_and_active_pair_unique.sql
-- R2.2 FIX (ressalvas da auditoria Yala 2026-07-06 sobre o range cf8639c2d..6c8b6dcbf):
--   (RLS) actor_delegations + actor_delegation_events ganham ENABLE+FORCE RLS com policy por
--         app.current_tenant (defense-in-depth na trilha de autoridade — hoje o isolamento depende só das
--         cláusulas WHERE tenant_id + GUC; a doutrina bank_splits/bank_ledger que o R2.1 cita tem RLS+FORCE).
--   (UNIQUE parcial) fecha a janela de concorrência apontada (baixa, pré-existente): dois grants SIMULTÂNEOS
--         do MESMO par partindo de ZERO ativa podiam criar 2 delegações ativas (auto-revoke casava 0 linhas em
--         ambos). Índice único parcial em (tenant, user_actor, institutional_actor) WHERE status='active'
--         serializa: o 2º INSERT concorrente falha por unicidade (o writer roda em TX; o caller re-tenta).
-- Forward-only, idempotente. ZERO bank_* (D4). Espelha o padrão RLS de group_a/group_b financial tables.

-- ── 1. UNIQUE parcial: no máximo 1 delegação ATIVA por par (tenant, user_actor, institutional_actor) ──
-- Só ativas entram no índice; revoked/expired não colidem (histórico preservado). Fecha a corrida de grant.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_actor_delegations_active_pair
  ON actor_delegations (tenant_id, user_actor_id, institutional_actor_id)
  WHERE status = 'active';

-- ── 2. RLS ENABLE + FORCE + policy tenant-scoped nas duas tabelas de autoridade ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['actor_delegations', 'actor_delegation_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = tbl || '_rls') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (tenant_id::text = current_setting(''app.current_tenant'', true)) WITH CHECK (tenant_id::text = current_setting(''app.current_tenant'', true))',
        tbl || '_rls', tbl
      );
    END IF;

    -- bypass só para o papel de infra (migrations/manutenção), espelhando o padrão financeiro.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unificard_infra') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = tbl || '_infra_bypass') THEN
        EXECUTE format('CREATE POLICY %I ON %I TO unificard_infra USING (true)', tbl || '_infra_bypass', tbl);
      END IF;
    END IF;
  END LOOP;
END $$;

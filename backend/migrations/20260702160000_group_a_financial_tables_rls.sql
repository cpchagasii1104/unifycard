-- ============================================================
-- 20260702160000: RLS em 15 tabelas financeiras "Grupo A" (dormentes/request-driven)
-- (varredura colateral do achado B3 do auditoria.md, 2026-07-02)
-- ============================================================
-- Continuação de 20260702150000 (payment_intents/governance_funding_commitments). A varredura
-- sistemática das 25 tabelas financeiras tenant_id NOT NULL sem RLS achou 2 grupos nítidos:
--
--   GRUPO A (esta migration, 15 tabelas): mesmo padrão comprovado seguro de payment_intents —
--     leitores cross-tenant existem em código, mas os workers que os chamam estão CONFIRMADAMENTE
--     default-off (isFinancialWorkerEnabled, sem flag setada em .env) OU não têm worker/caller
--     algum (event_financial_execution: event-scheduler.ts/post-event-split.job.ts são código
--     órfão, zero chamador em todo o repo — grep confirmou). RLS agora converte a dormência de
--     só-flag para flag+RLS estrutural, mesmo padrão de checkout-financial-containment.
--
--   GRUPO B (FICA DE FORA, frente própria): governance_funding, governance_financial_actions,
--     treasury_distributions, treasury_split_config, treasury_split_executions, treasury_accounts.
--     Os workers que os leem cross-tenant (governance-funding-worker.ts,
--     governance-financial-action-worker.ts, treasury-distribution-worker.ts,
--     treasury-split-worker.ts — todos em BOOT.ts) rodam INCONDICIONALMENTE desde o boot, sem
--     nenhuma flag de desligamento. RLS ingênuo aqui quebraria funcionalidade VIVA agora, não
--     dormente. Exige redesenho (worker sob role unificard_infra, ou #34 tenant-loop/DECISION-0149)
--     antes de RLS ser seguro.
--
-- Verificação individual antes desta migration (não é aplicação em lote sem checagem):
--   bank_settlements: Bank Settlement Worker DEFAULT-OFF (BOOT.ts:327, ENABLE_BANK_SETTLEMENT_WORKER).
--   financial_alerts: Financial Alert Worker DEFAULT-OFF (BOOT.ts:367, ENABLE_FINANCIAL_ALERT_WORKER).
--   financial_risk_events: Risk Analysis Worker DEFAULT-OFF (BOOT.ts:393, ENABLE_RISK_ANALYSIS_WORKER).
--   financial_sla_events: SLA Monitor Worker DEFAULT-OFF (BOOT.ts:406, ENABLE_SLA_MONITOR_WORKER).
--   financial_audit_trail: únicos leitores cross-tenant (financial-dashboard/operations-panel
--     controllers) já CONTIDOS (501 INTERNAL_FINANCIAL_AUTHORITY_CONTAINED); zero regressão.
--   escrow_accounts/escrow_transactions/payment_milestones: escrow.repository.ts 100%
--     tenant-scoped (0 pool.query cru — só runQueryWithTenant/getClientWithTenant).
--   financial_circuit_breakers/financial_disputes/financial_freezes/financial_rate_limits: sem
--     worker dedicado em BOOT.ts; queries filtram por tenant_id/actor_id/account_id na prática.
--   payout_requests: os 4 workers que o leem (financial-alert/metrics/risk-analysis/sla-monitor)
--     estão TODOS default-off (mesmos flags acima); reconciliation-engine.service.ts usa
--     getClientWithTenant.
--   actor_bank_destinations: raw pool.query mas todos com WHERE tenant_id explícito.
--   event_financial_execution: event-scheduler.ts/post-event-split.job.ts SEM NENHUM chamador
--     em todo o repo (grep confirmado) — código órfão, mais seguro que "default-off".
--
-- Mesmo padrão canônico de 20260620120000/20260702130000/20260702150000 (ENABLE+FORCE RLS,
-- policy nomeada, infra_bypass para unificard_infra). Lei 2: forward-only, idempotente.
-- ============================================================

BEGIN;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bank_settlements', 'financial_alerts', 'financial_risk_events', 'financial_sla_events',
    'financial_audit_trail', 'escrow_accounts', 'escrow_transactions', 'payment_milestones',
    'financial_circuit_breakers', 'financial_disputes', 'financial_freezes', 'financial_rate_limits',
    'payout_requests', 'actor_bank_destinations', 'event_financial_execution'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = tbl || '_rls') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (tenant_id::text = current_setting(''app.current_tenant'', true)) WITH CHECK (tenant_id::text = current_setting(''app.current_tenant'', true))',
        tbl || '_rls', tbl
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = tbl || '_infra_bypass') THEN
      EXECUTE format('CREATE POLICY %I ON %I TO unificard_infra USING (true)', tbl || '_infra_bypass', tbl);
    END IF;
  END LOOP;
END $$;

-- ── Verificação final ──────────────────────────────────────────────────────
DO $$
DECLARE missing TEXT := '';
        tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'bank_settlements', 'financial_alerts', 'financial_risk_events', 'financial_sla_events',
    'financial_audit_trail', 'escrow_accounts', 'escrow_transactions', 'payment_milestones',
    'financial_circuit_breakers', 'financial_disputes', 'financial_freezes', 'financial_rate_limits',
    'payout_requests', 'actor_bank_destinations', 'event_financial_execution'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = tbl
        AND c.relrowsecurity = true AND c.relforcerowsecurity = true
    ) THEN
      missing := missing || tbl || ' ';
    END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION 'RLS ou FORCE RLS incompleto: %', missing;
  END IF;
  RAISE NOTICE 'RLS + FORCE RLS OK nas 15 tabelas do Grupo A. App role unificard_app respeita todas; unificard_infra bypassa.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual; executar apenas se necessário reverter):
-- BEGIN;
-- DO $$
-- DECLARE tbl TEXT;
-- BEGIN
--   FOREACH tbl IN ARRAY ARRAY[
--     'bank_settlements', 'financial_alerts', 'financial_risk_events', 'financial_sla_events',
--     'financial_audit_trail', 'escrow_accounts', 'escrow_transactions', 'payment_milestones',
--     'financial_circuit_breakers', 'financial_disputes', 'financial_freezes', 'financial_rate_limits',
--     'payout_requests', 'actor_bank_destinations', 'event_financial_execution'
--   ]
--   LOOP
--     EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_rls', tbl);
--     EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_infra_bypass', tbl);
--     EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
--   END LOOP;
-- END $$;
-- COMMIT;
-- ============================================================

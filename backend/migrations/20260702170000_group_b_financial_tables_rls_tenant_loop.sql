-- ============================================================
-- 20260702170000: RLS em 6 tabelas financeiras "Grupo B" (workers ativos → tenant-loop)
-- (F-GROUP-B-FINANCIAL-WORKERS-TENANT-LOOP-RLS · materializa DECISION-0149 para estes workers)
-- ============================================================
-- Fecha o remanescente da varredura do achado B3 do auditoria.md (17/25 fechadas em
-- 20260702150000 + 20260702160000). Estas 6 ficaram de fora porque os workers que as liam
-- cross-tenant rodam INCONDICIONALMENTE desde o boot (governance-funding-worker,
-- governance-financial-action-worker, treasury-distribution-worker, treasury-split-worker em
-- BOOT.ts, sem flag) — RLS sem converter os workers quebraria funcionalidade viva.
--
-- A NORMA JÁ DECIDIU O DESENHO — DECISION-0149 (PROMULGADA, Clayton + IA-DINHEIRO, 2026-06-23):
-- tenant-loop é o padrão canônico p/ acesso cross-tenant sob RLS; runtime normal NUNCA usa
-- conexão global/bypass; unificard_infra sem LOGIN ("usá-lo = fabricar chave-mestra"); discovery
-- de tenants por fonte NÃO-RLS (tabela `tenants`, sem RLS — verificado).
--
-- Esta migration é aplicada JUNTO com a conversão material dos 4 workers para tenant-loop
-- (mesmo commit): claims re-keyados para tenant-scoped (claimNextPendingFundingRequests /
-- listPendingActions / claimNextPendingDistributions / claimNextSettlementsPendingSplit, todos
-- com tenantId + tenant-context via getClientWithTenant/runQueriesWithTenant), cheques de
-- idempotência do split re-keyados (hasExecutionForSettlement ganhou tenantId — com pool cru sob
-- RLS retornaria vazio e QUEBRARIA a proteção anti-split-duplo), listagens cross-tenant mortas
-- removidas (listPendingFundingRequests/listPendingDistributions/listSettlementsPendingSplit —
-- zero callers), listTreasuryAccounts com tenant obrigatório (ramo cross-tenant opcional morto).
--
-- Depende de F-GUC-TENANT-CONTEXT-TRANSACTION-SCOPE-FIX (commit 6850235cc): sem aquele fix, o
-- tenant-context de getClientWithTenant evaporava antes da query — o tenant-loop daqui não
-- funcionaria sob o role restrito.
--
-- Mesmo padrão canônico de 20260620120000/20260702150000/20260702160000 (ENABLE+FORCE RLS,
-- policy tenant, infra_bypass unificard_infra). Lei 2: forward-only, idempotente.
-- ============================================================

BEGIN;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'governance_funding', 'governance_financial_actions', 'treasury_distributions',
    'treasury_split_config', 'treasury_split_executions', 'treasury_accounts'
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
    'governance_funding', 'governance_financial_actions', 'treasury_distributions',
    'treasury_split_config', 'treasury_split_executions', 'treasury_accounts'
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
  RAISE NOTICE 'RLS + FORCE RLS OK nas 6 tabelas do Grupo B. Workers convertidos p/ tenant-loop (DECISION-0149).';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual; executar apenas se necessário reverter — reverter TAMBÉM os workers):
-- BEGIN;
-- DO $$
-- DECLARE tbl TEXT;
-- BEGIN
--   FOREACH tbl IN ARRAY ARRAY[
--     'governance_funding', 'governance_financial_actions', 'treasury_distributions',
--     'treasury_split_config', 'treasury_split_executions', 'treasury_accounts'
--   ]
--   LOOP
--     EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_rls', tbl);
--     EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_infra_bypass', tbl);
--     EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl);
--   END LOOP;
-- END $$;
-- COMMIT;
-- ============================================================

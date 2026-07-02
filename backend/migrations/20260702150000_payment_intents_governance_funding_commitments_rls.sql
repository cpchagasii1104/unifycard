-- ============================================================
-- 20260702150000: RLS em payment_intents + governance_funding_commitments
-- (achado B3 do auditoria.md, 2026-07-02)
-- ============================================================
-- Achado (laudo forense institucional `auditoria.md`, Fable 5, 2026-07-02, revisado e aprovado):
-- payment_intents e governance_funding_commitments são tenant_id NOT NULL mas ficaram fora do
-- hardening de RLS de 20260620120000 (que cobriu bank_*/actors/payout/actor_wallet_*).
--
-- READ-FIRST (varredura completa dos consumidores de ambas antes de escrever esta migration):
--   payment_intents (10 consumidores em código):
--     - 8 usam runQueryWithTenant/runQueriesWithTenant/getClientWithTenant (tenant-scoped, seguros).
--     - 2 usam pool.query CRU e são CROSS-TENANT POR DESENHO, já documentado no próprio BOOT.ts:216,233
--       ("payment_intents NÃO tem RLS → o flip RLS-físico NÃO o torna inerte"): listEscrowedPaymentIntents
--       (payment-intent-repository.ts:240, usado pelo Settlement Worker) e listSettledPaymentIntents
--       (:276, usado pelo Release Worker). AMBOS os workers são DEFAULT-OFF confirmado em código
--       (isFinancialWorkerEnabled) E no ambiente vivo (ENABLE_SETTLEMENT_WORKER/ENABLE_RELEASE_WORKER
--       ausentes de .env). O próprio BOOT.ts já documenta que religar exige #34 tenant-loop primeiro —
--       esta migration é o pré-requisito que esses comentários pedem, não uma ruptura: converte a
--       dormência de "só flag" para "flag + RLS estrutural" (mesmo padrão de defesa-em-profundidade já
--       usado em checkout-financial-containment). Bypass unificard_infra concedido para quando o
--       tenant-loop religar os workers sob esse role (mesmo padrão de 20260620120000).
--   governance_funding_commitments: 1 único consumidor (governance-funding-commitment.repository.ts),
--     tenant-scoped via runQueryWithTenant em toda parte. Sem leitor cross-tenant. Simples.
--
-- NOTA: governance_funding (tabela IRMÃ, sem "_commitments") e treasury_accounts têm leitura
-- cross-tenant ATIVA por desenho (worker de funding pendente + listagem admin) — FICAM DE FORA desta
-- migration; entram numa frente própria com redesenho tipo getClientWithPlatformAdmin, não RLS simples.
--
-- Mesmo padrão canônico de 20260620120000/20260702130000 (ENABLE+FORCE RLS, policy nomeada,
-- infra_bypass para unificard_infra). Lei 2: forward-only, idempotente (DO $$ IF NOT EXISTS).
-- ============================================================

BEGIN;

-- ── payment_intents ──────────────────────────────────────────────────────
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_intents' AND policyname = 'payment_intents_rls') THEN
    CREATE POLICY payment_intents_rls ON payment_intents
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_intents' AND policyname = 'payment_intents_infra_bypass') THEN
    CREATE POLICY payment_intents_infra_bypass ON payment_intents TO unificard_infra USING (true);
  END IF;
END $$;

-- ── governance_funding_commitments ───────────────────────────────────────
ALTER TABLE governance_funding_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_funding_commitments FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'governance_funding_commitments' AND policyname = 'governance_funding_commitments_rls') THEN
    CREATE POLICY governance_funding_commitments_rls ON governance_funding_commitments
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'governance_funding_commitments' AND policyname = 'governance_funding_commitments_infra_bypass') THEN
    CREATE POLICY governance_funding_commitments_infra_bypass ON governance_funding_commitments TO unificard_infra USING (true);
  END IF;
END $$;

-- ── Verificação final ──────────────────────────────────────────────────────
DO $$
DECLARE missing TEXT := '';
        tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['payment_intents', 'governance_funding_commitments']) LOOP
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
  RAISE NOTICE 'RLS + FORCE RLS OK em payment_intents e governance_funding_commitments. App role unificard_app respeita as 2 tabelas; unificard_infra bypassa.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual; executar apenas se necessário reverter):
-- BEGIN;
-- DROP POLICY IF EXISTS payment_intents_rls ON payment_intents;
-- DROP POLICY IF EXISTS payment_intents_infra_bypass ON payment_intents;
-- ALTER TABLE payment_intents DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS governance_funding_commitments_rls ON governance_funding_commitments;
-- DROP POLICY IF EXISTS governance_funding_commitments_infra_bypass ON governance_funding_commitments;
-- ALTER TABLE governance_funding_commitments DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- ============================================================

-- ============================================================
-- MIGRATION: 20260620120000_db_role_rls_hardening.sql
-- F-DB-ROLE-AND-RLS-HARDENING — elimina o "RLS theatre".
--
-- CONTEXTO (Decision Pack): a aplicação conectava como postgres/superuser, que
-- BYPASSA RLS mesmo em tabelas FORCE. Logo o RLS não era proteção efetiva. Esta
-- migration:
--   1. cria a role de aplicação `unificard_app` (NOSUPERUSER / NOBYPASSRLS / sem DDL);
--   2. concede grants mínimos (DML + schema usage + sequences + execute), SEM CREATE/superuser/bypass;
--   3. habilita ENABLE + FORCE RLS + policy tenant-scoped nas 7 tabelas payout/approval/recovery
--      (mesmo padrão canônico de 20260516100000_rls_critical_tables.sql; chave 'app.current_tenant');
--   4. mantém bypass de infraestrutura SOMENTE para `unificard_infra` (workers), nunca para a app.
--
-- NÃO relaxa bank_* (já endurecidas). NÃO abre payout. NÃO semeia PORTA-1. NÃO liga worker.
--
-- ORDEM OPERACIONAL (fora desta migration; sem segredo no repo):
--   1. Aplicar esta migration (cria role NOLOGIN + grants + RLS).
--   2. ops: ALTER ROLE unificard_app WITH LOGIN PASSWORD '<segredo fora do repo>';
--   3. ops: apontar o runtime (APP_DATABASE_URL/DATABASE_URL de runtime) para unificard_app;
--           manter postgres/admin SOMENTE para migrations.
--   4. O pre-flight de boot (db-role-rls-preflight.ts) é fail-closed em produção se o runtime
--      ainda estiver como superuser/BYPASSRLS.
-- Migrations continuam rodando como a role admin (postgres) — nada aqui exige a app role para migrar.
-- ============================================================

BEGIN;

-- ── 1. Role de aplicação (não-superuser, sem bypassrls, sem DDL) ─────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unificard_app') THEN
    CREATE ROLE unificard_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  ELSE
    -- Idempotente + auto-curativo: reforça os atributos seguros mesmo se a role já existir.
    ALTER ROLE unificard_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

-- garante que a role de bypass de infra exista (precedente 20260516100000); a app NUNCA a recebe.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unificard_infra') THEN
    CREATE ROLE unificard_infra;
  END IF;
END $$;

-- ── 2. Grants mínimos para a app role ────────────────────────────────────────
-- CONNECT no database corrente (nome resolvido em runtime; sem hardcode).
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO unificard_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO unificard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO unificard_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO unificard_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO unificard_app;
-- objetos futuros (criados pela role admin nas próximas migrations) herdam os mesmos grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO unificard_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO unificard_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO unificard_app;
-- explicitamente NÃO: GRANT CREATE ON SCHEMA / superuser / BYPASSRLS / CREATEROLE / CREATEDB.

-- ── 3. ENABLE + FORCE RLS + policy tenant-scoped nas 7 tabelas financeiras ────
-- Padrão idêntico ao 20260516100000 (chave de sessão 'app.current_tenant', set via getClientWithTenant).
-- Cada tabela: policy tenant (USING + WITH CHECK) + infra_bypass SOMENTE para unificard_infra.

-- actor_wallet_payout_requests
ALTER TABLE actor_wallet_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_wallet_payout_requests FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actor_wallet_payout_requests' AND policyname = 'actor_wallet_payout_requests_rls') THEN
    CREATE POLICY actor_wallet_payout_requests_rls ON actor_wallet_payout_requests
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actor_wallet_payout_requests' AND policyname = 'actor_wallet_payout_requests_infra_bypass') THEN
    CREATE POLICY actor_wallet_payout_requests_infra_bypass ON actor_wallet_payout_requests TO unificard_infra USING (true);
  END IF;
END $$;

-- financial_approval_policies
ALTER TABLE financial_approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_approval_policies FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_approval_policies' AND policyname = 'financial_approval_policies_rls') THEN
    CREATE POLICY financial_approval_policies_rls ON financial_approval_policies
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_approval_policies' AND policyname = 'financial_approval_policies_infra_bypass') THEN
    CREATE POLICY financial_approval_policies_infra_bypass ON financial_approval_policies TO unificard_infra USING (true);
  END IF;
END $$;

-- financial_approval_authorities
ALTER TABLE financial_approval_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_approval_authorities FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_approval_authorities' AND policyname = 'financial_approval_authorities_rls') THEN
    CREATE POLICY financial_approval_authorities_rls ON financial_approval_authorities
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_approval_authorities' AND policyname = 'financial_approval_authorities_infra_bypass') THEN
    CREATE POLICY financial_approval_authorities_infra_bypass ON financial_approval_authorities TO unificard_infra USING (true);
  END IF;
END $$;

-- financial_approval_policy_events
ALTER TABLE financial_approval_policy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_approval_policy_events FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_approval_policy_events' AND policyname = 'financial_approval_policy_events_rls') THEN
    CREATE POLICY financial_approval_policy_events_rls ON financial_approval_policy_events
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_approval_policy_events' AND policyname = 'financial_approval_policy_events_infra_bypass') THEN
    CREATE POLICY financial_approval_policy_events_infra_bypass ON financial_approval_policy_events TO unificard_infra USING (true);
  END IF;
END $$;

-- approval_requests
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'approval_requests' AND policyname = 'approval_requests_rls') THEN
    CREATE POLICY approval_requests_rls ON approval_requests
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'approval_requests' AND policyname = 'approval_requests_infra_bypass') THEN
    CREATE POLICY approval_requests_infra_bypass ON approval_requests TO unificard_infra USING (true);
  END IF;
END $$;

-- actor_wallet_recovery_obligations
ALTER TABLE actor_wallet_recovery_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_wallet_recovery_obligations FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actor_wallet_recovery_obligations' AND policyname = 'actor_wallet_recovery_obligations_rls') THEN
    CREATE POLICY actor_wallet_recovery_obligations_rls ON actor_wallet_recovery_obligations
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actor_wallet_recovery_obligations' AND policyname = 'actor_wallet_recovery_obligations_infra_bypass') THEN
    CREATE POLICY actor_wallet_recovery_obligations_infra_bypass ON actor_wallet_recovery_obligations TO unificard_infra USING (true);
  END IF;
END $$;

-- actor_wallet_recovery_obligation_entries
ALTER TABLE actor_wallet_recovery_obligation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_wallet_recovery_obligation_entries FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actor_wallet_recovery_obligation_entries' AND policyname = 'actor_wallet_recovery_obligation_entries_rls') THEN
    CREATE POLICY actor_wallet_recovery_obligation_entries_rls ON actor_wallet_recovery_obligation_entries
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actor_wallet_recovery_obligation_entries' AND policyname = 'actor_wallet_recovery_obligation_entries_infra_bypass') THEN
    CREATE POLICY actor_wallet_recovery_obligation_entries_infra_bypass ON actor_wallet_recovery_obligation_entries TO unificard_infra USING (true);
  END IF;
END $$;

-- ── 4. Verificação final (relrowsecurity + relforcerowsecurity nas 7) ────────
DO $$
DECLARE missing TEXT := '';
        tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'actor_wallet_payout_requests','financial_approval_policies','financial_approval_authorities',
    'financial_approval_policy_events','approval_requests','actor_wallet_recovery_obligations',
    'actor_wallet_recovery_obligation_entries'
  ]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = tbl
        AND c.relrowsecurity = true
        AND c.relforcerowsecurity = true
    ) THEN
      missing := missing || tbl || ' ';
    END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION 'RLS ou FORCE RLS incompleto nas tabelas financeiras: %', missing;
  END IF;
  RAISE NOTICE 'RLS + FORCE RLS OK nas 7 tabelas payout/approval/recovery. App role unificard_app: NOSUPERUSER/NOBYPASSRLS.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual; executar apenas se necessário reverter):
-- BEGIN;
-- ALTER TABLE actor_wallet_payout_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE financial_approval_policies DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE financial_approval_authorities DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE financial_approval_policy_events DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE approval_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE actor_wallet_recovery_obligations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE actor_wallet_recovery_obligation_entries DISABLE ROW LEVEL SECURITY;
-- (policies caem junto com DISABLE? não — usar DROP POLICY IF EXISTS por nome se necessário)
-- COMMIT;
-- ============================================================

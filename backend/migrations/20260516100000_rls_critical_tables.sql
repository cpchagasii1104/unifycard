-- ============================================================
-- MIGRATION: 20260516100000_rls_critical_tables.sql
-- Defense-in-depth: Row Level Security + FORCE nas tabelas críticas.
-- v2.1: inclui FORCE RLS + policy para authority_roots via EXISTS/join
-- Ref: docs/ssot/AUTHORITY_PRECEDENCE.md §2, docs/01_normative/SSOT_REGISTRY_UNIFICARD.md §LEDGER BANCÁRIO
--
-- ORDEM DE EXECUÇÃO OBRIGATÓRIA:
--   1. Executar esta migration
--   2. GRANT unificard_infra TO SUBSTITUIR_PELO_USUARIO_REAL_DO_WORKER;
--      -- ⚠️ obrigatório substituir antes de executar
--   3. Reiniciar/subir os workers
-- Inverter essa ordem causa falha nos workers por RLS sem bypass.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unificard_infra') THEN
    CREATE ROLE unificard_infra;
  END IF;
END $$;

-- ── bank_accounts ──────────────────────────────────────────────────────────
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_accounts' AND policyname = 'bank_accounts_rls') THEN
    CREATE POLICY bank_accounts_rls ON bank_accounts
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_accounts' AND policyname = 'bank_accounts_infra_bypass') THEN
    CREATE POLICY bank_accounts_infra_bypass ON bank_accounts TO unificard_infra USING (true);
  END IF;
END $$;

-- ── bank_transactions ──────────────────────────────────────────────────────
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_transactions' AND policyname = 'bank_transactions_rls') THEN
    CREATE POLICY bank_transactions_rls ON bank_transactions
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_transactions' AND policyname = 'bank_transactions_infra_bypass') THEN
    CREATE POLICY bank_transactions_infra_bypass ON bank_transactions TO unificard_infra USING (true);
  END IF;
END $$;

-- ── bank_ledger ────────────────────────────────────────────────────────────
ALTER TABLE bank_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_ledger FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_ledger' AND policyname = 'bank_ledger_rls') THEN
    CREATE POLICY bank_ledger_rls ON bank_ledger
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_ledger' AND policyname = 'bank_ledger_infra_bypass') THEN
    CREATE POLICY bank_ledger_infra_bypass ON bank_ledger TO unificard_infra USING (true);
  END IF;
END $$;

-- ── bank_splits ────────────────────────────────────────────────────────────
ALTER TABLE bank_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_splits FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_splits' AND policyname = 'bank_splits_rls') THEN
    CREATE POLICY bank_splits_rls ON bank_splits
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bank_splits' AND policyname = 'bank_splits_infra_bypass') THEN
    CREATE POLICY bank_splits_infra_bypass ON bank_splits TO unificard_infra USING (true);
  END IF;
END $$;

-- ── actors ─────────────────────────────────────────────────────────────────
ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE actors FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actors' AND policyname = 'actors_rls') THEN
    CREATE POLICY actors_rls ON actors
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actors' AND policyname = 'actors_infra_bypass') THEN
    CREATE POLICY actors_infra_bypass ON actors TO unificard_infra USING (true);
  END IF;
END $$;

-- ── economic_guardianship ──────────────────────────────────────────────────
ALTER TABLE economic_guardianship ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_guardianship FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'economic_guardianship' AND policyname = 'economic_guardianship_rls') THEN
    CREATE POLICY economic_guardianship_rls ON economic_guardianship
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'economic_guardianship' AND policyname = 'economic_guardianship_infra_bypass') THEN
    CREATE POLICY economic_guardianship_infra_bypass ON economic_guardianship TO unificard_infra USING (true);
  END IF;
END $$;

-- ── authority_roots (sem tenant_id: policy via EXISTS/join em actors) ───────
ALTER TABLE authority_roots ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_roots FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'authority_roots' AND policyname = 'authority_roots_rls') THEN
    CREATE POLICY authority_roots_rls ON authority_roots
      USING (
        EXISTS (
          SELECT 1 FROM actors a
          WHERE a.id = authority_roots.actor_id
            AND a.tenant_id::text = current_setting('app.current_tenant', true)
        )
      );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'authority_roots' AND policyname = 'authority_roots_infra_bypass') THEN
    CREATE POLICY authority_roots_infra_bypass ON authority_roots TO unificard_infra USING (true);
  END IF;
END $$;

-- ── Verificação final (pg_class: relrowsecurity + relforcerowsecurity) ─────
DO $$
DECLARE missing TEXT := '';
        tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'bank_accounts','bank_transactions','bank_ledger',
    'bank_splits','actors','economic_guardianship','authority_roots'
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
    RAISE EXCEPTION 'RLS ou FORCE RLS incompleto: %', missing;
  END IF;
  RAISE NOTICE 'RLS + FORCE RLS OK em todas as 7 tabelas críticas.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (executar apenas se necessário reverter):
-- BEGIN;
-- ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bank_ledger DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bank_splits DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE actors DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE economic_guardianship DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE authority_roots DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS bank_accounts_rls ON bank_accounts;
-- DROP POLICY IF EXISTS bank_transactions_rls ON bank_transactions;
-- DROP POLICY IF EXISTS bank_ledger_rls ON bank_ledger;
-- DROP POLICY IF EXISTS bank_splits_rls ON bank_splits;
-- DROP POLICY IF EXISTS actors_rls ON actors;
-- DROP POLICY IF EXISTS economic_guardianship_rls ON economic_guardianship;
-- DROP POLICY IF EXISTS authority_roots_rls ON authority_roots;
-- COMMIT;
-- ============================================================

-- ============================================================
-- UNIFICARD — MIGRATION 121
-- Arquivo: 121_unifywork_rls.sql
-- Banco: PostgreSQL 14+
--
-- DOMÍNIO: UnifyWork (Marketplace de Serviços)
-- CAMADA: SEGURANÇA (ROW LEVEL SECURITY)
--
-- OBJETIVO
-- - Ativar RLS nas tabelas do UnifyWork
-- - Garantir isolamento por tenant
--
-- REGRAS
-- - NÃO criar tabelas
-- - NÃO criar triggers
-- - NÃO criar funções de negócio
-- - SOMENTE ALTER TABLE + CREATE POLICY
--
-- DEPENDÊNCIAS
-- - 120_unifywork_core.sql
-- - current_setting('app.current_tenant')
--
-- ============================================================

BEGIN;

-- ============================================================
-- WORKERS
-- ============================================================

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'workers'
      AND policyname = 'workers_tenant_isolation'
  ) THEN
    CREATE POLICY workers_tenant_isolation
      ON workers
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- SKILLS
-- ============================================================

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'skills'
      AND policyname = 'skills_tenant_isolation'
  ) THEN
    CREATE POLICY skills_tenant_isolation
      ON skills
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- WORKER_SKILLS
-- ============================================================

ALTER TABLE worker_skills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'worker_skills'
      AND policyname = 'worker_skills_tenant_isolation'
  ) THEN
    CREATE POLICY worker_skills_tenant_isolation
      ON worker_skills
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- JOBS
-- ============================================================

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'jobs'
      AND policyname = 'jobs_tenant_isolation'
  ) THEN
    CREATE POLICY jobs_tenant_isolation
      ON jobs
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- JOB_APPLICATIONS
-- ============================================================

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'job_applications'
      AND policyname = 'job_applications_tenant_isolation'
  ) THEN
    CREATE POLICY job_applications_tenant_isolation
      ON job_applications
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- JOB_ASSIGNMENTS
-- ============================================================

ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'job_assignments'
      AND policyname = 'job_assignments_tenant_isolation'
  ) THEN
    CREATE POLICY job_assignments_tenant_isolation
      ON job_assignments
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- WORK_REVIEWS
-- ============================================================

ALTER TABLE work_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'work_reviews'
      AND policyname = 'work_reviews_tenant_isolation'
  ) THEN
    CREATE POLICY work_reviews_tenant_isolation
      ON work_reviews
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

COMMIT;

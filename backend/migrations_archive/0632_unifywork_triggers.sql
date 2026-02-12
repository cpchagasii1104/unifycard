-- ============================================================
-- UNIFICARD — MIGRATION 122
-- Arquivo: 122_unifywork_triggers.sql
-- Banco: PostgreSQL 14+
--
-- DOMÍNIO: UnifyWork (Marketplace de Serviços)
-- CAMADA: AUTOMAÇÃO (TRIGGERS)
--
-- OBJETIVO
-- - Manter colunas updated_at sincronizadas automaticamente
--
-- REGRAS
-- - NÃO criar tabelas
-- - NÃO criar RLS
-- - NÃO criar regras de negócio
-- - SOMENTE helpers + triggers
--
-- DEPENDÊNCIAS
-- - 120_unifywork_core.sql
--
-- ============================================================

BEGIN;

-- ============================================================
-- HELPER PADRÃO (garantia defensiva)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- WORKERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_workers_updated_at ON workers;

CREATE TRIGGER trg_workers_updated_at
BEFORE UPDATE ON workers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- JOBS
-- ============================================================

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;

CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- JOB_ASSIGNMENTS
-- ============================================================

DROP TRIGGER IF EXISTS trg_job_assignments_updated_at ON job_assignments;

CREATE TRIGGER trg_job_assignments_updated_at
BEFORE UPDATE ON job_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;

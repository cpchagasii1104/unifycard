-- ============================================================
-- UNIFICARD — MIGRATION 123
-- Arquivo: 123_unifywork_reputation.sql
-- Banco: PostgreSQL 14+
--
-- DOMÍNIO: UnifyWork (Marketplace de Serviços)
-- CAMADA: REGRA DE NEGÓCIO (REPUTAÇÃO)
--
-- OBJETIVO
-- - Definir cálculo de reputação profissional
-- - Centralizar lógica de score de workers
--
-- REGRAS
-- - NÃO criar tabelas
-- - NÃO criar RLS
-- - NÃO criar triggers
-- - NÃO integrar com financeiro
-- - SOMENTE funções e lógica derivada
--
-- DEPENDÊNCIAS
-- - 120_unifywork_core.sql
--
-- ============================================================

BEGIN;

-- ============================================================
-- FUNÇÃO DE CÁLCULO DE REPUTAÇÃO DO WORKER
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_worker_reputation(p_worker_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_completion_rate NUMERIC;
  v_no_show_penalty INTEGER;
BEGIN
  -- Média das avaliações recebidas como worker
  SELECT AVG(rating)
    INTO v_avg_rating
  FROM work_reviews wr
  JOIN job_assignments ja
    ON ja.assignment_id = wr.assignment_id
  WHERE ja.worker_id = p_worker_id
    AND wr.reviewer_type = 'client';

  -- Taxa de conclusão
  SELECT
    CASE
      WHEN (total_jobs_completed + total_jobs_cancelled) = 0 THEN 0
      ELSE total_jobs_completed::NUMERIC /
           (total_jobs_completed + total_jobs_cancelled)
    END
    INTO v_completion_rate
  FROM workers
  WHERE worker_id = p_worker_id;

  -- Penalidade por no-show
  SELECT no_show_count
    INTO v_no_show_penalty
  FROM workers
  WHERE worker_id = p_worker_id;

  -- Score final normalizado (0–5)
  RETURN LEAST(
    5.0,
    GREATEST(
      0.0,
      COALESCE(v_avg_rating, 0) * 0.5 +
      COALESCE(v_completion_rate, 0) * 5 * 0.3 -
      COALESCE(v_no_show_penalty, 0) * 0.2
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_worker_reputation IS
  'Calcula score de reputação do profissional com base em avaliações, taxa de conclusão e no-shows';

COMMIT;

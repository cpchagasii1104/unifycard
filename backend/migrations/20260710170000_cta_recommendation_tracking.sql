-- 20260710170000_cta_recommendation_tracking.sql
-- F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase B-1 (DECISION-0169 §3).
--
-- Campos ADITIVOS de rastreio da RECOMENDAÇÃO em company_template_applications: de onde veio a
-- recomendação que levou a empresa a aplicar o template (manual · company_type · cnae · accountant ·
-- admin), com confidence/rationale/source herdando o vocabulário de curadoria de
-- cnae_concept_suggestions. NÃO muda a semântica atual: todos NULLABLE (aplicações existentes ficam
-- NULL honesto = origem não rastreada à época); status/customizations/modules_applied INTOCADOS;
-- applyTemplate segue funcionando sem os campos. Sugestão NUNCA autoaplica (0169 §1.R) — estes
-- campos só registram a PROVENIÊNCIA quando um humano autorizado aplica.
-- Forward-only, aditiva, idempotente; zero dado tocado, zero fiscal, zero Bank.

BEGIN;

ALTER TABLE company_template_applications
  ADD COLUMN IF NOT EXISTS recommendation_origin TEXT NULL,
  ADD COLUMN IF NOT EXISTS recommendation_confidence TEXT NULL,
  ADD COLUMN IF NOT EXISTS recommendation_rationale TEXT NULL,
  ADD COLUMN IF NOT EXISTS recommended_from_cnae_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS recommendation_source TEXT NULL;

DO $$
BEGIN
  -- Vocabulário governado da origem (DECISION-0169 §3; espelhado em RECOMMENDATION_ORIGINS no TS).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cta_recommendation_origin') THEN
    ALTER TABLE company_template_applications ADD CONSTRAINT chk_cta_recommendation_origin
      CHECK (recommendation_origin IS NULL OR recommendation_origin IN ('manual', 'company_type', 'cnae', 'accountant', 'admin'));
  END IF;

  -- Origem CNAE exige rationale + source (curadoria — 0169 §3/§6); demais origens ficam livres.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cta_cnae_requires_context') THEN
    ALTER TABLE company_template_applications ADD CONSTRAINT chk_cta_cnae_requires_context
      CHECK (
        recommendation_origin IS DISTINCT FROM 'cnae'
        OR (recommendation_rationale IS NOT NULL AND recommendation_source IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN company_template_applications.recommendation_origin IS
  'DECISION-0169 §3 (Fase B-1). Proveniência da recomendação que levou à aplicação (manual/company_type/cnae/accountant/admin). NULL = aplicação anterior ao rastreio. Sugestão NUNCA autoaplica (§1.R) — isto só registra a origem quando um humano autorizado aplica.';

-- VERIFICAÇÃO PÓS (fail-closed).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name = 'company_template_applications' AND column_name = 'recommendation_origin') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: recommendation_origin nao foi criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cta_recommendation_origin') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_cta_recommendation_origin ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cta_cnae_requires_context') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_cta_cnae_requires_context ausente';
  END IF;
END $$;

COMMIT;

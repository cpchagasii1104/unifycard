-- ============================================================
-- F2-A PJ KYB (DECISION-0086) — fiscal_identity_kyb_requests (workflow KYB auditado)
-- ============================================================
-- Workflow GLOBAL (sem tenant_id) da identidade fiscal PJ: submit -> review -> approved/rejected.
-- Keyed por fiscal_identity_id. NÃO é SSOT fiscal, NÃO é documento, NÃO é company_validation_requests.
-- Auditoria por *_actor_id (FK actors(id)). Transições cobertas: pending -> approved | rejected
-- (suspended/closed/under_review/resubmit = fase posterior). A FONTE da verificação PJ permanece
-- fiscal_identities.kyb_status (DECISION-0086 §3.1); esta tabela é o WORKFLOW de decisão.
-- NÃO inclui: metadata, documentos, file_reference, global_user_id, company_id, tenant_id.
-- Forward-only / idempotente. NÃO toca identities PF, Bank, company_validation_requests, gate.
-- ============================================================

BEGIN;

-- 1) Tabela fiscal_identity_kyb_requests (GLOBAL — sem tenant_id; espelho identity_validation_requests).
CREATE TABLE IF NOT EXISTS fiscal_identity_kyb_requests (
  kyb_request_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_identity_id    UUID NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  submitted_by_actor_id UUID NOT NULL,
  reviewed_by_actor_id  UUID NULL,
  reviewed_at           TIMESTAMPTZ NULL,
  decision_reason       TEXT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Constraints nomeadas (idempotentes).
DO $$
BEGIN
  -- FK para a casa fiscal canônica (subject). Request é subordinada à identidade fiscal.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fikyb_fiscal_identity') THEN
    ALTER TABLE fiscal_identity_kyb_requests ADD CONSTRAINT fk_fikyb_fiscal_identity
      FOREIGN KEY (fiscal_identity_id) REFERENCES fiscal_identities(fiscal_identity_id) ON DELETE CASCADE;
  END IF;
  -- FKs de auditoria -> actors(id) (todas as FKs do schema referenciam actors(id); FK bypassa RLS).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fikyb_submitted_by_actor') THEN
    ALTER TABLE fiscal_identity_kyb_requests ADD CONSTRAINT fk_fikyb_submitted_by_actor
      FOREIGN KEY (submitted_by_actor_id) REFERENCES actors(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fikyb_reviewed_by_actor') THEN
    ALTER TABLE fiscal_identity_kyb_requests ADD CONSTRAINT fk_fikyb_reviewed_by_actor
      FOREIGN KEY (reviewed_by_actor_id) REFERENCES actors(id) ON DELETE SET NULL;
  END IF;
  -- CHECK status enxuto (F2-A: pending/approved/rejected).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fikyb_status') THEN
    ALTER TABLE fiscal_identity_kyb_requests ADD CONSTRAINT chk_fikyb_status
      CHECK (status IN ('pending','approved','rejected'));
  END IF;
  -- CHECK auditoria mínima quando a request sai de pending (approved/rejected exige quem/quando/porquê).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fikyb_final_audit') THEN
    ALTER TABLE fiscal_identity_kyb_requests ADD CONSTRAINT chk_fikyb_final_audit
      CHECK (status = 'pending'
             OR (reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL AND decision_reason IS NOT NULL));
  END IF;
END $$;

-- 3) Partial unique: no máximo 1 request 'pending' por fiscal_identity_id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fikyb_one_pending
  ON fiscal_identity_kyb_requests (fiscal_identity_id) WHERE status = 'pending';

-- 4) Índices de fila/lookup.
CREATE INDEX IF NOT EXISTS idx_fikyb_fiscal_identity ON fiscal_identity_kyb_requests (fiscal_identity_id);
CREATE INDEX IF NOT EXISTS idx_fikyb_status ON fiscal_identity_kyb_requests (status);

COMMENT ON TABLE fiscal_identity_kyb_requests IS
  'DECISION-0086 (F2-A): workflow KYB auditado da identidade fiscal PJ (GLOBAL, keyed fiscal_identity_id). '
  'submit->review->approved/rejected. FONTE da verificacao = fiscal_identities.kyb_status; esta tabela e o '
  'workflow de decisao, nao SSOT fiscal nem documento. Documentos=F2-B; gate authority=F2-C.';

-- VERIFICACAO POS (fail-closed).
DO $$
BEGIN
  IF to_regclass('public.fiscal_identity_kyb_requests') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fiscal_identity_kyb_requests nao foi criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fikyb_status') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_fikyb_status ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fikyb_final_audit') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_fikyb_final_audit ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fikyb_fiscal_identity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fk_fikyb_fiscal_identity ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_fikyb_one_pending') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uq_fikyb_one_pending ausente';
  END IF;
END $$;

COMMIT;

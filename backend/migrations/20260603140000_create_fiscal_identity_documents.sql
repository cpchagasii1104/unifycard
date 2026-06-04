-- ============================================================
-- F2-B PJ KYB DOCUMENTS (DECISION-0087) — fiscal_identity_documents (SSOT documental KYB)
-- ============================================================
-- SSOT documental GLOBAL (sem tenant) de documentos DA EMPRESA, ancorado em fiscal_identity_id
-- (sobrevive à transferência). file_reference OPACO (ponteiro provider-agnóstico) + file_hash —
-- NUNCA blob/base64/metadata. Append-only via supersedes_document_id. Status submitted/accepted/
-- rejected/superseded. document_type literais (DECISION-0087 §3.9). Documentos de PESSOA e provider
-- de storage ficam FORA (DTs próprias). NÃO toca identities PF, Bank, company_validation, gate.
-- Forward-only / idempotente.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS fiscal_identity_documents (
  document_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_identity_id     UUID NOT NULL,
  kyb_request_id         UUID NULL,
  document_type          TEXT NOT NULL,
  document_status        TEXT NOT NULL DEFAULT 'submitted',
  file_reference         TEXT NOT NULL,
  file_hash              TEXT NULL,
  submitted_by_actor_id  UUID NOT NULL,
  reviewed_by_actor_id   UUID NULL,
  reviewed_at            TIMESTAMPTZ NULL,
  decision_reason        TEXT NULL,
  supersedes_document_id UUID NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  -- FK âncora: documento subordinado à identidade fiscal (dono).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fidoc_fiscal_identity') THEN
    ALTER TABLE fiscal_identity_documents ADD CONSTRAINT fk_fidoc_fiscal_identity
      FOREIGN KEY (fiscal_identity_id) REFERENCES fiscal_identities(fiscal_identity_id) ON DELETE CASCADE;
  END IF;
  -- FK request que avaliou (referência, não dono).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fidoc_kyb_request') THEN
    ALTER TABLE fiscal_identity_documents ADD CONSTRAINT fk_fidoc_kyb_request
      FOREIGN KEY (kyb_request_id) REFERENCES fiscal_identity_kyb_requests(kyb_request_id) ON DELETE SET NULL;
  END IF;
  -- FKs de auditoria -> actors(id).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fidoc_submitted_by_actor') THEN
    ALTER TABLE fiscal_identity_documents ADD CONSTRAINT fk_fidoc_submitted_by_actor
      FOREIGN KEY (submitted_by_actor_id) REFERENCES actors(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fidoc_reviewed_by_actor') THEN
    ALTER TABLE fiscal_identity_documents ADD CONSTRAINT fk_fidoc_reviewed_by_actor
      FOREIGN KEY (reviewed_by_actor_id) REFERENCES actors(id) ON DELETE SET NULL;
  END IF;
  -- FK self: append-only (versão anterior).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fidoc_supersedes') THEN
    ALTER TABLE fiscal_identity_documents ADD CONSTRAINT fk_fidoc_supersedes
      FOREIGN KEY (supersedes_document_id) REFERENCES fiscal_identity_documents(document_id) ON DELETE SET NULL;
  END IF;
  -- CHECK status documental.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fidoc_status') THEN
    ALTER TABLE fiscal_identity_documents ADD CONSTRAINT chk_fidoc_status
      CHECK (document_status IN ('submitted','accepted','rejected','superseded'));
  END IF;
  -- CHECK document_type literais (DECISION-0087 §3.9; mesmo CHECK que a migration usa).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fidoc_type') THEN
    ALTER TABLE fiscal_identity_documents ADD CONSTRAINT chk_fidoc_type
      CHECK (document_type IN ('cnpj_registration','articles_of_association','articles_amendment',
                               'business_address_proof','complementary_document'));
  END IF;
  -- CHECK auditoria-no-final: status terminal exige quem/quando/porquê.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fidoc_final_audit') THEN
    ALTER TABLE fiscal_identity_documents ADD CONSTRAINT chk_fidoc_final_audit
      CHECK (document_status = 'submitted'
             OR (reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL AND decision_reason IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fidoc_fiscal_identity ON fiscal_identity_documents (fiscal_identity_id);
CREATE INDEX IF NOT EXISTS idx_fidoc_kyb_request ON fiscal_identity_documents (kyb_request_id);
CREATE INDEX IF NOT EXISTS idx_fidoc_type ON fiscal_identity_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_fidoc_status ON fiscal_identity_documents (document_status);

COMMENT ON TABLE fiscal_identity_documents IS
  'DECISION-0087 (F2-B): SSOT documental KYB da PJ (GLOBAL). Documentos DA EMPRESA, ancorados em '
  'fiscal_identity_id (sobrevivem a transferencia). file_reference OPACO (NAO blob/metadata); '
  'append-only via supersedes_document_id. Provider de storage e docs-de-pessoa = fora (DTs proprias).';
COMMENT ON COLUMN fiscal_identity_documents.file_reference IS
  'Ponteiro OPACO provider-agnostico para o arquivo (NAO blob, NAO base64, NAO metadata). '
  'Provider real (upload/download/antivirus/retention) = fatia propria (DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING).';

-- VERIFICACAO POS (fail-closed).
DO $$
BEGIN
  IF to_regclass('public.fiscal_identity_documents') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fiscal_identity_documents nao foi criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fidoc_type') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_fidoc_type ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fidoc_final_audit') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_fidoc_final_audit ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fidoc_fiscal_identity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fk_fidoc_fiscal_identity ausente';
  END IF;
END $$;

COMMIT;

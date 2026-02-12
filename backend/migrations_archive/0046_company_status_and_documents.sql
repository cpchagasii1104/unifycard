-- ============================================================
-- UNIFICARD — MIGRATION 073
-- Arquivo: 073_company_status_and_documents.sql
-- Tipo: GOVERNANÇA + COMPLIANCE (Companies)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Empresas (PJ) passam por um processo de cadastro e validação
-- que pode envolver documentos oficiais (ex: CNPJ).
--
-- Esta migration introduz:
-- • lifecycle explícito de cadastro da empresa
-- • suporte a upload e auditoria de documentos
--
-- MODELO DE STATUS (company_status)
-- • draft        → rascunho
-- • manual       → preenchido manualmente
-- • pending_doc  → aguardando documentação
-- • validated    → validado
--
-- GOVERNANÇA
-- • O banco NÃO controla transições de status
-- • Regras de avanço/recuo são responsabilidade da aplicação
-- • Documentos são imutáveis historicamente
--
-- REGRAS DE DOCUMENTOS
-- • Apenas 1 documento PENDING por (company + document_type)
-- • Documentos aprovados/rejeitados permanecem para auditoria
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
--
-- DEPENDÊNCIAS
-- • companies
-- • tenants
-- • global_users
--
-- ============================================================


-- ============================================================
-- 1) COMPANY STATUS
-- ============================================================

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS company_status VARCHAR(20) DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_company_status_check'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_company_status_check
      CHECK (company_status IN ('draft', 'manual', 'pending_doc', 'validated'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_company_status
  ON companies(company_status);


-- ============================================================
-- 2) COMPANY DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS company_documents (
  document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  company_id UUID NOT NULL
    REFERENCES companies(company_id) ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  -- Tipo de documento
  document_type VARCHAR(50) NOT NULL,

  -- Arquivo
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',

  -- Status do documento
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraint de status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_documents_status_check'
  ) THEN
    ALTER TABLE company_documents
      ADD CONSTRAINT company_documents_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Regra crítica:
-- Apenas 1 documento PENDING por empresa + tipo
CREATE UNIQUE INDEX IF NOT EXISTS uniq_company_documents_pending
  ON company_documents (company_id, document_type)
  WHERE status = 'pending';


-- ============================================================
-- 3) ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_company_documents_company
  ON company_documents(company_id);

CREATE INDEX IF NOT EXISTS idx_company_documents_user
  ON company_documents(global_user_id);

CREATE INDEX IF NOT EXISTS idx_company_documents_type
  ON company_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_company_documents_status
  ON company_documents(status);


-- ============================================================
-- 4) RLS
-- ============================================================

ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_documents'
      AND policyname = 'company_documents_rls'
  ) THEN
    CREATE POLICY company_documents_rls
      ON company_documents
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;


-- ============================================================
-- 5) TRIGGER updated_at
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_company_documents_updated_at'
  ) THEN
    CREATE TRIGGER trg_company_documents_updated_at
      BEFORE UPDATE ON company_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================================
-- 6) COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN companies.company_status IS
  'Status do cadastro da empresa: draft, manual, pending_doc, validated';

COMMENT ON TABLE company_documents IS
  'Documentos enviados para validação de empresas (histórico preservado)';

COMMENT ON COLUMN company_documents.document_type IS
  'Tipo de documento (ex: cnpj_receita, cnpj_comprovante)';

COMMENT ON COLUMN company_documents.status IS
  'Status do documento: pending, approved ou rejected';


-- ============================================================
-- FIM 073_company_status_and_documents.sql
-- ============================================================














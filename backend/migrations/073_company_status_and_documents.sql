-- ============================================
-- 073_company_status_and_documents.sql
-- Adiciona company_status e suporte a documentos
-- ============================================

-- Adicionar coluna company_status na tabela companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS company_status VARCHAR(20) DEFAULT 'draft' 
CHECK (company_status IN ('draft', 'manual', 'pending_doc', 'validated'));

-- Criar índice para busca por status
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(company_status);

-- Criar tabela de documentos da empresa (se não existir)
CREATE TABLE IF NOT EXISTS company_documents (
  document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  -- Tipo de documento
  document_type VARCHAR(50) NOT NULL, -- 'cnpj_receita', 'cnpj_comprovante', etc.
  
  -- Arquivo
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER, -- em bytes
  mime_type VARCHAR(100) DEFAULT 'application/pdf',
  
  -- Status do documento
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT company_documents_type_unique UNIQUE (company_id, document_type, status) 
    WHERE status = 'pending' -- Apenas um documento pendente por tipo
);

-- Índices para documentos
CREATE INDEX IF NOT EXISTS idx_company_documents_company ON company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_user ON company_documents(global_user_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_type ON company_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_company_documents_status ON company_documents(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_company_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_documents_updated_at
  BEFORE UPDATE ON company_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_company_documents_updated_at();

-- Comentários
COMMENT ON COLUMN companies.company_status IS 'Status do cadastro: draft (rascunho), manual (preenchido manualmente), pending_doc (aguardando documento), validated (validado)';
COMMENT ON TABLE company_documents IS 'Documentos enviados para validação de empresas';
COMMENT ON COLUMN company_documents.document_type IS 'Tipo de documento: cnpj_receita (comprovante da Receita), cnpj_comprovante (outro comprovante)';














/*
Arquivo: 017_rides_driver_vehicle_compliance.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Compliance de motoristas e veículos

Objetivo:
- Gerenciar documentos de motoristas e veículos
- Permitir histórico completo de documentos
- Garantir apenas 1 documento ativo por tipo
*/

-- =========================================================
-- TABELA: DOCUMENTOS DO MOTORISTA
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_driver_documents (
  document_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL,
  driver_id          UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  document_type      VARCHAR(30) NOT NULL,
  file_url           TEXT NOT NULL,

  extracted_data     JSONB DEFAULT '{}'::jsonb,

  expires_at         DATE,
  expiration_notified_at TIMESTAMPTZ,

  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | under_review | approved | rejected | expired

  verified_at        TIMESTAMPTZ,
  verified_by        UUID,
  rejected_reason    TEXT,

  version            INTEGER NOT NULL DEFAULT 1,
  replaced_by        UUID,
  is_current         BOOLEAN NOT NULL DEFAULT true,

  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- ÍNDICES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_rides_driver_documents_driver
  ON rides_driver_documents (driver_id);

CREATE INDEX IF NOT EXISTS idx_rides_driver_documents_status
  ON rides_driver_documents (tenant_id, status);

-- ✔️ Garantia correta: apenas 1 documento ATIVO por tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_rides_driver_documents_current
  ON rides_driver_documents (tenant_id, driver_id, document_type)
  WHERE is_current = true;

-- =========================================================
-- RLS
-- =========================================================

ALTER TABLE rides_driver_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_driver_documents'
      AND policyname = 'rides_driver_documents_rls'
  ) THEN
    CREATE POLICY rides_driver_documents_rls
      ON rides_driver_documents
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- =========================================================
-- TRIGGER updated_at
-- =========================================================

DROP TRIGGER IF EXISTS trg_rides_driver_documents_updated_at
  ON rides_driver_documents;

CREATE TRIGGER trg_rides_driver_documents_updated_at
  BEFORE UPDATE ON rides_driver_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- COMENTÁRIOS
-- =========================================================

COMMENT ON TABLE rides_driver_documents IS
  'Documentos do motorista com histórico completo e apenas um ativo por tipo';

COMMENT ON COLUMN rides_driver_documents.is_current IS
  'Indica o documento atualmente válido para o tipo';

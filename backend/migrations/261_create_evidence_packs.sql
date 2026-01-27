-- ============================================================
-- UNIFICARD — MIGRATION 261
-- Arquivo: 261_create_evidence_packs.sql
-- Tipo: NOVA FUNCIONALIDADE (Evidências & Resolução de Disputas)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration cria a tabela de Evidence Packs para
-- consolidação de evidências, resolução de disputas e auditoria.
--
-- REGRAS:
-- - Append-only: eventos são adicionados, nunca removidos
-- - Imutável após criação
-- - Consolida chat, agreements, audit logs
-- - Usado para disputas, mediação e auditoria
--
-- IDEMPOTÊNCIA
-- Todas as alterações usam IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1) ENUM: evidence_context_type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_context_type') THEN
    CREATE TYPE evidence_context_type AS ENUM (
      'event',
      'booking',
      'bundle',
      'service_order',
      'agreement'
    );
  END IF;
END$$;

-- ============================================================
-- 2) ENUM: dispute_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
    CREATE TYPE dispute_status AS ENUM (
      'NONE',
      'OPEN',
      'IN_MEDIATION',
      'RESOLVED'
    );
  END IF;
END$$;

-- ============================================================
-- 3) TABELA: evidence_packs
-- ============================================================

CREATE TABLE IF NOT EXISTS evidence_packs (
  pack_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  context_type evidence_context_type NOT NULL,
  context_id VARCHAR(255) NOT NULL,
  dispute_status dispute_status NOT NULL DEFAULT 'NONE',
  opened_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  retention_until TIMESTAMP WITH TIME ZONE,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de eventos ordenados
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT evidence_packs_context_unique UNIQUE (tenant_id, context_type, context_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_evidence_packs_tenant_context ON evidence_packs(tenant_id, context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_evidence_packs_tenant_dispute ON evidence_packs(tenant_id, dispute_status) WHERE dispute_status != 'NONE';
CREATE INDEX IF NOT EXISTS idx_evidence_packs_tenant_retention ON evidence_packs(tenant_id, retention_until) WHERE retention_until IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_evidence_packs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_evidence_packs_updated_at
  BEFORE UPDATE ON evidence_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_evidence_packs_updated_at();

-- Comentários para documentação
COMMENT ON TABLE evidence_packs IS 'Dossiês imutáveis de evidências para disputas, mediação e auditoria';
COMMENT ON COLUMN evidence_packs.pack_id IS 'ID único do evidence pack';
COMMENT ON COLUMN evidence_packs.context_type IS 'Tipo de contexto (event, booking, bundle, service_order, agreement)';
COMMENT ON COLUMN evidence_packs.context_id IS 'ID do contexto';
COMMENT ON COLUMN evidence_packs.dispute_status IS 'Status da disputa: NONE, OPEN, IN_MEDIATION, RESOLVED';
COMMENT ON COLUMN evidence_packs.timeline IS 'Array JSON de eventos ordenados (append-only)';
COMMENT ON COLUMN evidence_packs.retention_until IS 'Data até quando as evidências devem ser retidas';





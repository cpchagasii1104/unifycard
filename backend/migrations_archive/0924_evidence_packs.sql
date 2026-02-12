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
-- - Estrutura imutável após criação
-- - Consolida chat, agreements, audit logs
-- - Usado para disputas, mediação e auditoria
--
-- OBSERVAÇÃO CONSTITUCIONAL
-- - Estrutura NÃO usa IF NOT EXISTS (Lei 3: falha deve falhar)
-- - PK oficial é pack_id (UUID)
-- ============================================================

BEGIN;

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

CREATE TABLE evidence_packs (
  pack_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  context_type evidence_context_type NOT NULL,
  context_id VARCHAR(255) NOT NULL,

  dispute_status dispute_status NOT NULL DEFAULT 'NONE',

  opened_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,

  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT evidence_packs_context_unique
    UNIQUE (tenant_id, context_type, context_id)
);

-- ============================================================
-- 4) ÍNDICES
-- ============================================================

CREATE INDEX idx_evidence_packs_tenant_context
  ON evidence_packs(tenant_id, context_type, context_id);

CREATE INDEX idx_evidence_packs_tenant_dispute
  ON evidence_packs(tenant_id, dispute_status)
  WHERE dispute_status != 'NONE';

CREATE INDEX idx_evidence_packs_tenant_retention
  ON evidence_packs(tenant_id, retention_until)
  WHERE retention_until IS NOT NULL;

-- ============================================================
-- 5) TRIGGER updated_at
-- ============================================================

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

-- ============================================================
-- 6) DOCUMENTAÇÃO
-- ============================================================

COMMENT ON TABLE evidence_packs IS
'Dossiês imutáveis de evidências para disputas, mediação e auditoria';

COMMENT ON COLUMN evidence_packs.pack_id IS
'ID único do evidence pack (PK oficial)';

COMMENT ON COLUMN evidence_packs.context_type IS
'Tipo de contexto: event, booking, bundle, service_order, agreement';

COMMENT ON COLUMN evidence_packs.context_id IS
'ID do contexto ao qual o pack está vinculado';

COMMENT ON COLUMN evidence_packs.dispute_status IS
'Status da disputa: NONE, OPEN, IN_MEDIATION, RESOLVED';

COMMENT ON COLUMN evidence_packs.timeline IS
'Array JSON de eventos ordenados (append-only)';

COMMENT ON COLUMN evidence_packs.retention_until IS
'Data limite de retenção legal das evidências';

COMMIT;

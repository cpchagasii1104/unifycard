-- ============================================================
-- UNIFICARD — MIGRATION 163
-- Arquivo: 163_create_company_opportunity_preferences.sql
-- Tipo: ESTRUTURA (Opt-in para Oportunidades)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Estrutura mínima para armazenar preferências de empresas
-- sobre recebimento de oportunidades (RFQ, dispatches, matching).
--
-- ⚠️ REGRAS CANÔNICAS:
-- - NÃO implementa matching automático
-- - NÃO dispara nada automaticamente
-- - Apenas armazena preferência declarada pela empresa
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
--
-- DEPENDÊNCIAS
-- • companies
--
-- ============================================================

-- ============================================================
-- TABELA: company_opportunity_preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS company_opportunity_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Preferências de recebimento
  receive_rfqs BOOLEAN NOT NULL DEFAULT false,
  receive_dispatches BOOLEAN NOT NULL DEFAULT false,
  matching_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: uma preferência por empresa
  CONSTRAINT company_opportunity_preferences_unique_company UNIQUE (company_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_company_opportunity_preferences_company_id
  ON company_opportunity_preferences(company_id);

CREATE INDEX IF NOT EXISTS idx_company_opportunity_preferences_tenant_id
  ON company_opportunity_preferences(tenant_id);

CREATE INDEX IF NOT EXISTS idx_company_opportunity_preferences_receive_rfqs
  ON company_opportunity_preferences(receive_rfqs) WHERE receive_rfqs = true;

CREATE INDEX IF NOT EXISTS idx_company_opportunity_preferences_receive_dispatches
  ON company_opportunity_preferences(receive_dispatches) WHERE receive_dispatches = true;

CREATE INDEX IF NOT EXISTS idx_company_opportunity_preferences_matching_enabled
  ON company_opportunity_preferences(matching_enabled) WHERE matching_enabled = true;

-- Comentários
COMMENT ON TABLE company_opportunity_preferences IS
  'Preferências de empresas sobre recebimento de oportunidades (RFQ, dispatches, matching). Apenas armazena preferência declarada, não implementa matching automático.';

COMMENT ON COLUMN company_opportunity_preferences.receive_rfqs IS
  'Se empresa deseja receber RFQs (Request for Quotation)';

COMMENT ON COLUMN company_opportunity_preferences.receive_dispatches IS
  'Se empresa deseja receber dispatches de oportunidades';

COMMENT ON COLUMN company_opportunity_preferences.matching_enabled IS
  'Se empresa permite ser incluída em sugestões de matching (apenas sugestão, não decisão automática)';

-- ============================================================
-- FIM 163_create_company_opportunity_preferences.sql
-- ============================================================




-- ============================================================
-- UNIFICARD — MIGRATION 259
-- Arquivo: 259_create_agreements.sql
-- Tipo: NOVA FUNCIONALIDADE (Negociação Assistida)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration cria a tabela de Agreement Drafts para
-- negociação assistida entre provider e requester.
--
-- REGRAS:
-- - Nenhum booking/bundle/service-order pode ser confirmado
--   sem um acordo FINALIZED
-- - Ambos os actors devem aceitar explicitamente
-- - Valor final vem do acordo, não do frontend
--
-- IDEMPOTÊNCIA
-- Todas as alterações usam IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1) TABELA DE AGREEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS agreements (
  agreement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  context_type VARCHAR(50) NOT NULL,
  context_id VARCHAR(255) NOT NULL,
  thread_id UUID NULL REFERENCES contextual_threads(thread_id) ON DELETE SET NULL,
  requester_actor_id VARCHAR(255) NOT NULL,
  provider_actor_id VARCHAR(255) NOT NULL,
  price_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  scope TEXT NOT NULL,
  included_items JSONB DEFAULT '[]'::jsonb,
  excluded_items JSONB DEFAULT '[]'::jsonb,
  responsibilities TEXT,
  capacity_assumptions TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  created_by_actor_id VARCHAR(255) NOT NULL,
  created_by_user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_by_actor_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT agreements_status_check CHECK (status IN ('DRAFT', 'PROPOSED', 'ACCEPTED', 'FINALIZED')),
  CONSTRAINT agreements_context_type_check CHECK (context_type IN ('event', 'service', 'rfq', 'booking', 'bundle')),
  CONSTRAINT agreements_price_positive CHECK (price_cents >= 0)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_context ON agreements(tenant_id, context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_thread ON agreements(tenant_id, thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_requester ON agreements(tenant_id, requester_actor_id);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_provider ON agreements(tenant_id, provider_actor_id);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_status ON agreements(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_agreements_tenant_actors ON agreements(tenant_id, requester_actor_id, provider_actor_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agreements_updated_at
  BEFORE UPDATE ON agreements
  FOR EACH ROW
  EXECUTE FUNCTION update_agreements_updated_at();

-- Comentários para documentação
COMMENT ON TABLE agreements IS 'Agreement Drafts para negociação assistida entre provider e requester';
COMMENT ON COLUMN agreements.agreement_id IS 'ID único do acordo';
COMMENT ON COLUMN agreements.context_type IS 'Tipo de contexto (event, service, rfq, booking, bundle)';
COMMENT ON COLUMN agreements.context_id IS 'ID do contexto (eventId, serviceId, etc)';
COMMENT ON COLUMN agreements.thread_id IS 'ID do chat contextual de negociação';
COMMENT ON COLUMN agreements.status IS 'Status: DRAFT, PROPOSED, ACCEPTED, FINALIZED';
COMMENT ON COLUMN agreements.finalized_at IS 'Timestamp de quando o acordo foi finalizado';
COMMENT ON COLUMN agreements.finalized_by_actor_id IS 'Actor que finalizou o acordo';





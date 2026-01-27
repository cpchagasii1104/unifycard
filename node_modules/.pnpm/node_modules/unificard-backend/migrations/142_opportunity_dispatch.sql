-- ============================================================
-- UNIFICARD — OPPORTUNITY DISPATCH DOMAIN
-- Arquivo: 142_opportunity_dispatch.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o domínio de DISPATCH DE OPORTUNIDADES
-- Inspirado no modelo Uber, SEM decisão automática
--
-- REGRAS CANÔNICAS:
-- * Dispatch é NOTIFICAÇÃO, não decisão
-- * Aceitar não garante nada
-- * Rejeitar não penaliza
-- * Expirar não gera score
-- * NÃO faz matching
-- * NÃO prioriza
-- * NÃO escolhe "melhor"
-- * Apenas NOTIFICA quem PODE atuar
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_response') THEN
    CREATE TYPE dispatch_response AS ENUM (
      'accepted',  -- Dispatch aceito
      'declined',  -- Dispatch rejeitado
      'expired'    -- Dispatch expirado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: OPPORTUNITY_DISPATCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunity_dispatches (
  dispatch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: Dispatch é NOTIFICAÇÃO, não decisão
  opportunity_id UUID NOT NULL, -- ID da oportunidade (service, job, project, etc)
  opportunity_type VARCHAR(50) NOT NULL, -- Tipo: 'service', 'job', 'project'
  target_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor que recebe o dispatch
  
  -- Status e Resposta
  response dispatch_response, -- Resposta do actor (nullable até responder)
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ, -- Quando foi respondido (se response não for null)
  expires_at TIMESTAMPTZ, -- Quando expira (opcional)
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT opportunity_dispatches_opportunity_type_valid CHECK (opportunity_type IN ('service', 'job', 'project'))
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_opportunity_dispatches_opportunity_id ON opportunity_dispatches(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_dispatches_opportunity_type ON opportunity_dispatches(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_opportunity_dispatches_target_actor_id ON opportunity_dispatches(target_actor_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_dispatches_tenant_id ON opportunity_dispatches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_dispatches_response ON opportunity_dispatches(response);
CREATE INDEX IF NOT EXISTS idx_opportunity_dispatches_dispatched_at ON opportunity_dispatches(dispatched_at);
CREATE INDEX IF NOT EXISTS idx_opportunity_dispatches_expires_at ON opportunity_dispatches(expires_at);

-- Índice composto para busca de dispatches pendentes por actor
CREATE INDEX IF NOT EXISTS idx_opportunity_dispatches_pending_by_actor 
  ON opportunity_dispatches(target_actor_id, dispatched_at DESC) 
  WHERE response IS NULL;

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_opportunity_dispatches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_opportunity_dispatches_updated_at
  BEFORE UPDATE ON opportunity_dispatches
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_dispatches_updated_at();

-- ============================================================
-- FIM 142_opportunity_dispatch.sql
-- ============================================================

COMMIT;


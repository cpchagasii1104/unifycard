-- Migration: create actor_debts table
-- Tabela para registrar débitos pendentes de atores (usado por penalty.service)

CREATE TABLE IF NOT EXISTS actor_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  debtor_actor_id UUID NOT NULL,
  debtor_actor_type VARCHAR(30) NOT NULL,
  amount_cents BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actor_debts_tenant_actor
  ON actor_debts (tenant_id, debtor_actor_id);

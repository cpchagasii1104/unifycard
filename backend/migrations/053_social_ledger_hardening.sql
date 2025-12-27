-- ================================================
-- UNIFICARD - MIGRATION 053
-- Hardening do Social Ledger (CRÍTICO - DINHEIRO)
-- ================================================

-- ===========================
-- 1) MIGRAR amount DECIMAL -> amount_cents INTEGER
-- ===========================

-- Adicionar coluna temporária
ALTER TABLE social_ledger ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- Migrar dados existentes (se houver)
UPDATE social_ledger
SET amount_cents = ROUND(COALESCE(amount, 0) * 100)::INTEGER
WHERE amount_cents IS NULL;

-- Tornar NOT NULL após migração
ALTER TABLE social_ledger ALTER COLUMN amount_cents SET NOT NULL;

-- Remover coluna antiga (após validação)
-- ALTER TABLE social_ledger DROP COLUMN amount; -- Descomentar após validação

-- ===========================
-- 2) IDEMPOTÊNCIA (evitar duplicação)
-- ===========================

-- Adicionar idempotency_key
ALTER TABLE social_ledger ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- Criar índice único para idempotência
-- Regra: (tenant_id, idempotency_key) deve ser único quando idempotency_key não é NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_ledger_idempotency 
  ON social_ledger (tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- ===========================
-- 3) RLS MELHORADO (tenant + owner_actor_id)
-- ===========================

-- Adicionar coluna owner_actor_id para RLS mais granular
ALTER TABLE social_ledger ADD COLUMN IF NOT EXISTS owner_actor_id UUID REFERENCES actors(actor_id) ON DELETE SET NULL;

-- Criar índice para RLS
CREATE INDEX IF NOT EXISTS idx_social_ledger_owner_actor ON social_ledger (owner_actor_id) WHERE owner_actor_id IS NOT NULL;

-- Dropar política antiga
DROP POLICY IF EXISTS social_ledger_rls ON social_ledger;

-- Nova política: tenant + owner_actor_id (usuário só vê seus próprios lançamentos)
-- Simplificada: RLS por tenant apenas (owner_actor_id será usado para filtros no serviço)
CREATE POLICY social_ledger_rls ON social_ledger
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- 4) VALIDAÇÕES E CONSTRAINTS
-- ===========================

-- Garantir que amount_cents >= 0
ALTER TABLE social_ledger ADD CONSTRAINT social_ledger_amount_cents_check 
  CHECK (amount_cents >= 0);

-- Garantir que transaction_id OU (post_id + cta_id) OU profit_share está presente
-- (ledger só pode ser criado de fonte identificável)
-- NOTA: Constraint comentada por enquanto - pode ser muito restritiva
-- A validação será feita no serviço
-- ALTER TABLE social_ledger ADD CONSTRAINT social_ledger_source_check
--   CHECK (
--     transaction_id IS NOT NULL 
--     OR (post_id IS NOT NULL AND cta_id IS NOT NULL)
--     OR (post_id IS NOT NULL AND amount_type = 'profit_share')
--   );

-- ===========================
-- 5) COMENTÁRIOS
-- ===========================
COMMENT ON COLUMN social_ledger.amount_cents IS 'Valor em centavos (integer para evitar problemas de float)';
COMMENT ON COLUMN social_ledger.idempotency_key IS 'Chave de idempotência para evitar duplicação (tenant_id + idempotency_key único)';
COMMENT ON COLUMN social_ledger.owner_actor_id IS 'Actor que originou o lançamento (para RLS granular e filtros)';

















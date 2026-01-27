-- ============================================================
-- UNIFICARD - MIGRATION 285
-- CORE DE PERMISSÕES FINANCEIRAS — FASE 1
-- Adicionar campos de autoria e trilha de decisão
-- ============================================================
--
-- OBJETIVO:
-- Adicionar campos de autoria rastreável e trilha de decisão
-- em operações financeiras (bank_transactions, bank_ledger, bank_splits).
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Campos são NULLABLE nesta fase (para backfill seguro)
-- - No código: obrigatório preencher para qualquer INSERT novo
-- - Snapshots capturam estado da decisão no momento da criação
-- - Nenhuma criação de transação/ledger/split sem autoria (hard fail no código)
--
-- ============================================================

-- ============================================================
-- TABELA: bank_transactions
-- ============================================================
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS performed_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS acting_for_actor_id UUID NULL,
  ADD COLUMN IF NOT EXISTS acting_for_account_id UUID NULL,
  ADD COLUMN IF NOT EXISTS authority_source VARCHAR(32) NULL
    CHECK (authority_source IS NULL OR authority_source IN ('ownership', 'delegation', 'account_acl', 'system')),
  ADD COLUMN IF NOT EXISTS permission_snapshot JSONB NULL,
  ADD COLUMN IF NOT EXISTS policy_snapshot JSONB NULL;

-- Índices para bank_transactions
CREATE INDEX IF NOT EXISTS idx_bank_transactions_performed_by_user_id
  ON bank_transactions (performed_by_user_id)
  WHERE performed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_acting_for_actor_id
  ON bank_transactions (acting_for_actor_id)
  WHERE acting_for_actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_acting_for_account_id
  ON bank_transactions (acting_for_account_id)
  WHERE acting_for_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_authority
  ON bank_transactions (tenant_id, authority_source, created_at DESC)
  WHERE authority_source IS NOT NULL;

-- ============================================================
-- TABELA: bank_ledger
-- ============================================================
ALTER TABLE bank_ledger
  ADD COLUMN IF NOT EXISTS performed_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS acting_for_actor_id UUID NULL,
  ADD COLUMN IF NOT EXISTS acting_for_account_id UUID NULL,
  ADD COLUMN IF NOT EXISTS authority_source VARCHAR(32) NULL
    CHECK (authority_source IS NULL OR authority_source IN ('ownership', 'delegation', 'account_acl', 'system')),
  ADD COLUMN IF NOT EXISTS permission_snapshot JSONB NULL,
  ADD COLUMN IF NOT EXISTS policy_snapshot JSONB NULL;

-- Índices para bank_ledger
CREATE INDEX IF NOT EXISTS idx_bank_ledger_performed_by_user_id
  ON bank_ledger (performed_by_user_id)
  WHERE performed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_ledger_acting_for_actor_id
  ON bank_ledger (acting_for_actor_id)
  WHERE acting_for_actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_ledger_acting_for_account_id
  ON bank_ledger (acting_for_account_id)
  WHERE acting_for_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_ledger_tenant_authority
  ON bank_ledger (tenant_id, authority_source, created_at DESC)
  WHERE authority_source IS NOT NULL;

-- ============================================================
-- TABELA: bank_splits
-- ============================================================
ALTER TABLE bank_splits
  ADD COLUMN IF NOT EXISTS performed_by_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS acting_for_actor_id UUID NULL,
  ADD COLUMN IF NOT EXISTS acting_for_account_id UUID NULL,
  ADD COLUMN IF NOT EXISTS authority_source VARCHAR(32) NULL
    CHECK (authority_source IS NULL OR authority_source IN ('ownership', 'delegation', 'account_acl', 'system')),
  ADD COLUMN IF NOT EXISTS permission_snapshot JSONB NULL,
  ADD COLUMN IF NOT EXISTS policy_snapshot JSONB NULL;

-- Índices para bank_splits
CREATE INDEX IF NOT EXISTS idx_bank_splits_performed_by_user_id
  ON bank_splits (performed_by_user_id)
  WHERE performed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_splits_acting_for_actor_id
  ON bank_splits (acting_for_actor_id)
  WHERE acting_for_actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_splits_acting_for_account_id
  ON bank_splits (acting_for_account_id)
  WHERE acting_for_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_splits_tenant_authority
  ON bank_splits (tenant_id, authority_source, created_at DESC)
  WHERE authority_source IS NOT NULL;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN bank_transactions.performed_by_user_id IS
  'ID do usuário que executou a operação (quem fez)';

COMMENT ON COLUMN bank_transactions.acting_for_actor_id IS
  'ID do actor em nome do qual a operação foi executada (em nome de quem)';

COMMENT ON COLUMN bank_transactions.acting_for_account_id IS
  'ID da conta em nome da qual a operação foi executada. OBRIGATÓRIO segundo Core Canônico. Em Fase 1: código pode inferir quando ausente. Em Fase 2: será NOT NULL.';

COMMENT ON COLUMN bank_transactions.authority_source IS
  'Fonte da autoridade: ownership (dono da conta), delegation (delegação), account_acl (permissão explícita via ACL da conta), system (sistema)';

COMMENT ON COLUMN bank_transactions.permission_snapshot IS
  'Snapshot da decisão de permissão no momento da criação: { permissionKey, allowed, reason, actorId, userId, decidedAt }';

COMMENT ON COLUMN bank_transactions.policy_snapshot IS
  'Snapshot da resolução de policy no momento da criação: { policyKeyResolved, resolutionPath, inputsUsed, decidedAt }';

COMMENT ON COLUMN bank_ledger.performed_by_user_id IS
  'ID do usuário que executou a operação (quem fez)';

COMMENT ON COLUMN bank_ledger.acting_for_actor_id IS
  'ID do actor em nome do qual a operação foi executada (em nome de quem)';

COMMENT ON COLUMN bank_ledger.acting_for_account_id IS
  'ID da conta em nome da qual a operação foi executada. OBRIGATÓRIO segundo Core Canônico. Em Fase 1: código pode inferir quando ausente. Em Fase 2: será NOT NULL.';

COMMENT ON COLUMN bank_ledger.authority_source IS
  'Fonte da autoridade: ownership (dono da conta), delegation (delegação), account_acl (permissão explícita via ACL da conta), system (sistema)';

COMMENT ON COLUMN bank_ledger.permission_snapshot IS
  'Snapshot da decisão de permissão no momento da criação: { permissionKey, allowed, reason, actorId, userId, decidedAt }';

COMMENT ON COLUMN bank_ledger.policy_snapshot IS
  'Snapshot da resolução de policy no momento da criação: { policyKeyResolved, resolutionPath, inputsUsed, decidedAt }';

COMMENT ON COLUMN bank_splits.performed_by_user_id IS
  'ID do usuário que executou a operação (quem fez)';

COMMENT ON COLUMN bank_splits.acting_for_actor_id IS
  'ID do actor em nome do qual a operação foi executada (em nome de quem)';

COMMENT ON COLUMN bank_splits.acting_for_account_id IS
  'ID da conta em nome da qual a operação foi executada. OBRIGATÓRIO segundo Core Canônico. Em Fase 1: código pode inferir quando ausente. Em Fase 2: será NOT NULL.';

COMMENT ON COLUMN bank_splits.authority_source IS
  'Fonte da autoridade: ownership (dono da conta), delegation (delegação), account_acl (permissão explícita via ACL da conta), system (sistema)';

COMMENT ON COLUMN bank_splits.permission_snapshot IS
  'Snapshot da decisão de permissão no momento da criação: { permissionKey, allowed, reason, actorId, userId, decidedAt }';

COMMENT ON COLUMN bank_splits.policy_snapshot IS
  'Snapshot da resolução de policy no momento da criação: { policyKeyResolved, resolutionPath, inputsUsed, decidedAt }';

-- ============================================================
-- FOREIGN KEYS PLANEJADAS PARA FASE 2
-- ============================================================
-- NOTA: Foreign Keys serão adicionadas na Fase 2 após backfill completo.
--
-- Foreign Keys planejadas:
-- - performed_by_user_id → users(user_id)
-- - acting_for_actor_id → actors(actor_id)
--
-- Motivo do adiamento:
-- - Campos são NULLABLE na Fase 1 (para backfill seguro)
-- - FKs requerem dados consistentes (sem NULLs ou valores inválidos)
-- - Backfill será executado antes da Fase 2
--
-- ============================================================


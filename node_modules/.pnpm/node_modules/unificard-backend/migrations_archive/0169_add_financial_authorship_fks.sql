-- ============================================================
-- UNIFICARD - MIGRATION 288
-- CORE DE PERMISSÕES FINANCEIRAS — FASE 2 (PASSO 3/3)
-- Adicionar Foreign Keys e índices finais
-- ============================================================
--
-- OBJETIVO:
-- Adicionar Foreign Keys para garantir integridade referencial
-- e índices para performance de queries de auditoria.
--
-- PRÉ-REQUISITOS:
-- - Migration 287 (backfill) deve ter sido executada
-- - Todos os registros devem ter acting_for_account_id preenchido
--
-- ============================================================

-- ============================================================
-- TABELA: bank_transactions
-- ============================================================

-- Foreign Key: performed_by_user_id → users(user_id)
ALTER TABLE bank_transactions
  ADD CONSTRAINT fk_bank_transactions_performed_by_user
  FOREIGN KEY (performed_by_user_id)
  REFERENCES users(user_id)
  ON DELETE SET NULL;

-- Foreign Key: acting_for_actor_id → actors(actor_id)
ALTER TABLE bank_transactions
  ADD CONSTRAINT fk_bank_transactions_acting_for_actor
  FOREIGN KEY (acting_for_actor_id)
  REFERENCES actors(actor_id)
  ON DELETE SET NULL;

-- Foreign Key: acting_for_account_id → bank_accounts(account_id)
ALTER TABLE bank_transactions
  ADD CONSTRAINT fk_bank_transactions_acting_for_account
  FOREIGN KEY (acting_for_account_id)
  REFERENCES bank_accounts(account_id)
  ON DELETE RESTRICT;

-- Índices compostos para queries de auditoria (novos)
-- Nota: Índices simples já existem na migration 285
CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_authority_audit
  ON bank_transactions (tenant_id, authority_source, created_at DESC)
  WHERE authority_source IS NOT NULL;

-- ============================================================
-- TABELA: bank_ledger
-- ============================================================

-- Foreign Key: performed_by_user_id → users(user_id)
ALTER TABLE bank_ledger
  ADD CONSTRAINT fk_bank_ledger_performed_by_user
  FOREIGN KEY (performed_by_user_id)
  REFERENCES users(user_id)
  ON DELETE SET NULL;

-- Foreign Key: acting_for_actor_id → actors(actor_id)
ALTER TABLE bank_ledger
  ADD CONSTRAINT fk_bank_ledger_acting_for_actor
  FOREIGN KEY (acting_for_actor_id)
  REFERENCES actors(actor_id)
  ON DELETE SET NULL;

-- Foreign Key: acting_for_account_id → bank_accounts(account_id)
ALTER TABLE bank_ledger
  ADD CONSTRAINT fk_bank_ledger_acting_for_account
  FOREIGN KEY (acting_for_account_id)
  REFERENCES bank_accounts(account_id)
  ON DELETE RESTRICT;

-- Índices compostos para queries de auditoria (novos)
-- Nota: Índices simples já existem na migration 285
CREATE INDEX IF NOT EXISTS idx_bank_ledger_tenant_authority_audit
  ON bank_ledger (tenant_id, authority_source, created_at DESC)
  WHERE authority_source IS NOT NULL;

-- ============================================================
-- TABELA: bank_splits
-- ============================================================

-- Foreign Key: performed_by_user_id → users(user_id)
ALTER TABLE bank_splits
  ADD CONSTRAINT fk_bank_splits_performed_by_user
  FOREIGN KEY (performed_by_user_id)
  REFERENCES users(user_id)
  ON DELETE SET NULL;

-- Foreign Key: acting_for_actor_id → actors(actor_id)
ALTER TABLE bank_splits
  ADD CONSTRAINT fk_bank_splits_acting_for_actor
  FOREIGN KEY (acting_for_actor_id)
  REFERENCES actors(actor_id)
  ON DELETE SET NULL;

-- Foreign Key: acting_for_account_id → bank_accounts(account_id)
ALTER TABLE bank_splits
  ADD CONSTRAINT fk_bank_splits_acting_for_account
  FOREIGN KEY (acting_for_account_id)
  REFERENCES bank_accounts(account_id)
  ON DELETE RESTRICT;

-- Índices compostos para queries de auditoria (novos)
-- Nota: Índices simples já existem na migration 285
CREATE INDEX IF NOT EXISTS idx_bank_splits_tenant_authority_audit
  ON bank_splits (tenant_id, authority_source, created_at DESC)
  WHERE authority_source IS NOT NULL;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON CONSTRAINT fk_bank_transactions_performed_by_user ON bank_transactions IS
  'FK para users: usuário que executou a operação (NULL para operações do sistema)';

COMMENT ON CONSTRAINT fk_bank_transactions_acting_for_actor ON bank_transactions IS
  'FK para actors: actor em nome do qual a operação foi executada (NULL para contas de sistema)';

COMMENT ON CONSTRAINT fk_bank_transactions_acting_for_account ON bank_transactions IS
  'FK para bank_accounts: conta em nome da qual a operação foi executada (OBRIGATÓRIO)';

COMMENT ON CONSTRAINT fk_bank_ledger_performed_by_user ON bank_ledger IS
  'FK para users: usuário que executou a operação (NULL para operações do sistema)';

COMMENT ON CONSTRAINT fk_bank_ledger_acting_for_actor ON bank_ledger IS
  'FK para actors: actor em nome do qual a operação foi executada (NULL para contas de sistema)';

COMMENT ON CONSTRAINT fk_bank_ledger_acting_for_account ON bank_ledger IS
  'FK para bank_accounts: conta em nome da qual a operação foi executada (OBRIGATÓRIO)';

COMMENT ON CONSTRAINT fk_bank_splits_performed_by_user ON bank_splits IS
  'FK para users: usuário que executou a operação (NULL para operações do sistema)';

COMMENT ON CONSTRAINT fk_bank_splits_acting_for_actor ON bank_splits IS
  'FK para actors: actor em nome do qual a operação foi executada (NULL para contas de sistema)';

COMMENT ON CONSTRAINT fk_bank_splits_acting_for_account ON bank_splits IS
  'FK para bank_accounts: conta em nome da qual a operação foi executada (OBRIGATÓRIO)';

-- ============================================================
-- NOTA IMPORTANTE
-- ============================================================
-- Foreign Keys criadas:
-- - performed_by_user_id: ON DELETE SET NULL (permite remoção de usuário)
-- - acting_for_actor_id: ON DELETE SET NULL (permite remoção de actor)
-- - acting_for_account_id: ON DELETE RESTRICT (protege integridade financeira)
--
-- acting_for_actor_id permanece NULLABLE porque:
-- - Contas de sistema (owner_type='system') não têm actor_id correspondente
-- - Backfill pode não ter coberto 100% dos casos
--
-- ============================================================


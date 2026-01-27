-- ============================================================
-- UNIFICARD - MIGRATION 097
-- Actor Debts: due_at (SLA de cobrança)
-- CONTRATO v1.4 / Fase 10
-- ============================================================
--
-- OBJETIVO:
-- Adicionar campo de vencimento (due_at) aos débitos
-- para permitir controle de SLA de cobrança pelo backend.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena a data de vencimento declarada (due_at)
--   • NÃO calcula SLA automaticamente
--   • NÃO aplica bloqueios ou penalidades
-- - A APLICAÇÃO / SCHEDULER:
--   • define o SLA (ex: 7 dias, exceções)
--   • popula due_at no momento da criação do débito
--   • monitora débitos vencidos
--   • aplica penalties via actor_penalties
--
-- DECISÕES IMPORTANTES:
-- - due_at é NOT NULL, mas SEM default dinâmico
-- - Não há UPDATE automático de dados históricos
-- - Política de cobrança é responsabilidade do domínio
--
-- DEPENDÊNCIAS:
-- - actor_debts (migration 093)
--
-- IMPACTO:
-- - Alteração estrutural simples
-- - Sem efeitos colaterais
-- ============================================================


-- ============================================================
-- ADICIONAR COLUNA due_at
-- ============================================================
ALTER TABLE actor_debts
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;


-- ============================================================
-- GARANTIR NOT NULL (APLICAÇÃO DEVE POPULAR)
-- ============================================================
ALTER TABLE actor_debts
  ALTER COLUMN due_at SET NOT NULL;


-- ============================================================
-- ÍNDICE PARA COBRANÇA (MULTI-TENANT)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_actor_debts_due_at_pending
  ON actor_debts (tenant_id, due_at)
  WHERE status = 'PENDING';


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN actor_debts.due_at IS
  'Data de vencimento do débito (SLA definido pela aplicação). Após o vencimento, o backend pode aplicar penalidades.';














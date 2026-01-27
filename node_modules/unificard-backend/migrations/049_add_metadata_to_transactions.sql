-- ============================================================
-- UNIFICARD — MIGRATION 049
-- Arquivo: 049_add_metadata_to_transactions.sql
-- Tipo: PATCH ADITIVO (rastreamento e status de transações)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- A tabela transactions é utilizada por múltiplos módulos
-- do sistema (pagamentos, serviços, assinaturas, etc.).
-- Com o crescimento do sistema, torna-se necessário:
-- • rastrear contexto adicional da transação
-- • acompanhar seu estado operacional
--
-- OBJETIVO
-- Adicionar:
-- • metadata flexível para rastreabilidade por módulo
-- • status explícito para controle de fluxo da transação
--
-- MODELO DE DADOS
-- • metadata (JSONB)
--     → informações auxiliares (ex: módulo, origem, categoria)
-- • status:
--     → pending     : criada, ainda não finalizada
--     → completed   : concluída com sucesso
--     → failed      : falhou durante o processamento
--     → cancelled   : cancelada explicitamente
--
-- REGRAS CRÍTICAS (NÃO VIOLAR)
-- • status representa estado OPERACIONAL, não contábil.
-- • metadata NÃO deve ser usada para valores críticos
--   de cálculo financeiro.
--
-- ESCOPO
-- ✔ Adiciona coluna metadata em transactions
-- ✔ Adiciona coluna status em transactions
-- ✔ Cria índices para consulta por metadata
--
-- ❌ Não altera transações existentes
-- ❌ Não implementa conciliação financeira
-- ❌ Não implementa estorno ou refund
--
-- DEPENDÊNCIAS
-- • transactions
--
-- OBSERVAÇÕES IMPORTANTES
-- • metadata é intencionalmente não tipado para permitir
--   evolução sem migrations frequentes.
-- • O índice GIN em metadata é genérico e deve ser usado
--   apenas para filtros leves e exploração.
-- • O campo metadata->>'module' assume padronização de
--   nomes de módulo na aplicação.
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS
-- • Pode ser executada múltiplas vezes com segurança
--
-- HISTÓRICO
-- • Introduzido para melhorar rastreabilidade de transações
--   em um sistema multi-módulo
--
-- ============================================================


-- ============================================================
-- 1) COLUNA metadata
-- ============================================================

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN transactions.metadata IS
  'Metadados adicionais da transação (ex: módulo, origem, categoria)';


-- ============================================================
-- 2) COLUNA status
-- ============================================================

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed'
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

COMMENT ON COLUMN transactions.status IS
  'Status operacional da transação: pending, completed, failed, cancelled';


-- ============================================================
-- 3) ÍNDICES
-- ============================================================

-- Índice genérico para exploração de metadata
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin
ON transactions USING GIN (metadata);

COMMENT ON INDEX idx_transactions_metadata_gin IS
  'Busca genérica em metadata de transações (uso exploratório)';

-- Índice específico por módulo
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_module
ON transactions ((metadata->>'module'))
WHERE metadata->>'module' IS NOT NULL;

COMMENT ON INDEX idx_transactions_metadata_module IS
  'Filtro de transações por módulo de origem (metadata->>module)';


-- ============================================================
-- FIM 049_add_metadata_to_transactions.sql
-- ============================================================









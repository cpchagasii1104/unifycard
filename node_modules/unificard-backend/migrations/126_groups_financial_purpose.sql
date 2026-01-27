-- Migration: Adicionar campo financial_purpose na tabela groups
-- Data: 2024
-- Descrição: Campo obrigatório para explicar a finalidade dos recursos quando o grupo movimenta dinheiro

-- Adicionar coluna financial_purpose
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS financial_purpose TEXT;

-- Comentário na coluna
COMMENT ON COLUMN groups.financial_purpose IS 
  'Finalidade dos recursos financeiros do grupo. Obrigatório quando hasFinancialIntent = true no metadata.';






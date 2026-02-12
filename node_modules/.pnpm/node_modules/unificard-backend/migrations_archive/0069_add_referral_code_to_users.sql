-- Migration 107: Adicionar campo referral_code à tabela users
-- Data: 2025-01-02
-- Autor: Auditoria Claude + ChatGPT
-- Propósito: Permitir geração e armazenamento de códigos de indicação

-- ============================================================================
-- PROBLEMA IDENTIFICADO:
-- O código em referral.service.ts tenta SELECT/UPDATE users.referral_code,
-- mas esse campo NÃO EXISTE na tabela users!
-- ============================================================================

-- 1. Adicionar coluna referral_code
-- VARCHAR(20) para suportar códigos como 'UNI-ABC123' ou hex de 8 chars
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);

-- 2. Criar índice único para garantir códigos não duplicados no mesmo tenant
-- WHERE NOT NULL para permitir múltiplos NULLs (usuários sem código ainda)
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique 
ON users(tenant_id, referral_code) 
WHERE referral_code IS NOT NULL;

-- 3. Adicionar coluna metadata (para referred_by e outros dados flexíveis)
-- JSONB para queries e índices eficientes
ALTER TABLE users
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Índice para buscar usuários por código (performance)
CREATE INDEX IF NOT EXISTS users_referral_code_lookup_idx
ON users(referral_code)
WHERE referral_code IS NOT NULL;

-- 5. Comentários para documentação
COMMENT ON COLUMN users.referral_code IS 
  'Código de indicação único do usuário (8+ chars alfanuméricos). Imutável após geração. Usado para split de pagamento.';

COMMENT ON COLUMN users.metadata IS 
  'Metadados do usuário incluindo referred_by (quem indicou), preferences, etc. JSONB para flexibilidade.';

-- ============================================================================
-- VERIFICAÇÃO PÓS-MIGRATION:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name IN ('referral_code', 'metadata');
-- ============================================================================

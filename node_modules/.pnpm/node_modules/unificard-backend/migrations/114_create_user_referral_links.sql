-- Migration 108: Criar tabela user_referral_links para motor de split
-- Data: 2025-01-02
-- Autor: Auditoria Claude + ChatGPT
-- Propósito: Vincular "quem indicou quem" de forma auditável para split de pagamento

-- ============================================================================
-- CONTEXTO:
-- - Referral code é chave financeira (não apenas marketing)
-- - Vínculo deve ser IMUTÁVEL após cadastro
-- - Usado pelo motor de split para calcular comissões
-- ============================================================================

-- 1. Criar tabela de vínculos
CREATE TABLE IF NOT EXISTS user_referral_links (
  -- PK
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant (multi-tenancy)
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Quem indicou (recebe comissão)
  referrer_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Quem foi indicado (origem das transações)
  referred_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Código usado no momento do cadastro
  -- IMPORTANTE: Guardamos o código usado, não o código atual do referrer
  -- Isso permite auditoria mesmo se o referrer mudar de código depois
  referral_code_used VARCHAR(20) NOT NULL,
  
  -- Timestamp de criação (imutável)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- CONSTRAINT CRÍTICA: Cada usuário só pode ser indicado UMA vez
  -- Previne múltiplas aplicações de código
  UNIQUE(referred_user_id)
);

-- 2. Índices para performance
-- Busca por tenant (RLS)
CREATE INDEX IF NOT EXISTS user_referral_links_tenant_idx 
ON user_referral_links(tenant_id);

-- Busca "quem eu indiquei" (para dashboard do referrer)
CREATE INDEX IF NOT EXISTS user_referral_links_referrer_idx 
ON user_referral_links(referrer_user_id);

-- Busca "quem me indicou" (para split de pagamento)
CREATE INDEX IF NOT EXISTS user_referral_links_referred_idx 
ON user_referral_links(referred_user_id);

-- 3. Row Level Security
ALTER TABLE user_referral_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'user_referral_links'
      AND policyname = 'user_referral_links_rls'
  ) THEN
    CREATE POLICY user_referral_links_rls ON user_referral_links
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- 4. Comentários para documentação
COMMENT ON TABLE user_referral_links IS 
  'Vínculos de indicação entre usuários. Usado para calcular split de pagamento. Registro IMUTÁVEL após criação.';

COMMENT ON COLUMN user_referral_links.referrer_user_id IS 
  'Usuário que indicou. Recebe % das transações do referred_user_id.';

COMMENT ON COLUMN user_referral_links.referred_user_id IS 
  'Usuário que foi indicado. Transações dele geram comissão para referrer.';

COMMENT ON COLUMN user_referral_links.referral_code_used IS 
  'Código usado no momento do cadastro. Guardado para auditoria mesmo se referrer mudar código depois.';

-- ============================================================================
-- USO NO MOTOR DE SPLIT:
-- 
-- SELECT referrer_user_id 
-- FROM user_referral_links 
-- WHERE referred_user_id = $1;
-- 
-- Se retornar resultado, incluir referrer no split de pagamento.
-- ============================================================================

/*
Arquivo: 315_auth_rate_limit_logs.sql
Projeto: Unificard
Banco: PostgreSQL 14+
Escopo: Rate Limiting para Endpoints de Autenticação

Objetivo:
- Criar tabela para rastrear tentativas de autenticação
- Suportar rate limiting por IP, tenantId, userId, email
- Proteger contra brute force, spam e scraping

Dependências:
- Nenhuma

Status: CORE
Governing Contract: SYSTEM-CANONICAL-INVARIANTS.md
*/

-- ============================================================
-- 1. TABELA DE RATE LIMIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_rate_limit_logs (
  id BIGSERIAL PRIMARY KEY,
  key_type VARCHAR(20) NOT NULL, -- 'ip', 'tenant', 'user', 'email'
  action VARCHAR(50) NOT NULL, -- 'auth.login', 'auth.register', etc.
  key_value VARCHAR(512) NOT NULL, -- IP, tenantId, userId, email
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_key_action_time 
  ON auth_rate_limit_logs(key_type, action, key_value, attempted_at DESC);

-- Índice para cleanup de logs antigos
CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_attempted_at 
  ON auth_rate_limit_logs(attempted_at);

-- Comentários
COMMENT ON TABLE auth_rate_limit_logs IS 
  'Rastreia tentativas de autenticação para rate limiting e detecção de abuso';

COMMENT ON COLUMN auth_rate_limit_logs.key_type IS 
  'Tipo de chave: ip, tenant, user, email';

COMMENT ON COLUMN auth_rate_limit_logs.action IS 
  'Ação de autenticação: auth.login, auth.register, auth.check-cpf, etc.';

COMMENT ON COLUMN auth_rate_limit_logs.key_value IS 
  'Valor da chave (IP, tenantId, userId, email)';

COMMENT ON COLUMN auth_rate_limit_logs.metadata IS 
  'Metadados adicionais (IP, tenantId, userId, email parcial para logs)';

-- ============================================================
-- 2. FUNÇÃO PARA LIMPEZA AUTOMÁTICA (OPCIONAL)
-- ============================================================

-- Nota: Limpeza pode ser feita via job ou script periódico
-- Por enquanto, deixamos como manual

-- ============================================================
-- 3. POLÍTICA DE RETENÇÃO
-- ============================================================

-- Recomendação: Manter logs por 7 dias para análise de abuso
-- Limpeza deve ser feita via script ou job periódico


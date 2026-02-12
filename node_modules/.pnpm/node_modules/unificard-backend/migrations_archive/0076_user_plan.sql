-- ============================================================
-- UNIFICARD — MIGRATION 048
-- Arquivo: 048_add_plan_to_users.sql
-- Tipo: PATCH ADITIVO (planos e usuários de teste)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration introduz suporte inicial a planos de usuário
-- (FREE / PRO / ENTERPRISE) como parte da FASE 3.6 do projeto.
--
-- OBJETIVO
-- Permitir que cada usuário tenha um plano associado,
-- possibilitando controle de limites, recursos e pricing
-- em camadas posteriores do sistema.
--
-- MODELO DE DADOS
-- • plan = 'free' | 'pro' | 'enterprise'
-- • is_test = true | false
--
-- REGRAS CRÍTICAS (NÃO VIOLAR)
-- • plan NÃO substitui RBAC.
-- • plan controla limites e capacidades, não permissões.
-- • is_test indica usuários de teste com comportamento especial.
--
-- ESCOPO
-- ✔ Adiciona coluna plan na tabela users
-- ✔ Adiciona coluna is_test para usuários de teste
-- ✔ Cria índice para busca por plano
--
-- ❌ Não implementa billing
-- ❌ Não implementa cobrança recorrente
-- ❌ Não define limites técnicos por plano
--
-- DEPENDÊNCIAS
-- • users
--
-- OBSERVAÇÕES IMPORTANTES
-- • O uso de CHECK em vez de ENUM é intencional para permitir
--   evolução futura dos planos sem refactor destrutivo.
-- • Usuários com is_test = true podem alternar planos livremente
--   em ambientes de staging, QA ou sandbox.
-- • O plano é definido por usuário, não por tenant ou empresa.
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS
-- • Pode ser executada múltiplas vezes com segurança
--
-- HISTÓRICO
-- • Introduzido na FASE 3.6 para preparar suporte a monetização
--
-- ============================================================


-- ============================================================
-- 1) COLUNA plan
-- ============================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free'
CHECK (plan IN ('free', 'pro', 'enterprise'));

COMMENT ON COLUMN users.plan IS
  'Plano do usuário: free, pro ou enterprise';


-- ============================================================
-- 2) COLUNA is_test
-- ============================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_test IS
  'Indica se o usuário é de teste (pode alternar plano e burlar limites)';


-- ============================================================
-- 3) ÍNDICE PARA BUSCA POR PLANO
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_plan
ON users (plan);

COMMENT ON INDEX idx_users_plan IS
  'Filtro de usuários por plano (free / pro / enterprise)';


-- ============================================================
-- FIM 048_add_plan_to_users.sql
-- ============================================================

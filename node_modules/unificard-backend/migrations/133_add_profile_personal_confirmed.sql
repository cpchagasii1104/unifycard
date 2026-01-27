-- Migration 127: Adicionar campo profile_personal_confirmed na tabela profiles
-- Data: 2024
-- Objetivo: Flag explícita para controlar primeiro acesso e modal de confirmação
-- FONTE ÚNICA DE VERDADE: profile_personal_confirmed BOOLEAN NOT NULL DEFAULT false

-- Adicionar coluna profile_personal_confirmed
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS profile_personal_confirmed BOOLEAN NOT NULL DEFAULT false;

-- Criar índice para melhor performance em queries
CREATE INDEX IF NOT EXISTS idx_profiles_personal_confirmed 
ON profiles(tenant_id, profile_personal_confirmed) 
WHERE profile_personal_confirmed = false;

-- Comentário explicativo
COMMENT ON COLUMN profiles.profile_personal_confirmed IS 
'Flag explícita que indica se o primeiro acesso foi confirmado. false = modal aparece, true = modal não aparece e campos bloqueados. FONTE ÚNICA DE VERDADE para primeiro acesso.';



-- Migration 105: Criar tabela user_profiles para dados civis (CPF)
-- Data: 2024

-- Criar tabela user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  cpf VARCHAR(11) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índice único em cpf
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_cpf_unique ON user_profiles(cpf);

-- Criar índice em user_id para melhor performance em JOINs
CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);






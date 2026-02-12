-- Migration 110: Adicionar constraint UNIQUE em user_id para user_profiles
-- Data: 2025-01-02
-- Propósito: Permitir UPSERT usando ON CONFLICT (user_id)

-- Adicionar constraint UNIQUE em user_id (um usuário só pode ter um registro)
-- Primeiro, remover duplicatas se existirem (manter o mais recente)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Contar duplicatas
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT user_id, COUNT(*) as cnt
    FROM user_profiles
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    -- Remover duplicatas, mantendo apenas o registro mais recente
    DELETE FROM user_profiles up1
    WHERE EXISTS (
      SELECT 1
      FROM user_profiles up2
      WHERE up2.user_id = up1.user_id
        AND up2.created_at > up1.created_at
    );
    
    RAISE NOTICE 'Removidas % duplicatas de user_profiles', duplicate_count;
  END IF;
END $$;

-- Adicionar constraint UNIQUE em user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_user_id_unique'
  ) THEN
    ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
    
    RAISE NOTICE 'Constraint UNIQUE adicionada em user_profiles.user_id';
  ELSE
    RAISE NOTICE 'Constraint UNIQUE já existe em user_profiles.user_id';
  END IF;
END $$;

-- Adicionar coluna updated_at se não existir
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Comentário para documentação
COMMENT ON CONSTRAINT user_profiles_user_id_unique ON user_profiles IS 
  'Garante que cada usuário tenha apenas um registro em user_profiles. Permite UPSERT usando ON CONFLICT (user_id).';





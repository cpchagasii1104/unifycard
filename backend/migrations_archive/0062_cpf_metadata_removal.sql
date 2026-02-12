-- Migration 111: Remover CPF de profiles.metadata e prevenir futuras inserções
-- Data: 2025-01-02
-- Propósito: CPF deve viver APENAS em user_profiles, nunca em metadata
-- 
-- REGRA DE NEGÓCIO:
-- - CPF é único no sistema
-- - CPF é imutável após salvo
-- - CPF só existe em user_profiles
-- - profiles.metadata NUNCA contém CPF

-- PASSO 1: Remover CPF de todos os registros de profiles.metadata
UPDATE profiles
SET metadata = metadata - 'cpf'
WHERE metadata ? 'cpf';

-- Remover também de metadata.personal_profile.cpf (caso exista estrutura aninhada)
UPDATE profiles
SET metadata = jsonb_set(
  metadata,
  '{personal_profile}',
  COALESCE(metadata->'personal_profile', '{}'::jsonb) - 'cpf'
)
WHERE metadata->'personal_profile' ? 'cpf';

-- Log de quantos registros foram limpos
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cleaned_count
  FROM profiles
  WHERE metadata ? 'cpf' OR (metadata->'personal_profile' ? 'cpf');
  
  IF cleaned_count > 0 THEN
    RAISE NOTICE 'Ainda existem % registros com CPF em metadata após limpeza', cleaned_count;
  ELSE
    RAISE NOTICE 'Limpeza concluída: nenhum CPF encontrado em metadata';
  END IF;
END $$;

-- PASSO 2: Criar função trigger para prevenir CPF em metadata no futuro
CREATE OR REPLACE FUNCTION prevent_cpf_in_metadata()
RETURNS trigger AS $$
BEGIN
  -- Remover CPF do nível raiz de metadata
  IF NEW.metadata ? 'cpf' THEN
    NEW.metadata := NEW.metadata - 'cpf';
    RAISE WARNING 'CPF removido de profiles.metadata (nível raiz). CPF deve viver apenas em user_profiles.';
  END IF;
  
  -- Remover CPF de metadata.personal_profile.cpf
  IF NEW.metadata->'personal_profile' ? 'cpf' THEN
    NEW.metadata := jsonb_set(
      NEW.metadata,
      '{personal_profile}',
      COALESCE(NEW.metadata->'personal_profile', '{}'::jsonb) - 'cpf'
    );
    RAISE WARNING 'CPF removido de profiles.metadata.personal_profile.cpf. CPF deve viver apenas em user_profiles.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASSO 3: Criar trigger que executa antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS no_cpf_in_metadata ON profiles;

CREATE TRIGGER no_cpf_in_metadata
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW 
WHEN (NEW.metadata ? 'cpf' OR (NEW.metadata->'personal_profile' ? 'cpf'))
EXECUTE FUNCTION prevent_cpf_in_metadata();

-- Comentários para documentação
COMMENT ON FUNCTION prevent_cpf_in_metadata() IS 
  'Remove automaticamente CPF de profiles.metadata antes de salvar. CPF deve viver apenas em user_profiles.';

COMMENT ON TRIGGER no_cpf_in_metadata ON profiles IS 
  'Previne inserção/atualização de CPF em profiles.metadata. CPF é dado sensível e deve viver apenas em user_profiles.';








-- ============================================================
-- UNIFICARD — Script de Verificação e Correção de CNPJ
-- Arquivo: verify-cnpj-constraint.sql
-- 
-- OBJETIVO
-- Verificar se a constraint companies_cnpj_format está correta
-- (deve aceitar apenas números - 14 dígitos)
-- E normalizar dados existentes se necessário
--
-- USO
-- Executar manualmente no banco se houver erro ao criar empresa
-- ============================================================

-- 1. Verificar constraint atual
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'companies_cnpj_format'
  AND conrelid = 'companies'::regclass;

-- 2. Se a constraint espera formato com pontos/barras, corrigir
-- (Isso remove a constraint antiga e cria a nova)
DO $$
BEGIN
  -- Remover constraint antiga se existir
  ALTER TABLE companies
    DROP CONSTRAINT IF EXISTS companies_cnpj_format;
  
  -- Criar constraint nova: apenas números (14 dígitos)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_cnpj_format'
      AND conrelid = 'companies'::regclass
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_cnpj_format
      CHECK (cnpj ~ '^[0-9]{14}$');
    
    RAISE NOTICE 'Constraint companies_cnpj_format criada/atualizada com sucesso';
  ELSE
    RAISE NOTICE 'Constraint companies_cnpj_format já existe';
  END IF;
END $$;

-- 3. Normalizar CNPJs existentes (remover formatação)
-- ATENÇÃO: Executar apenas se houver CNPJs formatados no banco
UPDATE companies
SET cnpj = REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g')
WHERE cnpj ~ '[^0-9]';

-- 4. Verificar se há CNPJs inválidos (não 14 dígitos)
SELECT 
  company_id,
  cnpj,
  LENGTH(REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g')) AS digitos,
  CASE 
    WHEN LENGTH(REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g')) != 14 
    THEN 'INVÁLIDO' 
    ELSE 'VÁLIDO' 
  END AS status
FROM companies
WHERE LENGTH(REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g')) != 14;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================















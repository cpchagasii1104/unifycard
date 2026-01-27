-- ================================================
-- Script SIMPLIFICADO para remover empresa de teste
-- CNPJ: 32.121.543/0001-53
-- AMBIENTE: DESENVOLVIMENTO LOCAL APENAS
-- ================================================

BEGIN;

-- 1. Identificar a empresa
WITH company_to_delete AS (
  SELECT company_id
  FROM companies
  WHERE cnpj = '32.121.543/0001-53'
),

-- 2. Identificar actor da empresa (empresas são 'page' em actors)
actor_to_delete AS (
  SELECT a.actor_id
  FROM actors a
  JOIN company_to_delete c ON a.company_id = c.company_id
  WHERE a.actor_type = 'page'
)

-- 3. Remover vínculos diretos
DELETE FROM company_users
WHERE company_id IN (SELECT company_id FROM company_to_delete);

-- company_documents (se existir)
DO $$
BEGIN
  DELETE FROM company_documents
  WHERE company_id IN (SELECT company_id FROM company_to_delete);
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- Tabela não existe, ignorar
END $$;

-- 4. Desvincular eventos (NÃO apagar eventos)
UPDATE events
SET actor_id = NULL,
    actor_type = NULL,
    updated_at = now()
WHERE actor_id IN (SELECT actor_id FROM actor_to_delete)
  AND actor_type = 'page';

-- 5. Desvincular accounts (preservar histórico financeiro)
UPDATE accounts
SET owner_id = NULL,
    owner_type = NULL,
    updated_at = now()
WHERE owner_id IN (SELECT company_id::text FROM company_to_delete)
  AND owner_type = 'company';

-- 6. Remover o actor
DELETE FROM actors
WHERE actor_id IN (SELECT actor_id FROM actor_to_delete);

-- 7. Remover a empresa
DELETE FROM companies
WHERE company_id IN (SELECT company_id FROM company_to_delete);

-- Verificar resultado
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empresa removida com sucesso'
    ELSE '⚠️ Empresa ainda existe: ' || string_agg(company_name, ', ')
  END as resultado
FROM companies
WHERE cnpj = '32.121.543/0001-53';

COMMIT;















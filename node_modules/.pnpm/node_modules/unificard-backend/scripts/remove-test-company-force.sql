-- ================================================
-- Script para REMOÇÃO FORÇADA de empresa de teste
-- CNPJ: 32.121.543/0001-53
-- Nome: Teste
-- AMBIENTE: DESENVOLVIMENTO LOCAL APENAS
-- ================================================

BEGIN;

-- 1. Identificar empresa e actor relacionado
DO $$
DECLARE
  v_company_id UUID;
  v_actor_id UUID;
  v_company_name TEXT;
  v_events_updated INTEGER;
  v_accounts_updated INTEGER;
BEGIN
  -- Buscar empresa pelo CNPJ
  SELECT company_id, company_name
  INTO v_company_id, v_company_name
  FROM companies
  WHERE cnpj = '32.121.543/0001-53'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE '⚠️ Empresa não encontrada com CNPJ 32.121.543/0001-53';
    RAISE NOTICE '   Nada a fazer.';
    RETURN;
  END IF;

  RAISE NOTICE '📋 Empresa encontrada: % (ID: %)', v_company_name, v_company_id;

  -- Buscar actor relacionado (empresas são 'page' em actors)
  SELECT actor_id
  INTO v_actor_id
  FROM actors
  WHERE company_id = v_company_id AND actor_type = 'page'
  LIMIT 1;

  IF v_actor_id IS NOT NULL THEN
    RAISE NOTICE '📋 Actor encontrado: %', v_actor_id;
  END IF;

  -- 2. Remover vínculos diretos (NÃO dados históricos)
  RAISE NOTICE '🗑️ Removendo vínculos...';

  -- company_users
  DELETE FROM company_users
  WHERE company_id = v_company_id;
  RAISE NOTICE '   - company_users removidos';

  -- company_documents (se tabela existir)
  BEGIN
    DELETE FROM company_documents
    WHERE company_id = v_company_id;
    RAISE NOTICE '   - company_documents removidos';
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '   - company_documents não existe (ignorado)';
  END;

  -- 3. Desvincular eventos (NÃO apagar eventos)
  IF v_actor_id IS NOT NULL THEN
    UPDATE events
    SET actor_id = NULL,
        actor_type = NULL,
        updated_at = now()
    WHERE actor_id = v_actor_id AND actor_type = 'page';
    
    GET DIAGNOSTICS v_events_updated = ROW_COUNT;
    IF v_events_updated > 0 THEN
      RAISE NOTICE '   - % eventos desvinculados (eventos preservados)', v_events_updated;
    ELSE
      RAISE NOTICE '   - Nenhum evento vinculado';
    END IF;
  END IF;

  -- 4. Desvincular accounts (preservar histórico financeiro)
  UPDATE accounts
  SET owner_id = NULL,
      owner_type = NULL,
      updated_at = now()
  WHERE owner_id = v_company_id::text AND owner_type = 'company';
  
  GET DIAGNOSTICS v_accounts_updated = ROW_COUNT;
  IF v_accounts_updated > 0 THEN
    RAISE NOTICE '   - % accounts desvinculados (histórico financeiro preservado)', v_accounts_updated;
  ELSE
    RAISE NOTICE '   - Nenhum account vinculado';
  END IF;

  -- 5. Remover actor
  IF v_actor_id IS NOT NULL THEN
    DELETE FROM actors
    WHERE actor_id = v_actor_id;
    RAISE NOTICE '   - Actor removido';
  END IF;

  -- 6. Remover empresa
  DELETE FROM companies
  WHERE company_id = v_company_id;
  
  RAISE NOTICE '✅ Empresa removida com sucesso: %', v_company_name;
END $$;

-- Verificar resultado
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empresa removida com sucesso'
    ELSE '⚠️ Empresa ainda existe: ' || string_agg(company_name, ', ')
  END as resultado
FROM companies
WHERE cnpj = '32.121.543/0001-53';

COMMIT;

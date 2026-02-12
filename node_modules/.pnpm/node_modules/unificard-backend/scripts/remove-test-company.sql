-- ================================================
-- Script para remover empresa de teste
-- CNPJ: 32.121.543/0001-53
-- Nome: Teste
-- ================================================

-- 1. Identificar a empresa
DO $$
DECLARE
  v_company_id UUID;
  v_global_user_id UUID;
  v_company_name TEXT;
BEGIN
  -- Buscar empresa pelo CNPJ
  SELECT company_id, global_user_id, company_name
  INTO v_company_id, v_global_user_id, v_company_name
  FROM companies
  WHERE cnpj = '32.121.543/0001-53'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Empresa não encontrada com CNPJ 32.121.543/0001-53';
    RETURN;
  END IF;

  RAISE NOTICE 'Empresa encontrada: % (ID: %, User: %)', v_company_name, v_company_id, v_global_user_id;

  -- 2. Verificar dependências (apenas para log)
  -- company_users (será removido por CASCADE)
  DECLARE
    v_company_users_count INTEGER;
    v_events_count INTEGER;
    v_accounts_count INTEGER;
    v_actor_id UUID;
  BEGIN
    SELECT COUNT(*) INTO v_company_users_count
    FROM company_users
    WHERE company_id = v_company_id;

    -- Buscar actor_id da empresa (empresas são mapeadas como 'page' em actors)
    SELECT actor_id INTO v_actor_id
    FROM actors
    WHERE company_id = v_company_id AND actor_type = 'page'
    LIMIT 1;

    -- Contar eventos vinculados ao actor da empresa
    IF v_actor_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_events_count
      FROM events
      WHERE actor_id = v_actor_id AND actor_type = 'page';
    ELSE
      v_events_count := 0;
    END IF;

    SELECT COUNT(*) INTO v_accounts_count
    FROM accounts
    WHERE owner_id = v_company_id::text AND owner_type = 'company';

    RAISE NOTICE 'Dependências encontradas:';
    RAISE NOTICE '  - company_users: %', v_company_users_count;
    RAISE NOTICE '  - events (via actor): %', v_events_count;
    RAISE NOTICE '  - accounts: %', v_accounts_count;
    IF v_actor_id IS NOT NULL THEN
      RAISE NOTICE '  - actor_id: %', v_actor_id;
    END IF;

    -- 3. Desvincular eventos (não apagar, apenas desvincular)
    -- Empresas são mapeadas como 'page' no sistema de eventos via tabela actors
    IF v_actor_id IS NOT NULL AND v_events_count > 0 THEN
      UPDATE events
      SET actor_id = NULL,
          actor_type = NULL,
          updated_at = now()
      WHERE actor_id = v_actor_id AND actor_type = 'page';
      
      RAISE NOTICE '  - % eventos desvinculados', v_events_count;
    END IF;

    -- 4. Desvincular accounts (manter histórico financeiro)
    IF v_accounts_count > 0 THEN
      -- Não apagar accounts, apenas marcar como inativo ou desvincular
      -- Manter histórico financeiro intacto
      UPDATE accounts
      SET owner_id = NULL,
          owner_type = NULL,
          updated_at = now()
      WHERE owner_id = v_company_id::text AND owner_type = 'company';
      
      RAISE NOTICE '  - % accounts desvinculados (histórico preservado)', v_accounts_count;
    END IF;

    -- 5. Remover actor da empresa (se existir)
    IF v_actor_id IS NOT NULL THEN
      DELETE FROM actors
      WHERE actor_id = v_actor_id;
      RAISE NOTICE '  - Actor removido (actor_id: %)', v_actor_id;
    END IF;

    -- 6. Remover company_users (será feito por CASCADE, mas explicitamente para garantir)
    DELETE FROM company_users
    WHERE company_id = v_company_id;
    
    RAISE NOTICE '  - company_users removidos';

    -- 7. Remover documentos da empresa (se houver tabela)
    BEGIN
      DELETE FROM company_documents
      WHERE company_id = v_company_id;
      RAISE NOTICE '  - Documentos removidos';
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE '  - Tabela company_documents não existe (ignorado)';
    END;

    -- 8. Remover a empresa (hard delete)
    DELETE FROM companies
    WHERE company_id = v_company_id;

    RAISE NOTICE '✅ Empresa removida com sucesso: %', v_company_name;
  END;
END $$;

-- Verificar resultado
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empresa removida com sucesso'
    ELSE '⚠️ Empresa ainda existe: ' || string_agg(company_name, ', ')
  END as resultado
FROM companies
WHERE cnpj = '32.121.543/0001-53';


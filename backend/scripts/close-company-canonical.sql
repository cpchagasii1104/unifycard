-- ============================================================
-- UNIFICARD — LIMPEZA CANÔNICA DE EMPRESA
-- Arquivo: close-company-canonical.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Tornar uma empresa TOTALMENTE INOPERANTE e invisível,
-- sem violar o Database Canonical Truth Contract.
--
-- REGRAS ABSOLUTAS
-- ✅ NÃO apaga eventos, audit logs ou decisões históricas
-- ✅ NÃO truncar tabelas append-only
-- ✅ NÃO reescrever passado
-- ✅ NÃO criar atalhos fora do core
-- ✅ Preserva histórico para auditoria
--
-- USO
-- Parâmetro: company_id (UUID) ou CNPJ (VARCHAR)
-- Exemplo: SELECT close_company_canonical('32.121.543/0001-53');
-- ============================================================

-- ============================================================
-- FUNÇÃO: close_company_canonical
-- ============================================================

CREATE OR REPLACE FUNCTION close_company_canonical(
  p_identifier TEXT  -- company_id (UUID) ou CNPJ
)
RETURNS TABLE(
  company_id UUID,
  company_name TEXT,
  status_before VARCHAR(20),
  status_after VARCHAR(20),
  actions_taken JSONB
) AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
  v_status_before VARCHAR(20);
  v_tenant_id UUID;
  v_actor_id UUID;
  v_actions JSONB := '[]'::jsonb;
  v_count INTEGER;
BEGIN
  -- ============================================================
  -- 1. IDENTIFICAR A EMPRESA
  -- ============================================================
  
  -- Tentar como UUID primeiro
  BEGIN
    v_company_id := p_identifier::UUID;
  EXCEPTION
    WHEN invalid_text_representation THEN
      -- Se não for UUID, tratar como CNPJ
      SELECT c.company_id, c.company_name, c.status, c.tenant_id
      INTO v_company_id, v_company_name, v_status_before, v_tenant_id
      FROM companies c
      WHERE c.cnpj = REPLACE(REPLACE(REPLACE(p_identifier, '.', ''), '/', ''), '-', '')
      LIMIT 1;
      
      IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa não encontrada com identificador: %', p_identifier;
      END IF;
  END;
  
  -- Se foi UUID, buscar dados
  IF v_company_name IS NULL THEN
    SELECT c.company_id, c.company_name, c.status, c.tenant_id
    INTO v_company_id, v_company_name, v_status_before, v_tenant_id
    FROM companies c
    WHERE c.company_id = v_company_id
    LIMIT 1;
    
    IF v_company_id IS NULL THEN
      RAISE EXCEPTION 'Empresa não encontrada com ID: %', p_identifier;
    END IF;
  END IF;
  
  -- Verificar se já está fechada
  IF v_status_before = 'closed' THEN
    RAISE NOTICE 'Empresa % já está fechada', v_company_name;
    RETURN QUERY SELECT v_company_id, v_company_name, v_status_before, 'closed'::VARCHAR(20), '[]'::jsonb;
    RETURN;
  END IF;
  
  -- ============================================================
  -- 2. BUSCAR ACTOR DA EMPRESA (se existir)
  -- ============================================================
  
  SELECT actor_id INTO v_actor_id
  FROM actors
  WHERE company_id = v_company_id AND actor_type = 'page'
  LIMIT 1;
  
  -- ============================================================
  -- 3. MARCAR COMPANY COMO CLOSED
  -- ============================================================
  
  UPDATE companies
  SET status = 'closed',
      updated_at = NOW()
  WHERE company_id = v_company_id;
  
  v_actions := v_actions || jsonb_build_object(
    'action', 'company_closed',
    'count', 1
  );
  
  -- ============================================================
  -- 4. DESATIVAR COMPANY_USERS
  -- ============================================================
  
  UPDATE company_users
  SET is_active = false,
      updated_at = NOW()
  WHERE company_id = v_company_id AND is_active = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_actions := v_actions || jsonb_build_object(
      'action', 'company_users_deactivated',
      'count', v_count
    );
  END IF;
  
  -- ============================================================
  -- 5. SUSPENDER COMPANY_MEMBERS
  -- ============================================================
  
  UPDATE company_members
  SET status = 'suspended',
      updated_at = NOW()
  WHERE company_id = v_company_id AND status = 'active';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_actions := v_actions || jsonb_build_object(
      'action', 'company_members_suspended',
      'count', v_count
    );
  END IF;
  
  -- ============================================================
  -- 6. REVOGAR DELEGAÇÕES RELACIONADAS
  -- ============================================================
  
  IF v_actor_id IS NOT NULL THEN
    -- Revogar delegações onde o actor da empresa é institutional_actor
    UPDATE actor_delegations
    SET status = 'revoked',
        revoked_at = NOW(),
        updated_at = NOW()
    WHERE institutional_actor_id = v_actor_id
      AND status = 'active';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_actions := v_actions || jsonb_build_object(
        'action', 'delegations_revoked',
        'count', v_count
      );
    END IF;
    
    -- Revogar delegações de membros da empresa (onde user_actor é membro)
    UPDATE actor_delegations ad
    SET status = 'revoked',
        revoked_at = NOW(),
        updated_at = NOW()
    FROM company_members cm
    WHERE ad.user_actor_id = cm.actor_id
      AND cm.company_id = v_company_id
      AND ad.status = 'active'
      AND ad.institutional_actor_id = v_actor_id;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_actions := v_actions || jsonb_build_object(
        'action', 'member_delegations_revoked',
        'count', v_count
      );
    END IF;
  END IF;
  
  -- ============================================================
  -- 7. PAUSAR SERVICES DOS ACTORS DA EMPRESA
  -- ============================================================
  
  IF v_actor_id IS NOT NULL THEN
    UPDATE services
    SET status = 'paused',
        updated_at = NOW()
    WHERE actor_id = v_actor_id
      AND status = 'active';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_actions := v_actions || jsonb_build_object(
        'action', 'services_paused',
        'count', v_count
      );
    END IF;
  END IF;
  
  -- ============================================================
  -- 8. DESATIVAR COMPANY_DOMAINS
  -- ============================================================
  
  UPDATE company_domains
  SET enabled = false,
      updated_at = NOW()
  WHERE company_id = v_company_id AND enabled = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    v_actions := v_actions || jsonb_build_object(
      'action', 'company_domains_disabled',
      'count', v_count
    );
  END IF;
  
  -- ============================================================
  -- 9. RETORNAR RESULTADO
  -- ============================================================
  
  RETURN QUERY SELECT
    v_company_id,
    v_company_name,
    v_status_before,
    'closed'::VARCHAR(20),
    v_actions;
  
  RAISE NOTICE '✅ Empresa % (ID: %) fechada canonicamente', v_company_name, v_company_id;
  RAISE NOTICE 'Ações executadas: %', v_actions;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao fechar empresa: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON FUNCTION close_company_canonical IS
  'Fecha empresa canonicamente: marca como closed, desativa vínculos operacionais, '
  'revoga delegações, pausa services, mas preserva histórico para auditoria. '
  'NÃO apaga eventos, logs ou transações financeiras.';

-- ============================================================
-- EXEMPLO DE USO
-- ============================================================
-- 
-- Por CNPJ:
-- SELECT * FROM close_company_canonical('32.121.543/0001-53');
-- 
-- Por company_id:
-- SELECT * FROM close_company_canonical('550e8400-e29b-41d4-a716-446655440000');
-- 
-- ============================================================


-- ================================================
-- UNIFICARD - MIGRAÇÃO DE DADOS
-- FASE 3: MIGRAÇÃO DE DADOS (WRITE CONTROLADO)
-- Script 002: Migrar cultural_event_checkins → event_attendees
-- ================================================
-- 
-- OBJETIVO: Migrar check-ins de cultural_event_checkins para event_attendees
-- conforme CONTRATO DE EVENTOS v1
-- 
-- REGRAS:
-- - Idempotente (pode executar múltiplas vezes)
-- - Preserva informações de check-in
-- - Protegido contra duplicação (ON CONFLICT)
-- - Não remove dados antigos
-- 
-- VERSÃO: 1.0
-- DATA: 28/12/2025
-- ================================================

BEGIN;

-- ===========================
-- 1. VALIDAÇÃO PRÉ-MIGRAÇÃO
-- ===========================

-- Verificar se há check-ins que não podem ser migrados
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- Verificar check-ins sem evento migrado correspondente
    SELECT COUNT(*) INTO invalid_count
    FROM cultural_event_checkins cec
    WHERE NOT EXISTS (
        SELECT 1 FROM events e 
        WHERE e.id = cec.event_id
          AND e.metadata->'source'->>'table' = 'cultural_events'
    );
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Encontrados % check-ins sem evento migrado correspondente. Verifique antes de continuar.', invalid_count;
    END IF;
END $$;

-- ===========================
-- 2. FUNÇÃO AUXILIAR: Buscar actor_id a partir de actor_id/actor_type do check-in
-- ===========================

-- Função para buscar actor_id a partir de actor_id e actor_type do check-in
-- Esta função depende de get_actor_id_from_owner (criada no script 001)
CREATE OR REPLACE FUNCTION get_actor_id_from_checkin(
    p_tenant_id UUID,
    p_actor_id VARCHAR(255),
    p_actor_type VARCHAR(20)
) RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_actor_uuid UUID;
BEGIN
    -- Tentar converter actor_id para UUID
    BEGIN
        v_actor_uuid := p_actor_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_actor_uuid := NULL;
    END;
    
    -- Se actor_type é 'user' ou 'page', buscar na tabela actors
    IF p_actor_type IN ('user', 'page') THEN
        -- Primeiro tentar buscar diretamente por actor_id (se for UUID)
        IF v_actor_uuid IS NOT NULL THEN
            SELECT a.actor_id INTO v_actor_id
            FROM actors a
            WHERE a.tenant_id = p_tenant_id
              AND a.actor_id = v_actor_uuid
              AND a.actor_type = p_actor_type
            LIMIT 1;
        END IF;
        
        -- Se não encontrou, tentar por user_id ou company_id
        IF v_actor_id IS NULL THEN
            IF p_actor_type = 'user' THEN
                SELECT a.actor_id INTO v_actor_id
                FROM actors a
                JOIN users u ON a.user_id = u.user_id
                WHERE a.tenant_id = p_tenant_id
                  AND a.actor_type = 'user'
                  AND (u.user_id::text = p_actor_id OR u.global_user_id::text = p_actor_id)
                LIMIT 1;
            ELSIF p_actor_type = 'page' THEN
                SELECT a.actor_id INTO v_actor_id
                FROM actors a
                JOIN companies c ON a.company_id = c.company_id
                WHERE a.tenant_id = p_tenant_id
                  AND a.actor_type = 'page'
                  AND (c.company_id::text = p_actor_id OR c.company_id = v_actor_uuid)
                LIMIT 1;
            END IF;
        END IF;
    ELSIF p_actor_type = 'cultural_profile' THEN
        -- Se é cultural_profile, buscar via owner_actor_id
        -- Usa função get_actor_id_from_owner (deve existir do script 001)
        IF EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = 'get_actor_id_from_owner'
        ) THEN
            SELECT get_actor_id_from_owner(
                p_tenant_id,
                cp.owner_actor_id,
                cp.owner_actor_type
            ) INTO v_actor_id
            FROM cultural_profiles cp
            WHERE cp.tenant_id = p_tenant_id
              AND (cp.id::text = p_actor_id OR cp.id = v_actor_uuid)
            LIMIT 1;
        END IF;
    END IF;
    
    RETURN v_actor_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================
-- 3. MIGRAÇÃO: cultural_event_checkins → event_attendees
-- ===========================

-- Inserir check-ins migrados (idempotente)
INSERT INTO event_attendees (
    id,
    tenant_id,
    event_id,
    actor_id,
    check_in_time,
    check_in_method,
    checked_in_by_actor_id,
    check_in_status,
    metadata,
    created_at
)
SELECT 
    -- Gerar novo ID (não preservar ID original, pois pode conflitar)
    gen_random_uuid() as id,
    
    -- Campos diretos
    cec.tenant_id,
    cec.event_id,
    
    -- Mapeamento Actor
    get_actor_id_from_checkin(
        cec.tenant_id,
        cec.actor_id::text,
        cec.actor_type
    ) as actor_id,
    
    -- Campos de check-in
    cec.created_at as check_in_time,  -- Usar created_at como check_in_time
    CASE 
        WHEN cec.check_in_method = 'QR_CODE' THEN 'QR'
        WHEN cec.check_in_method = 'MANUAL' THEN 'MANUAL'
        WHEN cec.check_in_method = 'AUTO' THEN 'AUTOMATIC'
        ELSE 'MANUAL'
    END as check_in_method,
    
    -- Quem validou (se foi validação manual)
    CASE 
        WHEN cec.checked_in_by_actor_id IS NOT NULL THEN
            get_actor_id_from_checkin(
                cec.tenant_id,
                cec.checked_in_by_actor_id::text,
                cec.checked_in_by_actor_type
            )
        ELSE NULL
    END as checked_in_by_actor_id,
    
    -- Status do check-in (se tem check_in_time, é CONFIRMED)
    CASE 
        WHEN cec.created_at IS NOT NULL THEN 'CONFIRMED'
        ELSE 'PENDING'
    END as check_in_status,
    
    -- Metadata (preservar informações de origem)
    jsonb_build_object(
        'source', jsonb_build_object(
            'table', 'cultural_event_checkins',
            'id', cec.id,
            'original_actor_id', cec.actor_id,
            'original_actor_type', cec.actor_type,
            'original_check_in_method', cec.check_in_method,
            'geo_lat', cec.geo_lat,
            'geo_lng', cec.geo_lng,
            'device_fingerprint', cec.device_fingerprint,
            'migrated_at', NOW()
        )
    ) as metadata,
    
    -- Timestamp
    cec.created_at

FROM cultural_event_checkins cec
WHERE EXISTS (
    -- Só migrar check-ins de eventos que foram migrados
    SELECT 1 FROM events e 
    WHERE e.id = cec.event_id
      AND e.metadata->'source'->>'table' = 'cultural_events'
)
  -- Idempotência: não inserir se já existe (por event_id + actor_id)
  AND NOT EXISTS (
      SELECT 1 FROM event_attendees ea
      WHERE ea.event_id = cec.event_id
        AND ea.metadata->'source'->>'id' = cec.id::text
  )
ON CONFLICT (event_id, actor_id) DO NOTHING;

-- ===========================
-- 4. ESTATÍSTICAS PÓS-MIGRAÇÃO
-- ===========================

-- Contar check-ins migrados
DO $$
DECLARE
    total_checkins INTEGER;
    total_migrated INTEGER;
    total_skipped INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_checkins FROM cultural_event_checkins;
    SELECT COUNT(*) INTO total_migrated 
    FROM event_attendees 
    WHERE metadata->'source'->>'table' = 'cultural_event_checkins';
    total_skipped := total_checkins - total_migrated;
    
    RAISE NOTICE 'Migração de check-ins concluída:';
    RAISE NOTICE '  Total de cultural_event_checkins: %', total_checkins;
    RAISE NOTICE '  Check-ins migrados: %', total_migrated;
    RAISE NOTICE '  Check-ins não migrados: %', total_skipped;
END $$;

-- ===========================
-- 5. VALIDAÇÃO PÓS-MIGRAÇÃO
-- ===========================

-- Verificar check-ins migrados sem actor_id
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM event_attendees ea
    WHERE ea.metadata->'source'->>'table' = 'cultural_event_checkins'
      AND ea.actor_id IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Encontrados % check-ins migrados sem actor_id válido.', invalid_count;
    END IF;
END $$;

COMMIT;

-- ===========================
-- COMENTÁRIOS
-- ===========================

COMMENT ON FUNCTION get_actor_id_from_checkin IS 'Função auxiliar para buscar actor_id a partir de actor_id/actor_type do check-in (usado na migração)';


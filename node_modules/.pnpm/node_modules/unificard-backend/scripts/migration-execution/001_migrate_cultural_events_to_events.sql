-- ================================================
-- UNIFICARD - MIGRAÇÃO DE DADOS
-- FASE 3: MIGRAÇÃO DE DADOS (WRITE CONTROLADO)
-- Script 001: Migrar cultural_events → events
-- ================================================
-- 
-- OBJETIVO: Migrar dados reais de cultural_events para events
-- conforme CONTRATO DE EVENTOS v1
-- 
-- REGRAS:
-- - Idempotente (pode executar múltiplas vezes)
-- - Preserva IDs originais
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

-- Verificar se há eventos que não podem ser migrados
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM cultural_events ce
    LEFT JOIN cultural_profiles cp ON ce.created_by_cultural_profile_id = cp.id
    WHERE cp.id IS NULL 
       OR cp.owner_actor_id IS NULL 
       OR cp.owner_actor_type NOT IN ('user', 'page');
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Encontrados % eventos com problemas de mapeamento. Verifique antes de continuar.', invalid_count;
    END IF;
END $$;

-- ===========================
-- 2. FUNÇÃO AUXILIAR: Buscar actor_id a partir de owner_actor_id
-- ===========================

-- Função para buscar actor_id a partir de owner_actor_id e owner_actor_type
-- Esta função é criada antes do INSERT para ser usada na migração
CREATE OR REPLACE FUNCTION get_actor_id_from_owner(
    p_tenant_id UUID,
    p_owner_actor_id VARCHAR(255),
    p_owner_actor_type VARCHAR(20)
) RETURNS UUID AS $$
DECLARE
    v_actor_id UUID;
    v_owner_uuid UUID;
BEGIN
    -- Tentar converter owner_actor_id para UUID
    BEGIN
        v_owner_uuid := p_owner_actor_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_owner_uuid := NULL;
    END;
    
    -- Buscar actor baseado em owner_actor_type
    IF p_owner_actor_type = 'user' THEN
        -- Primeiro tentar buscar por actor_id direto (se owner_actor_id é UUID)
        IF v_owner_uuid IS NOT NULL THEN
            SELECT a.actor_id INTO v_actor_id
            FROM actors a
            WHERE a.tenant_id = p_tenant_id
              AND a.actor_id = v_owner_uuid
              AND a.actor_type = 'user'
            LIMIT 1;
        END IF;
        
        -- Se não encontrou, buscar por user_id
        IF v_actor_id IS NULL THEN
            SELECT a.actor_id INTO v_actor_id
            FROM actors a
            JOIN users u ON a.user_id = u.user_id
            WHERE a.tenant_id = p_tenant_id
              AND a.actor_type = 'user'
              AND (u.user_id::text = p_owner_actor_id OR u.global_user_id::text = p_owner_actor_id)
            LIMIT 1;
        END IF;
    ELSIF p_owner_actor_type = 'page' THEN
        -- Primeiro tentar buscar por actor_id direto (se owner_actor_id é UUID)
        IF v_owner_uuid IS NOT NULL THEN
            SELECT a.actor_id INTO v_actor_id
            FROM actors a
            WHERE a.tenant_id = p_tenant_id
              AND a.actor_id = v_owner_uuid
              AND a.actor_type = 'page'
            LIMIT 1;
        END IF;
        
        -- Se não encontrou, buscar por company_id
        IF v_actor_id IS NULL THEN
            SELECT a.actor_id INTO v_actor_id
            FROM actors a
            JOIN companies c ON a.company_id = c.company_id
            WHERE a.tenant_id = p_tenant_id
              AND a.actor_type = 'page'
              AND (c.company_id::text = p_owner_actor_id OR c.company_id = v_owner_uuid)
            LIMIT 1;
        END IF;
    END IF;
    
    RETURN v_actor_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================
-- 3. MIGRAÇÃO: cultural_events → events
-- ===========================

-- Inserir eventos migrados (idempotente)
INSERT INTO events (
    id,
    tenant_id,
    actor_id,
    actor_type,
    event_type,
    event_subtype,
    title,
    description,
    datetime_start,
    datetime_end,
    status,
    visibility,
    ticket_price_cents,
    max_attendees,
    completed_at,
    created_at,
    updated_at,
    metadata
)
SELECT 
    -- Preservar ID original
    ce.id,
    
    -- Campos diretos
    ce.tenant_id,
    
    -- Mapeamento Actor (via cultural_profiles)
    get_actor_id_from_owner(
        ce.tenant_id,
        cp.owner_actor_id,
        cp.owner_actor_type
    ) as actor_id,
    cp.owner_actor_type::VARCHAR(20) as actor_type,
    
    -- Event Type (todos viram 'cultural')
    'cultural' as event_type,
    
    -- Event Subtype (tipo antigo vira subtype)
    LOWER(ce.event_type) as event_subtype,
    
    -- Campos diretos
    ce.title,
    ce.description,
    ce.datetime_start,
    ce.datetime_end,
    
    -- Status (lowercase, sem CONFIRMED)
    CASE 
        WHEN ce.status = 'DRAFT' THEN 'draft'
        WHEN ce.status = 'PUBLISHED' THEN 'published'
        WHEN ce.status = 'CONFIRMED' THEN 'published'  -- CONFIRMED → published
        WHEN ce.status = 'COMPLETED' THEN 'completed'
        WHEN ce.status = 'CANCELLED' THEN 'cancelled'
        WHEN ce.status = 'ARCHIVED' THEN 'archived'
        ELSE 'draft'
    END as status,
    
    -- Visibility (valores do CONTRATO v1)
    CASE 
        WHEN ce.visibility = 'PUBLIC' THEN 'public'
        WHEN ce.visibility = 'LOCAL' THEN 'group'  -- LOCAL → group
        WHEN ce.visibility = 'PRIVATE' THEN 'private'
        ELSE 'public'
    END as visibility,
    
    -- Campos de economia
    ce.ticket_price_cents,
    ce.max_attendees,
    ce.completed_at,
    
    -- Timestamps
    ce.created_at,
    ce.updated_at,
    
    -- Metadata (preservar informações de origem)
    jsonb_build_object(
        'source', jsonb_build_object(
            'table', 'cultural_events',
            'id', ce.id,
            'created_by_cultural_profile_id', ce.created_by_cultural_profile_id,
            'co_creators_cultural_profile_ids', ce.co_creators_cultural_profile_ids,
            'location_cultural_profile_id', ce.location_cultural_profile_id,
            'original_event_type', ce.event_type,
            'original_status', ce.status,
            'original_visibility', ce.visibility,
            'migrated_at', NOW()
        )
    ) as metadata

FROM cultural_events ce
JOIN cultural_profiles cp ON ce.created_by_cultural_profile_id = cp.id
WHERE cp.owner_actor_id IS NOT NULL
  AND cp.owner_actor_type IN ('user', 'page')
  -- Idempotência: não inserir se já existe
  AND NOT EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = ce.id
  )
ON CONFLICT (id) DO NOTHING;

-- ===========================
-- 4. ESTATÍSTICAS PÓS-MIGRAÇÃO
-- ===========================

-- Contar eventos migrados
DO $$
DECLARE
    total_cultural INTEGER;
    total_migrated INTEGER;
    total_skipped INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_cultural FROM cultural_events;
    SELECT COUNT(*) INTO total_migrated 
    FROM events 
    WHERE metadata->'source'->>'table' = 'cultural_events';
    total_skipped := total_cultural - total_migrated;
    
    RAISE NOTICE 'Migração concluída:';
    RAISE NOTICE '  Total de cultural_events: %', total_cultural;
    RAISE NOTICE '  Eventos migrados: %', total_migrated;
    RAISE NOTICE '  Eventos não migrados: %', total_skipped;
END $$;

-- ===========================
-- 5. VALIDAÇÃO PÓS-MIGRAÇÃO
-- ===========================

-- Verificar eventos migrados sem actor_id
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM events e
    WHERE e.metadata->'source'->>'table' = 'cultural_events'
      AND (e.actor_id IS NULL OR e.actor_type IS NULL);
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Encontrados % eventos migrados sem actor_id ou actor_type válido.', invalid_count;
    END IF;
END $$;

-- Verificar constraints
DO $$
DECLARE
    constraint_violations INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_violations
    FROM events e
    WHERE e.metadata->'source'->>'table' = 'cultural_events'
      AND (
          e.event_type NOT IN ('cultural', 'gastronomic', 'social', 'professional', 'community', 'spiritual', 'sports', 'private')
          OR e.status NOT IN ('draft', 'published', 'cancelled', 'completed', 'archived')
          OR e.visibility NOT IN ('public', 'group', 'followers', 'private', 'unlisted')
      );
    
    IF constraint_violations > 0 THEN
        RAISE WARNING 'Encontradas % violações de constraint em eventos migrados.', constraint_violations;
    END IF;
END $$;

COMMIT;

-- ===========================
-- COMENTÁRIOS
-- ===========================

COMMENT ON FUNCTION get_actor_id_from_owner IS 'Função auxiliar para buscar actor_id a partir de owner_actor_id e owner_actor_type (usado na migração)';


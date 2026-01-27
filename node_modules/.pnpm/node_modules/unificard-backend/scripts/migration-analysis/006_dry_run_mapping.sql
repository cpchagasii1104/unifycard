-- ================================================
-- UNIFICARD - ANÁLISE DE MIGRAÇÃO
-- FASE 2: MIGRAÇÃO CONTROLADA (READ-ONLY)
-- Script 006: DRY-RUN - Mapeamento completo
-- ================================================
-- 
-- OBJETIVO: Simular mapeamento completo de cultural_events → events
-- SEM executar INSERT/UPDATE/DELETE
-- 
-- REGRAS:
-- - Somente SELECT (READ-ONLY)
-- - Não altera dados
-- - Mostra como seria o mapeamento
-- ================================================

-- ===========================
-- MAPEAMENTO COMPLETO (DRY-RUN)
-- ===========================

-- Simular INSERT em events baseado em cultural_events
SELECT 
    -- Campos diretos (1:1)
    ce.id as source_id,
    ce.tenant_id,
    ce.title,
    ce.description,
    ce.datetime_start,
    ce.datetime_end,
    ce.ticket_price_cents,
    ce.max_attendees,
    ce.created_at,
    ce.updated_at,
    ce.completed_at,
    
    -- Mapeamentos obrigatórios
    'cultural' as event_type,  -- Todos viram 'cultural'
    LOWER(ce.event_type) as event_subtype,  -- Tipo antigo vira subtype
    cp.owner_actor_id as actor_id,  -- PAC owner → actor
    cp.owner_actor_type as actor_type,  -- PAC owner type → actor type
    
    -- Mapeamentos de status/visibility
    CASE 
        WHEN ce.status = 'DRAFT' THEN 'draft'
        WHEN ce.status = 'PUBLISHED' THEN 'published'
        WHEN ce.status = 'CONFIRMED' THEN 'published'  -- CONFIRMED → published
        WHEN ce.status = 'COMPLETED' THEN 'completed'
        WHEN ce.status = 'CANCELLED' THEN 'cancelled'
        WHEN ce.status = 'ARCHIVED' THEN 'archived'
        ELSE 'draft'
    END as status,
    
    CASE 
        WHEN ce.visibility = 'PUBLIC' THEN 'public'
        WHEN ce.visibility = 'LOCAL' THEN 'group'  -- LOCAL → group
        WHEN ce.visibility = 'PRIVATE' THEN 'private'
        ELSE 'public'
    END as visibility,
    
    -- Metadata (JSONB) - campos que não mapeiam diretamente
    jsonb_build_object(
        'source_table', 'cultural_events',
        'source_id', ce.id,
        'created_by_cultural_profile_id', ce.created_by_cultural_profile_id,
        'co_creators_cultural_profile_ids', ce.co_creators_cultural_profile_ids,
        'location_cultural_profile_id', ce.location_cultural_profile_id,
        'original_event_type', ce.event_type,
        'original_status', ce.status,
        'original_visibility', ce.visibility
    ) as metadata,
    
    -- Flags de validação
    CASE 
        WHEN cp.owner_actor_id IS NULL THEN 'MISSING_ACTOR'
        WHEN cp.owner_actor_type NOT IN ('user', 'page') THEN 'INVALID_ACTOR_TYPE'
        ELSE 'VALID'
    END as validation_status

FROM cultural_events ce
JOIN cultural_profiles cp ON ce.created_by_cultural_profile_id = cp.id
ORDER BY ce.created_at DESC
LIMIT 100;

-- ===========================
-- VALIDAÇÕES DE MAPEAMENTO
-- ===========================

-- Eventos que NÃO podem ser migrados (problemas de mapeamento)
SELECT 
    ce.id,
    ce.title,
    ce.created_by_cultural_profile_id,
    cp.owner_actor_id,
    cp.owner_actor_type,
    CASE 
        WHEN cp.id IS NULL THEN 'MISSING_CULTURAL_PROFILE'
        WHEN cp.owner_actor_id IS NULL THEN 'MISSING_OWNER_ACTOR'
        WHEN cp.owner_actor_type NOT IN ('user', 'page') THEN 'INVALID_ACTOR_TYPE'
        ELSE 'OK'
    END as issue
FROM cultural_events ce
LEFT JOIN cultural_profiles cp ON ce.created_by_cultural_profile_id = cp.id
WHERE cp.id IS NULL 
   OR cp.owner_actor_id IS NULL 
   OR cp.owner_actor_type NOT IN ('user', 'page');

-- ===========================
-- ESTATÍSTICAS DE MAPEAMENTO
-- ===========================

SELECT 
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE cp.id IS NOT NULL) as events_with_valid_pac,
    COUNT(*) FILTER (WHERE cp.owner_actor_id IS NOT NULL) as events_with_valid_actor,
    COUNT(*) FILTER (WHERE cp.owner_actor_type IN ('user', 'page')) as events_with_valid_actor_type,
    COUNT(*) FILTER (WHERE ce.status = 'CONFIRMED') as events_with_confirmed_status,
    COUNT(*) FILTER (WHERE ce.visibility = 'LOCAL') as events_with_local_visibility
FROM cultural_events ce
LEFT JOIN cultural_profiles cp ON ce.created_by_cultural_profile_id = cp.id;















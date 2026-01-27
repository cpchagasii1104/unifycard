-- ================================================
-- UNIFICARD - ANÁLISE DE MIGRAÇÃO
-- FASE 2: MIGRAÇÃO CONTROLADA (READ-ONLY)
-- Script 002: Mapeamento cultural_profile → actor
-- ================================================
-- 
-- OBJETIVO: Mapear cultural_profiles para actors
-- conforme CONTRATO v1 (Actor é origem obrigatória)
-- 
-- REGRAS:
-- - Somente SELECT (READ-ONLY)
-- - Não altera dados
-- ================================================

-- ===========================
-- 1. ANÁLISE DE CULTURAL_PROFILES
-- ===========================

-- Total de PACs
SELECT 
    COUNT(*) as total_pacs,
    COUNT(DISTINCT tenant_id) as total_tenants,
    COUNT(DISTINCT owner_actor_id) as total_owner_actors
FROM cultural_profiles;

-- ===========================
-- 2. DISTRIBUIÇÃO POR TIPO DE PAC
-- ===========================

SELECT 
    type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM cultural_profiles
GROUP BY type
ORDER BY count DESC;

-- ===========================
-- 3. DISTRIBUIÇÃO POR OWNER_ACTOR_TYPE
-- ===========================

SELECT 
    owner_actor_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM cultural_profiles
GROUP BY owner_actor_type
ORDER BY count DESC;

-- ===========================
-- 4. MAPEAMENTO: CULTURAL_PROFILE → ACTOR
-- ===========================

-- Verificar se owner_actor_id existe na tabela actors
SELECT 
    cp.id as cultural_profile_id,
    cp.owner_actor_id,
    cp.owner_actor_type,
    cp.type as pac_type,
    cp.display_name,
    a.actor_id,
    a.actor_type as actor_type_in_table,
    CASE 
        WHEN a.actor_id IS NOT NULL THEN 'MAPPED'
        ELSE 'NOT_FOUND'
    END as mapping_status
FROM cultural_profiles cp
LEFT JOIN actors a ON (
    (cp.owner_actor_type = 'user' AND a.user_id::text = cp.owner_actor_id) OR
    (cp.owner_actor_type = 'page' AND a.company_id::text = cp.owner_actor_id)
)
LIMIT 100;

-- ===========================
-- 5. EVENTOS CRIADOS POR PACs
-- ===========================

-- Mapear created_by_cultural_profile_id → actor_id + actor_type
SELECT 
    ce.id as cultural_event_id,
    ce.created_by_cultural_profile_id,
    cp.owner_actor_id as mapped_actor_id,
    cp.owner_actor_type as mapped_actor_type,
    cp.type as pac_type,
    ce.title,
    ce.status
FROM cultural_events ce
JOIN cultural_profiles cp ON ce.created_by_cultural_profile_id = cp.id
LIMIT 100;

-- ===========================
-- 6. EVENTOS COM LOCATION PAC
-- ===========================

-- Mapear location_cultural_profile_id → metadata (não é actor, é metadata)
SELECT 
    ce.id as cultural_event_id,
    ce.location_cultural_profile_id,
    cp.type as location_pac_type,
    cp.display_name as location_name,
    cp.slug as location_slug
FROM cultural_events ce
LEFT JOIN cultural_profiles cp ON ce.location_cultural_profile_id = cp.id
WHERE ce.location_cultural_profile_id IS NOT NULL
LIMIT 100;

-- ===========================
-- 7. CO-CREATORS (ARRAY)
-- ===========================

-- Eventos com co-creators (será metadata em events)
SELECT 
    ce.id as cultural_event_id,
    ce.co_creators_cultural_profile_ids,
    array_length(ce.co_creators_cultural_profile_ids, 1) as co_creators_count
FROM cultural_events ce
WHERE ce.co_creators_cultural_profile_ids IS NOT NULL
  AND array_length(ce.co_creators_cultural_profile_ids, 1) > 0
LIMIT 100;

-- ===========================
-- 8. VALIDAÇÃO: ACTORS EXISTENTES
-- ===========================

-- Verificar quantos owner_actor_id existem na tabela actors
SELECT 
    COUNT(DISTINCT cp.owner_actor_id) as total_owner_actor_ids,
    COUNT(DISTINCT a.actor_id) as total_mapped_actors,
    COUNT(DISTINCT cp.owner_actor_id) - COUNT(DISTINCT a.actor_id) as unmapped_count
FROM cultural_profiles cp
LEFT JOIN actors a ON (
    (cp.owner_actor_type = 'user' AND a.user_id::text = cp.owner_actor_id) OR
    (cp.owner_actor_type = 'page' AND a.company_id::text = cp.owner_actor_id)
);















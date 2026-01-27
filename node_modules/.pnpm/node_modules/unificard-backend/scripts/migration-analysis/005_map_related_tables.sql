-- ================================================
-- UNIFICARD - ANÁLISE DE MIGRAÇÃO
-- FASE 2: MIGRAÇÃO CONTROLADA (READ-ONLY)
-- Script 005: Mapeamento de tabelas relacionadas
-- ================================================
-- 
-- OBJETIVO: Analisar tabelas relacionadas a cultural_events
-- e como serão migradas/mapeadas
-- 
-- REGRAS:
-- - Somente SELECT (READ-ONLY)
-- - Não altera dados
-- ================================================

-- ===========================
-- 1. EVENT_PARTICIPANTS
-- ===========================

-- Participantes de eventos (será metadata em events)
SELECT 
    ep.id,
    ep.event_id as cultural_event_id,
    ep.cultural_profile_id,
    ep.role,
    cp.owner_actor_id,
    cp.owner_actor_type,
    cp.type as pac_type
FROM event_participants ep
JOIN cultural_profiles cp ON ep.cultural_profile_id = cp.id
LIMIT 100;

-- Estatísticas de participantes
SELECT 
    COUNT(DISTINCT ep.event_id) as events_with_participants,
    COUNT(ep.id) as total_participants,
    COUNT(DISTINCT ep.cultural_profile_id) as unique_participants
FROM event_participants ep;

-- Distribuição por role
SELECT 
    ep.role,
    COUNT(*) as count
FROM event_participants ep
GROUP BY ep.role
ORDER BY count DESC;

-- ===========================
-- 2. EVENT_REVENUE_SPLIT
-- ===========================

-- Split de receita (será processado pelo Split Engine no futuro)
SELECT 
    ers.id,
    ers.event_id as cultural_event_id,
    ers.target_type,
    ers.target_id,
    ers.percentage,
    CASE 
        WHEN ers.target_type = 'CULTURAL_PROFILE' THEN cp.display_name
        ELSE ers.target_id
    END as target_name
FROM event_revenue_split ers
LEFT JOIN cultural_profiles cp ON ers.target_id = cp.id::text AND ers.target_type = 'CULTURAL_PROFILE'
LIMIT 100;

-- Estatísticas de revenue split
SELECT 
    COUNT(DISTINCT ers.event_id) as events_with_revenue_split,
    COUNT(ers.id) as total_splits,
    AVG(ers.percentage) as avg_percentage,
    SUM(ers.percentage) as total_percentage_sum
FROM event_revenue_split ers;

-- Validação: splits que somam 100%
SELECT 
    ers.event_id,
    SUM(ers.percentage) as total_percentage,
    CASE 
        WHEN SUM(ers.percentage) = 100 THEN 'VALID'
        ELSE 'INVALID'
    END as validation_status
FROM event_revenue_split ers
GROUP BY ers.event_id
HAVING SUM(ers.percentage) != 100
LIMIT 50;

-- ===========================
-- 3. CULTURAL_EVENT_CHECKINS
-- ===========================

-- Check-ins (será migrado para event_attendees)
SELECT 
    cec.id,
    cec.event_id as cultural_event_id,
    cec.actor_id,
    cec.actor_type,
    cec.check_in_time,
    cec.checked_in_by_actor_id
FROM cultural_event_checkins cec
LIMIT 100;

-- Estatísticas de check-ins
SELECT 
    COUNT(DISTINCT cec.event_id) as events_with_checkins,
    COUNT(cec.id) as total_checkins,
    COUNT(DISTINCT cec.actor_id) as unique_attendees
FROM cultural_event_checkins cec;

-- ===========================
-- 4. RESUMO DE RELACIONAMENTOS
-- ===========================

SELECT 
    'event_participants' as related_table,
    COUNT(DISTINCT ep.event_id) as events_count,
    COUNT(ep.id) as records_count
FROM event_participants ep

UNION ALL

SELECT 
    'event_revenue_split' as related_table,
    COUNT(DISTINCT ers.event_id) as events_count,
    COUNT(ers.id) as records_count
FROM event_revenue_split ers

UNION ALL

SELECT 
    'cultural_event_checkins' as related_table,
    COUNT(DISTINCT cec.event_id) as events_count,
    COUNT(cec.id) as records_count
FROM cultural_event_checkins cec;















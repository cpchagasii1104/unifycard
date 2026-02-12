-- ================================================
-- UNIFICARD - ANÁLISE DE MIGRAÇÃO
-- FASE 2: MIGRAÇÃO CONTROLADA (READ-ONLY)
-- Script 001: Análise de cultural_events
-- ================================================
-- 
-- OBJETIVO: Analisar estrutura e dados de cultural_events
-- para mapeamento futuro para events (CONTRATO v1)
-- 
-- REGRAS:
-- - Somente SELECT (READ-ONLY)
-- - Não altera dados
-- - Não cria tabelas
-- ================================================

-- ===========================
-- 1. ESTRUTURA DA TABELA
-- ===========================

-- Listar todos os campos de cultural_events
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'cultural_events'
ORDER BY ordinal_position;

-- ===========================
-- 2. ESTATÍSTICAS GERAIS
-- ===========================

-- Total de eventos culturais
SELECT 
    COUNT(*) as total_events,
    COUNT(DISTINCT tenant_id) as total_tenants,
    COUNT(DISTINCT created_by_cultural_profile_id) as total_creators,
    COUNT(DISTINCT location_cultural_profile_id) as total_locations
FROM cultural_events;

-- ===========================
-- 3. DISTRIBUIÇÃO POR STATUS
-- ===========================

SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM cultural_events
GROUP BY status
ORDER BY count DESC;

-- ===========================
-- 4. DISTRIBUIÇÃO POR EVENT_TYPE
-- ===========================

SELECT 
    event_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM cultural_events
GROUP BY event_type
ORDER BY count DESC;

-- ===========================
-- 5. DISTRIBUIÇÃO POR VISIBILITY
-- ===========================

SELECT 
    visibility,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM cultural_events
GROUP BY visibility
ORDER BY count DESC;

-- ===========================
-- 6. EVENTOS COM TICKET PRICE
-- ===========================

SELECT 
    COUNT(*) as events_with_ticket_price,
    COUNT(*) FILTER (WHERE ticket_price_cents > 0) as events_with_price_gt_zero,
    MIN(ticket_price_cents) as min_price_cents,
    MAX(ticket_price_cents) as max_price_cents,
    AVG(ticket_price_cents) as avg_price_cents
FROM cultural_events
WHERE ticket_price_cents IS NOT NULL;

-- ===========================
-- 7. EVENTOS COM MAX_ATTENDEES
-- ===========================

SELECT 
    COUNT(*) as events_with_max_attendees,
    MIN(max_attendees) as min_max_attendees,
    MAX(max_attendees) as max_max_attendees,
    AVG(max_attendees) as avg_max_attendees
FROM cultural_events
WHERE max_attendees IS NOT NULL;

-- ===========================
-- 8. EVENTOS COM CO-CREATORS
-- ===========================

SELECT 
    COUNT(*) as events_with_co_creators,
    COUNT(*) FILTER (WHERE array_length(co_creators_cultural_profile_ids, 1) > 0) as events_with_co_creators_array
FROM cultural_events
WHERE co_creators_cultural_profile_ids IS NOT NULL;

-- ===========================
-- 9. EVENTOS COM LOCATION
-- ===========================

SELECT 
    COUNT(*) as events_with_location,
    COUNT(*) FILTER (WHERE location_cultural_profile_id IS NOT NULL) as events_with_location_pac
FROM cultural_events;

-- ===========================
-- 10. EVENTOS POR TENANT
-- ===========================

SELECT 
    t.tenant_id,
    t.name as tenant_name,
    COUNT(ce.id) as event_count
FROM tenants t
LEFT JOIN cultural_events ce ON t.tenant_id = ce.tenant_id
GROUP BY t.tenant_id, t.name
ORDER BY event_count DESC;

-- ===========================
-- 11. RELACIONAMENTOS COM OUTRAS TABELAS
-- ===========================

-- Eventos com participantes
SELECT 
    COUNT(DISTINCT ce.id) as events_with_participants,
    COUNT(ep.id) as total_participants
FROM cultural_events ce
LEFT JOIN event_participants ep ON ce.id = ep.event_id
GROUP BY ce.id
HAVING COUNT(ep.id) > 0;

-- Eventos com revenue split
SELECT 
    COUNT(DISTINCT ce.id) as events_with_revenue_split,
    COUNT(ers.id) as total_splits
FROM cultural_events ce
LEFT JOIN event_revenue_split ers ON ce.id = ers.event_id
GROUP BY ce.id
HAVING COUNT(ers.id) > 0;

-- Eventos com check-ins
SELECT 
    COUNT(DISTINCT ce.id) as events_with_checkins,
    COUNT(cec.id) as total_checkins
FROM cultural_events ce
LEFT JOIN cultural_event_checkins cec ON ce.id = cec.event_id
GROUP BY ce.id
HAVING COUNT(cec.id) > 0;















-- ================================================
-- UNIFICARD - ANÁLISE DE MIGRAÇÃO
-- FASE 2: MIGRAÇÃO CONTROLADA (READ-ONLY)
-- Script 003: Mapeamento event_type antigo → novo
-- ================================================
-- 
-- OBJETIVO: Mapear event_type de cultural_events
-- para event_type do CONTRATO v1
-- 
-- REGRAS:
-- - Somente SELECT (READ-ONLY)
-- - Não altera dados
-- ================================================

-- ===========================
-- 1. MAPEAMENTO PROPOSTO
-- ===========================

-- Todos os eventos culturais serão event_type = 'cultural'
-- O event_type antigo (SHOW, OFICINA, etc) vira event_subtype

SELECT 
    ce.event_type as old_event_type,
    'cultural' as new_event_type,
    LOWER(ce.event_type) as proposed_event_subtype,
    COUNT(*) as count
FROM cultural_events ce
GROUP BY ce.event_type
ORDER BY count DESC;

-- ===========================
-- 2. DISTRIBUIÇÃO DETALHADA
-- ===========================

SELECT 
    ce.event_type as old_event_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE ce.status = 'PUBLISHED') as published_count,
    COUNT(*) FILTER (WHERE ce.status = 'DRAFT') as draft_count,
    COUNT(*) FILTER (WHERE ce.status = 'COMPLETED') as completed_count
FROM cultural_events ce
GROUP BY ce.event_type
ORDER BY count DESC;

-- ===========================
-- 3. EXEMPLOS DE MAPEAMENTO
-- ===========================

-- Exemplos de eventos que serão migrados
SELECT 
    ce.id,
    ce.title,
    ce.event_type as old_event_type,
    'cultural' as new_event_type,
    LOWER(ce.event_type) as proposed_event_subtype,
    ce.status as old_status,
    LOWER(ce.status) as new_status,
    ce.visibility as old_visibility,
    CASE 
        WHEN ce.visibility = 'PUBLIC' THEN 'public'
        WHEN ce.visibility = 'LOCAL' THEN 'group'  -- LOCAL vira group (aproximação)
        WHEN ce.visibility = 'PRIVATE' THEN 'private'
        ELSE 'public'
    END as new_visibility
FROM cultural_events ce
ORDER BY ce.created_at DESC
LIMIT 50;















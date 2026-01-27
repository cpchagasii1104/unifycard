-- ================================================
-- UNIFICARD - ANÁLISE DE MIGRAÇÃO
-- FASE 2: MIGRAÇÃO CONTROLADA (READ-ONLY)
-- Script 004: Mapeamento status e visibility
-- ================================================
-- 
-- OBJETIVO: Mapear status e visibility de cultural_events
-- para valores do CONTRATO v1 (lowercase, sem CONFIRMED)
-- 
-- REGRAS:
-- - Somente SELECT (READ-ONLY)
-- - Não altera dados
-- ================================================

-- ===========================
-- 1. MAPEAMENTO DE STATUS
-- ===========================

-- Status antigo → Status novo (CONTRATO v1)
SELECT 
    ce.status as old_status,
    CASE 
        WHEN ce.status = 'DRAFT' THEN 'draft'
        WHEN ce.status = 'PUBLISHED' THEN 'published'
        WHEN ce.status = 'CONFIRMED' THEN 'published'  -- CONFIRMED vira published (sem CONFIRMED no contrato)
        WHEN ce.status = 'COMPLETED' THEN 'completed'
        WHEN ce.status = 'CANCELLED' THEN 'cancelled'
        WHEN ce.status = 'ARCHIVED' THEN 'archived'
        ELSE 'draft'
    END as new_status,
    COUNT(*) as count
FROM cultural_events ce
GROUP BY ce.status
ORDER BY count DESC;

-- ===========================
-- 2. EVENTOS COM STATUS CONFIRMED
-- ===========================

-- Identificar eventos que serão afetados pela remoção de CONFIRMED
SELECT 
    ce.id,
    ce.title,
    ce.status,
    ce.created_at,
    'published' as proposed_new_status
FROM cultural_events ce
WHERE ce.status = 'CONFIRMED'
ORDER BY ce.created_at DESC;

-- ===========================
-- 3. MAPEAMENTO DE VISIBILITY
-- ===========================

-- Visibility antigo → Visibility novo (CONTRATO v1)
SELECT 
    ce.visibility as old_visibility,
    CASE 
        WHEN ce.visibility = 'PUBLIC' THEN 'public'
        WHEN ce.visibility = 'LOCAL' THEN 'group'  -- LOCAL não existe, usar 'group' como aproximação
        WHEN ce.visibility = 'PRIVATE' THEN 'private'
        ELSE 'public'
    END as new_visibility,
    COUNT(*) as count
FROM cultural_events ce
GROUP BY ce.visibility
ORDER BY count DESC;

-- ===========================
-- 4. EVENTOS COM VISIBILITY LOCAL
-- ===========================

-- Identificar eventos que serão afetados pela mudança de LOCAL
SELECT 
    ce.id,
    ce.title,
    ce.visibility,
    ce.created_at,
    'group' as proposed_new_visibility,
    'ATENÇÃO: LOCAL não existe no CONTRATO v1, será mapeado para group' as warning
FROM cultural_events ce
WHERE ce.visibility = 'LOCAL'
ORDER BY ce.created_at DESC;

-- ===========================
-- 5. RESUMO DE IMPACTO
-- ===========================

SELECT 
    'Status CONFIRMED → published' as change_type,
    COUNT(*) as affected_events
FROM cultural_events
WHERE status = 'CONFIRMED'

UNION ALL

SELECT 
    'Visibility LOCAL → group' as change_type,
    COUNT(*) as affected_events
FROM cultural_events
WHERE visibility = 'LOCAL';















-- ================================================
-- UNIFICARD - ROLLBACK DE MIGRAÇÃO
-- FASE 3: MIGRAÇÃO DE DADOS (WRITE CONTROLADO)
-- Script 003: Rollback seguro da migração
-- ================================================
-- 
-- OBJETIVO: Reverter migração de dados de forma segura
-- removendo apenas eventos e check-ins migrados
-- 
-- REGRAS:
-- - Rollback baseado em metadata.source
-- - Remove apenas dados migrados
-- - Não remove dados originais (cultural_events, cultural_event_checkins)
-- - Idempotente (pode executar múltiplas vezes)
-- 
-- ⚠️ ATENÇÃO: Este script REMOVE dados migrados!
-- Execute apenas se necessário reverter a migração.
-- 
-- VERSÃO: 1.0
-- DATA: 28/12/2025
-- ================================================

BEGIN;

-- ===========================
-- 1. CONFIRMAÇÃO DE ROLLBACK
-- ===========================

-- Verificar quantos registros serão removidos
DO $$
DECLARE
    events_to_remove INTEGER;
    attendees_to_remove INTEGER;
BEGIN
    SELECT COUNT(*) INTO events_to_remove
    FROM events
    WHERE metadata->'source'->>'table' = 'cultural_events';
    
    SELECT COUNT(*) INTO attendees_to_remove
    FROM event_attendees
    WHERE metadata->'source'->>'table' = 'cultural_event_checkins';
    
    RAISE NOTICE 'ROLLBACK: Serão removidos:';
    RAISE NOTICE '  Eventos: %', events_to_remove;
    RAISE NOTICE '  Check-ins: %', attendees_to_remove;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL!';
    RAISE NOTICE 'Execute apenas se tiver certeza.';
    RAISE NOTICE '';
    RAISE NOTICE 'Para continuar, descomente as linhas DELETE abaixo.';
END $$;

-- ===========================
-- 2. ROLLBACK: Remover check-ins migrados
-- ===========================

-- ⚠️ DESCOMENTE AS LINHAS ABAIXO PARA EXECUTAR O ROLLBACK

/*
-- Remover check-ins migrados de event_attendees
DELETE FROM event_attendees
WHERE metadata->'source'->>'table' = 'cultural_event_checkins';

RAISE NOTICE 'Check-ins migrados removidos.';
*/

-- ===========================
-- 3. ROLLBACK: Remover eventos migrados
-- ===========================

-- ⚠️ DESCOMENTE AS LINHAS ABAIXO PARA EXECUTAR O ROLLBACK

/*
-- Remover eventos migrados de events
-- ATENÇÃO: Isso pode falhar se houver foreign keys dependentes
-- (ex: event_attendees, event_actor, etc)

-- Primeiro, remover dependências
DELETE FROM event_attendees
WHERE event_id IN (
    SELECT id FROM events
    WHERE metadata->'source'->>'table' = 'cultural_events'
);

-- Depois, remover eventos
DELETE FROM events
WHERE metadata->'source'->>'table' = 'cultural_events';

RAISE NOTICE 'Eventos migrados removidos.';
*/

-- ===========================
-- 4. ESTATÍSTICAS PÓS-ROLLBACK
-- ===========================

-- Verificar se ainda há registros migrados
DO $$
DECLARE
    remaining_events INTEGER;
    remaining_attendees INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_events
    FROM events
    WHERE metadata->'source'->>'table' = 'cultural_events';
    
    SELECT COUNT(*) INTO remaining_attendees
    FROM event_attendees
    WHERE metadata->'source'->>'table' = 'cultural_event_checkins';
    
    RAISE NOTICE 'Pós-rollback:';
    RAISE NOTICE '  Eventos migrados restantes: %', remaining_events;
    RAISE NOTICE '  Check-ins migrados restantes: %', remaining_attendees;
    
    IF remaining_events = 0 AND remaining_attendees = 0 THEN
        RAISE NOTICE '✅ Rollback completo: todos os registros migrados foram removidos.';
    ELSE
        RAISE WARNING '⚠️ Ainda existem registros migrados. Verifique dependências.';
    END IF;
END $$;

COMMIT;

-- ===========================
-- COMENTÁRIOS
-- ===========================

-- Este script está protegido por padrão (comentado).
-- Para executar o rollback:
-- 1. Descomente as seções DELETE acima
-- 2. Execute o script
-- 3. Verifique os resultados

-- ⚠️ IMPORTANTE:
-- - Dados originais (cultural_events, cultural_event_checkins) NÃO são removidos
-- - Apenas dados migrados são removidos
-- - Rollback é baseado em metadata.source.table















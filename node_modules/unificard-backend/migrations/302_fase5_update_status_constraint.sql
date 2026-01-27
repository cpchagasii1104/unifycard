-- ============================================================
-- UNIFICARD - MIGRATION 302
-- FASE 5: Atualizar constraint de status para CONTRATO v1
-- ============================================================
--
-- CONTEXTO:
-- A tabela events possui uma constraint events_status_check que
-- restringe status a valores legados em UPPERCASE (DRAFT, PUBLISHED, etc).
-- O CONTRATO DE EVENTOS v1 (EVENT_DOMAIN_MINIMUM_CONTRACT) define:
-- draft, declared, published, active, ended, cancelled
--
-- DECISÃO ARQUITETURAL:
-- Status é controlado pela aplicação. A constraint deve aceitar
-- tanto valores legados quanto novos para permitir migração gradual.
--
-- SOLUÇÃO:
-- Remover constraint legada. A validação é responsabilidade da aplicação.
--
-- CONFORMIDADE:
-- - EVENT_DOMAIN_MINIMUM_CONTRACT: status canônicos
-- - LEGADO_TEMPORAL_MIGRATION_PLAN: compatibilidade com legado
-- ============================================================

-- 1. Remover constraint legada de status
-- NOTA: A validação é feita na aplicação (event.service.ts)
ALTER TABLE events
DROP CONSTRAINT IF EXISTS events_status_check;

-- 2. Comentário para documentação
COMMENT ON COLUMN events.status IS
  'Status do evento conforme EVENT_DOMAIN_MINIMUM_CONTRACT.
   Valores canônicos: draft, declared, published, active, ended, cancelled
   Valores legados (deprecated): completed, archived';

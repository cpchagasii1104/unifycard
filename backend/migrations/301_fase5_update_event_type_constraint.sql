-- ============================================================
-- UNIFICARD - MIGRATION 301
-- FASE 5: Atualizar constraint de event_type para CONTRATO v1
-- ============================================================
--
-- CONTEXTO:
-- A tabela events possui uma constraint events_event_type_check que
-- restringe event_type a valores legados (SHOW, CINEMA, etc).
-- O CONTRATO DE EVENTOS v1 define uma taxonomia diferente:
-- cultural, gastronomic, social, professional, community, spiritual, sports, private
--
-- DECISÃO ARQUITETURAL (migration 090):
-- "event_type é discriminador central, mas validado no domínio"
-- A validação de taxonomia é responsabilidade da aplicação, não do banco.
--
-- SOLUÇÃO:
-- Remover constraint legada para permitir os tipos do CONTRATO v1.
-- A validação é feita em event.service.ts:validateEventType()
--
-- CONFORMIDADE:
-- - EVENT_DOMAIN_MINIMUM_CONTRACT: taxonomia validada pela aplicação
-- - Seção 3 do CONTRATO v1: tipos canônicos
-- ============================================================

-- 1. Remover constraint legada de event_type
-- NOTA: A validação é feita na aplicação (event.service.ts:validateEventType)
ALTER TABLE events
DROP CONSTRAINT IF EXISTS events_event_type_check;

-- 2. Comentário para documentação
COMMENT ON COLUMN events.event_type IS
  'Tipo do evento conforme CONTRATO v1 Seção 3. Validação na aplicação.
   Tipos válidos: cultural, gastronomic, social, professional, community, spiritual, sports, private';

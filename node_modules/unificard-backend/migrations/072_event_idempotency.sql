-- ============================================================
-- UNIFICARD — MIGRATION 072
-- Arquivo: 072_event_idempotency.sql
-- Tipo: HARDENING CRÍTICO (Event Commerce)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Operações de checkout de eventos (ingressos e consumos)
-- podem ser chamadas múltiplas vezes por retry de rede,
-- falha de gateway ou duplicação de requests.
--
-- Esta migration adiciona suporte a idempotência
-- para prevenir duplicação financeira.
--
-- MODELO DE IDEMPOTÊNCIA
-- • idempotency_key é gerada pela APLICAÇÃO
-- • o banco NÃO cria nem altera a chave
-- • a mesma chave pode ser reutilizada:
--     - em tenants diferentes
--     - em tabelas diferentes (tickets vs consumptions)
-- • dentro do mesmo tenant + tabela:
--     → idempotency_key é única
--
-- GOVERNANÇA
-- • idempotency_key é opcional (NULL permitido)
-- • quando informada, o banco garante unicidade
-- • conflitos devem ser tratados pela aplicação
--
-- IDEMPOTÊNCIA DA MIGRATION
-- • Colunas criadas com IF NOT EXISTS
-- • Índices criados com IF NOT EXISTS
--
-- DEPENDÊNCIAS
-- • event_tickets (migration 069)
-- • event_consumptions (migration 069)
--
-- ============================================================


-- ============================================================
-- 1) EVENT TICKETS — IDEMPOTENCY
-- ============================================================

ALTER TABLE event_tickets
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_tickets_idempotency
  ON event_tickets (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_tickets_idempotency
  ON event_tickets (idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ============================================================
-- 2) EVENT CONSUMPTIONS — IDEMPOTENCY
-- ============================================================

ALTER TABLE event_consumptions
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_event_consumptions_idempotency
  ON event_consumptions (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_consumptions_idempotency
  ON event_consumptions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ============================================================
-- 3) COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN event_tickets.idempotency_key IS
  'Chave de idempotência gerada pela aplicação para prevenir duplicação de checkout de ingressos';

COMMENT ON COLUMN event_consumptions.idempotency_key IS
  'Chave de idempotência gerada pela aplicação para prevenir duplicação de checkout de consumos';


-- ============================================================
-- FIM 072_event_idempotency.sql
-- ============================================================



























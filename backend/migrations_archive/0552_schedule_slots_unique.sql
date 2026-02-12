-- ============================================================
-- UNIFICARD — MIGRATION 064
-- Arquivo: 064_schedule_slots_unique.sql
-- Tipo: REGRA ESTRUTURAL (idempotência de slots)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- O sistema de agendas (schedules) utiliza slots de tempo
-- para representar disponibilidade, bloqueios ou reservas.
--
-- Durante integrações, sincronizações ou reprocessamentos,
-- é comum que a criação de slots seja executada mais de uma vez.
--
-- OBJETIVO
-- • Garantir idempotência na criação de schedule_slots
-- • Impedir duplicação exata de slots para a mesma agenda
--
-- DEFINIÇÃO DE SLOT
-- • Um slot é identificado unicamente por:
--     (schedule_id, start_time, end_time)
--
-- DECISÕES IMPORTANTES
-- • Esta migration NÃO trata sobreposição de horários
-- • Slots sobrepostos são permitidos por design
-- • Validação de conflitos é responsabilidade da aplicação
--   ou de futuras migrations (ex: EXCLUDE USING GIST)
--
-- ESCOPO
-- ✔ Impõe unicidade estrutural de slots
-- ✔ Garante retry seguro e sincronização idempotente
--
-- ❌ Não altera status de slots
-- ❌ Não valida conflitos de agenda
--
-- DEPENDÊNCIAS
-- • schedule_slots
-- • regras de ownership de schedules (migration 063)
--
-- IDEMPOTÊNCIA
-- • Índice criado com IF NOT EXISTS
--
-- ============================================================


-- ============================================================
-- 1) UNICIDADE DE SLOT POR INTERVALO
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_slot_time
  ON schedule_slots (schedule_id, start_time, end_time);


-- ============================================================
-- FIM 064_schedule_slots_unique.sql
-- ============================================================








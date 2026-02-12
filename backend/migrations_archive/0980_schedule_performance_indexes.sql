-- ============================================================
-- UNIFICARD — MIGRATION 065
-- Arquivo: 065_schedule_slots_performance_indexes.sql
-- Tipo: PERFORMANCE OBRIGATÓRIA (não opcional)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- O sistema de agendas do Unificard executa consultas intensivas
-- sobre schedule_slots, incluindo:
--
-- • listagem de agenda do usuário
-- • busca de horários disponíveis
-- • ordenação temporal de slots por status
--
-- Sem índices adequados, essas consultas degradam rapidamente
-- com crescimento de dados e concorrência.
--
-- OBJETIVO
-- • Garantir performance previsível e estável
-- • Evitar full table scans em operações críticas
-- • Formalizar índices como parte do contrato do sistema
--
-- CASOS DE USO COBERTOS
-- • Agenda do usuário (reservas pessoais)
-- • Busca de slots disponíveis para booking
-- • Queries administrativas por status + tempo
--
-- DECISÕES IMPORTANTES
-- • Estes índices NÃO são opcionais
-- • Não devem ser removidos sem análise de impacto
-- • Índices parciais são usados para reduzir custo de escrita
--
-- DEPENDÊNCIAS
-- • schedule_slots
-- • Colunas:
--     - reserved_by_global_user_id
--     - status
--     - start_time
--
-- IDEMPOTÊNCIA
-- • Todos os índices usam IF NOT EXISTS
--
-- ============================================================


-- ============================================================
-- 1) AGENDA DO USUÁRIO (SLOTS RESERVADOS)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_slots_user_time
  ON schedule_slots (reserved_by_global_user_id, start_time)
  WHERE reserved_by_global_user_id IS NOT NULL;


-- ============================================================
-- 2) BUSCA DE DISPONIBILIDADE (BOOKING)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_slots_available
  ON schedule_slots (schedule_id, start_time)
  WHERE status = 'available';


-- ============================================================
-- 3) CONSULTAS POR STATUS + TEMPO
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_slots_status_time
  ON schedule_slots (status, start_time);


-- ============================================================
-- FIM 065_schedule_slots_performance_indexes.sql
-- ============================================================

























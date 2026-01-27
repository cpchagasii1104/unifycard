-- ============================================================
-- UNIFICARD - MIGRATION 096
-- Check-In / Check-Out (BATER CARTÃO) - CONTRATO v1.4
-- ============================================================
--
-- OBJETIVO:
-- Registrar timestamps de check-in e check-out e armazenar
-- o status de presença como snapshot declarativo.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena horários e status declarados
--   • NÃO calcula attendance_status
--   • NÃO executa regras de presença
-- - A APLICAÇÃO:
--   • decide attendance_status
--   • pode recalcular, corrigir e auditar
--
-- DECISÕES IMPORTANTES:
-- - attendance_status é campo LIVRE (sem CHECK rígido)
-- - check_out_at não implica automaticamente presença
-- - Nenhuma trigger ou função de domínio é usada
--
-- DEPENDÊNCIAS:
-- - event_participants
-- - event_attendees
--
-- IMPACTO:
-- - Alteração estrutural simples
-- - Sem efeitos colaterais
-- ============================================================


-- ============================================================
-- EVENT_PARTICIPANTS
-- ============================================================
ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20);


-- ============================================================
-- EVENT_ATTENDEES
-- ============================================================
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20);


-- ============================================================
-- ÍNDICES (MULTI-TENANT)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_participants_attendance_status
  ON event_participants (tenant_id, attendance_status);

CREATE INDEX IF NOT EXISTS idx_event_participants_check_out
  ON event_participants (tenant_id, check_out_at)
  WHERE check_out_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_attendees_attendance_status
  ON event_attendees (tenant_id, attendance_status);

CREATE INDEX IF NOT EXISTS idx_event_attendees_check_out
  ON event_attendees (tenant_id, check_out_at)
  WHERE check_out_at IS NOT NULL;


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN event_participants.check_out_at IS
  'Timestamp do check-out (saída do evento).';

COMMENT ON COLUMN event_participants.attendance_status IS
  'Status de presença declarado pela aplicação (ex: PRESENT, LEFT_EARLY, NO_SHOW).';

COMMENT ON COLUMN event_attendees.check_out_at IS
  'Timestamp do check-out (saída do evento).';

COMMENT ON COLUMN event_attendees.attendance_status IS
  'Status de presença declarado pela aplicação (ex: PRESENT, LEFT_EARLY, NO_SHOW).';














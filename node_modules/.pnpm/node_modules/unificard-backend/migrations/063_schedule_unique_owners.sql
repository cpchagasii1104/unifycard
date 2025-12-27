-- ================================================
-- UNIFICARD - MIGRATION 063
-- Schedule Unique Owners (FASE 1.1)
-- Garantir 1 Schedule por Owner (OBRIGATÓRIO)
-- ================================================

-- 1 agenda por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_company
  ON schedules(company_id)
  WHERE company_id IS NOT NULL;

-- 1 agenda por usuário
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_user
  ON schedules(global_user_id)
  WHERE global_user_id IS NOT NULL;

-- 1 agenda por serviço
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_service
  ON schedules(service_id)
  WHERE service_id IS NOT NULL;
















-- ============================================================
-- UNIFICARD - MIGRATION 291
-- FASE 4: Operational Commitments (sem economia)
-- Estender event_staff para suportar lifecycle factual canônico
-- ============================================================
--
-- OBJETIVO:
-- Estender event_staff com campos canônicos para OperationalCommitment
-- sem quebrar compatibilidade com estruturas legadas.
--
-- REGRAS ABSOLUTAS:
-- - ZERO economia (sem preço/valor/moeda/pagamento/split/custódia)
-- - ZERO punição automática (sem penalidade, sem reputação)
-- - ZERO escrita na Agenda Universal (somente referência/read-only)
-- - Actor explícito obrigatório (responsible_actor_id + responsible_actor_type)
--
-- COMPATIBILIDADE:
-- - NÃO remover global_user_id (mantido para compatibilidade)
-- - Todos os novos campos são NULLABLE
-- - Estrutura legada continua funcionando
-- ============================================================

-- ============================================================
-- EXTENDER EVENT_STAFF
-- ============================================================

-- Campos canônicos para OperationalCommitment
ALTER TABLE event_staff
  -- Actor explícito obrigatório (CANÔNICO)
  ADD COLUMN IF NOT EXISTS responsible_actor_id UUID,
  ADD COLUMN IF NOT EXISTS responsible_actor_type TEXT,
  
  -- Status do lifecycle factual
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'expected',
  
  -- Referência a janela de tempo (apenas referência, sem lock)
  ADD COLUMN IF NOT EXISTS time_window_ref JSONB,
  
  -- Timestamps de check-in/check-out
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ,
  
  -- Motivo de falha (se aplicável)
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  
  -- Rastreamento de origem (legado vs v2)
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'legacy',
  
  -- Timestamps padrão (se não existirem)
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Índices para campos canônicos
CREATE INDEX IF NOT EXISTS idx_event_staff_responsible_actor
  ON event_staff (event_id, responsible_actor_id, responsible_actor_type)
  WHERE responsible_actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_staff_status
  ON event_staff (event_id, status)
  WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_staff_checked_in
  ON event_staff (event_id, checked_in_at)
  WHERE checked_in_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_staff_checked_out
  ON event_staff (event_id, checked_out_at)
  WHERE checked_out_at IS NOT NULL;

-- Trigger para updated_at (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_update_event_staff_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_event_staff_updated_at
      BEFORE UPDATE ON event_staff
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN event_staff.responsible_actor_id IS
  'Actor responsável canônico (obrigatório em fluxos v2). NÃO usar global_user_id como canônico.';

COMMENT ON COLUMN event_staff.responsible_actor_type IS
  'Tipo do actor responsável (user, page, group, channel).';

COMMENT ON COLUMN event_staff.status IS
  'Status do lifecycle factual: expected, checked_in, checked_out, failed. Sem economia, sem punição.';

COMMENT ON COLUMN event_staff.time_window_ref IS
  'Referência informacional a janela de tempo (JSONB). Apenas referência, sem lock na Agenda Universal.';

COMMENT ON COLUMN event_staff.checked_in_at IS
  'Timestamp do check-in (fato registrado). Sem decisão, sem punição.';

COMMENT ON COLUMN event_staff.checked_out_at IS
  'Timestamp do check-out (fato registrado). Sem decisão, sem punição.';

COMMENT ON COLUMN event_staff.failure_reason IS
  'Motivo de falha (se status = failed). Texto livre, sem regras automáticas.';

COMMENT ON COLUMN event_staff.source IS
  'Origem do registro: legacy (estrutura antiga) ou v2 (fluxo canônico).';

-- ============================================================
-- NOTA DE COMPATIBILIDADE
-- ============================================================
-- Esta migration estende event_staff sem quebrar compatibilidade.
-- Estruturas legadas (global_user_id) continuam funcionando.
-- Fluxos v2 devem usar responsible_actor_id/type explicitamente.
-- ============================================================


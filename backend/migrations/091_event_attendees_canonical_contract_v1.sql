-- ============================================================
-- UNIFICARD - MIGRATION 091
-- Event Attendees Canonical Table - CONTRATO DE EVENTOS v1
-- ============================================================
--
-- OBJETIVO:
-- Ajustar a tabela event_attendees para atuar como registro
-- canônico de participantes e check-ins conforme CONTRATO
-- DE EVENTOS v1.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena participantes e registros de check-in
--   • garante isolamento por tenant
--   • garante unicidade estrutural
--   • garante origem obrigatória via actor
-- - A APLICAÇÃO:
--   • controla método e status de check-in
--   • valida coerência entre campos
--   • dispara impacto e ledger
--
-- DECISÕES IMPORTANTES:
-- - Campos de domínio são livres (sem CHECK rígido)
-- - actor_id é obrigatório conforme CONTRATO v1
-- - global_user_id é mantido apenas para compatibilidade legada
-- - Backfill mínimo é realizado para tenant_id
--
-- DEPENDÊNCIAS:
-- - tenants
-- - events
-- - actors
--
-- IMPACTO:
-- - Ajuste estrutural canônico
-- - Compatível com dados legados
-- ============================================================


-- ============================================================
-- TENANT_ID (BACKFILL MÍNIMO)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_attendees' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE event_attendees
      ADD COLUMN tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

    UPDATE event_attendees ea
    SET tenant_id = e.tenant_id
    FROM events e
    WHERE ea.event_id = e.id AND ea.tenant_id IS NULL;

    ALTER TABLE event_attendees
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;


-- ============================================================
-- ORIGEM DO PARTICIPANTE (ACTOR OBRIGATÓRIO)
-- ============================================================
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS actor_id UUID
    REFERENCES actors(actor_id) ON DELETE CASCADE;

-- Backfill mínimo se possível (quando global_user_id mapear para actor)
-- (realizado na aplicação ou migration dedicada)

ALTER TABLE event_attendees
  ALTER COLUMN actor_id SET NOT NULL;


-- ============================================================
-- CAMPOS DE CHECK-IN (DECLARATIVOS)
-- ============================================================
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS check_in_method VARCHAR(20);

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS checked_in_by_actor_id UUID
    REFERENCES actors(actor_id) ON DELETE SET NULL;

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS check_in_status VARCHAR(20)
    NOT NULL DEFAULT 'PENDING';

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS ticket_id UUID;

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS transaction_id UUID;

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;


-- ============================================================
-- UNICIDADE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_attendees_unique_actor'
      AND conrelid = 'event_attendees'::regclass
  ) THEN
    ALTER TABLE event_attendees
      ADD CONSTRAINT event_attendees_unique_actor
      UNIQUE (event_id, actor_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_attendees'
      AND column_name = 'global_user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_attendees_unique_global_user'
      AND conrelid = 'event_attendees'::regclass
  ) THEN
    ALTER TABLE event_attendees
      ADD CONSTRAINT event_attendees_unique_global_user
      UNIQUE (event_id, global_user_id);
  END IF;
END $$;


-- ============================================================
-- ÍNDICES ÚTEIS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_attendees_actor
  ON event_attendees (tenant_id, actor_id);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event_actor
  ON event_attendees (event_id, actor_id);

CREATE INDEX IF NOT EXISTS idx_event_attendees_check_in
  ON event_attendees (event_id, check_in_time)
  WHERE check_in_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_attendees_check_in_status
  ON event_attendees (event_id, check_in_status);

CREATE INDEX IF NOT EXISTS idx_event_attendees_transaction
  ON event_attendees (transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_attendees_ticket
  ON event_attendees (ticket_id)
  WHERE ticket_id IS NOT NULL;


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE event_attendees IS
  'Participantes/inscritos em eventos conforme CONTRATO DE EVENTOS v1.';

COMMENT ON COLUMN event_attendees.actor_id IS
  'Actor participante do evento (origem obrigatória conforme CONTRATO v1).';

COMMENT ON COLUMN event_attendees.global_user_id IS
  'Compatibilidade com dados legados. Preferir actor_id.';

COMMENT ON COLUMN event_attendees.check_in_time IS
  'Data/hora do check-in (confirmação de ação no mundo real).';

COMMENT ON COLUMN event_attendees.check_in_method IS
  'Método de check-in (ex: QR, MANUAL, AUTOMATIC). Validado pela aplicação.';

COMMENT ON COLUMN event_attendees.checked_in_by_actor_id IS
  'Actor que validou o check-in manualmente (quando aplicável).';

COMMENT ON COLUMN event_attendees.check_in_status IS
  'Status do check-in controlado pela aplicação (ex: PENDING, CONFIRMED, CANCELLED).';

COMMENT ON COLUMN event_attendees.ticket_id IS
  'Referência ao ticket/ingresso (se evento for pago).';

COMMENT ON COLUMN event_attendees.transaction_id IS
  'Referência à transação do Split Engine (se evento for pago).';

COMMENT ON COLUMN event_attendees.metadata IS
  'Metadados adicionais do check-in.';

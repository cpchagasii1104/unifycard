-- ============================================================
-- UNIFICARD - MIGRATION 090
-- Events Canonical Table - CONTRATO DE EVENTOS v1
-- ============================================================
--
-- OBJETIVO:
-- Ajustar a tabela events para atuar como tabela canônica
-- de todos os eventos do sistema conforme CONTRATO DE EVENTOS v1.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • garante estrutura canônica de eventos
--   • garante origem obrigatória via actor
--   • garante integridade física e isolamento por tenant
-- - A APLICAÇÃO:
--   • controla lifecycle (status)
--   • valida taxonomia (event_type / subtype)
--   • aplica regras econômicas via SplitEngine
--
-- DECISÕES IMPORTANTES:
-- - Campos de domínio são livres (sem CHECK rígido)
-- - event_type é discriminador central, mas validado no domínio
-- - actor_id + actor_type são obrigatórios
-- - Backfill mínimo é realizado apenas para compatibilidade
--
-- DEPENDÊNCIAS:
-- - tenants
-- - actors
--
-- IMPACTO:
-- - Ajuste estrutural canônico
-- - Compatível com legado (cultural_events não removido)
-- ============================================================


-- ============================================================
-- ORIGEM DO EVENTO (ACTOR OBRIGATÓRIO)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE events ADD COLUMN actor_id UUID;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'created_by_actor_id'
    ) THEN
      UPDATE events SET actor_id = created_by_actor_id WHERE actor_id IS NULL;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'actor_type'
  ) THEN
    ALTER TABLE events ADD COLUMN actor_type VARCHAR(20);
  END IF;

  ALTER TABLE events
    ALTER COLUMN actor_id SET NOT NULL,
    ALTER COLUMN actor_type SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_actor_id_fkey'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_actor_id_fkey
      FOREIGN KEY (actor_id) REFERENCES actors(actor_id) ON DELETE RESTRICT;
  END IF;
END $$;


-- ============================================================
-- CAMPOS DO CONTRATO v1
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_subtype VARCHAR(255);

ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price_cents INTEGER
  CHECK (ticket_price_cents >= 0);

ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public';

ALTER TABLE events ADD COLUMN IF NOT EXISTS max_attendees INTEGER
  CHECK (max_attendees > 0 OR max_attendees IS NULL);

ALTER TABLE events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;


-- ============================================================
-- DATETIME PADRÃO
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'datetime_start'
  ) THEN
    ALTER TABLE events ADD COLUMN datetime_start TIMESTAMPTZ;
    UPDATE events SET datetime_start = start_time WHERE datetime_start IS NULL;
    ALTER TABLE events ALTER COLUMN datetime_start SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'datetime_end'
  ) THEN
    ALTER TABLE events ADD COLUMN datetime_end TIMESTAMPTZ;
    UPDATE events SET datetime_end = end_time WHERE datetime_end IS NULL;
    ALTER TABLE events ALTER COLUMN datetime_end SET NOT NULL;
  END IF;
END $$;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_datetime_check,
  ADD CONSTRAINT events_datetime_check
  CHECK (datetime_end > datetime_start);


-- ============================================================
-- ÍNDICES ÚTEIS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_event_type
  ON events (tenant_id, event_type);

CREATE INDEX IF NOT EXISTS idx_events_event_type_status
  ON events (tenant_id, event_type, status);

CREATE INDEX IF NOT EXISTS idx_events_actor_composite
  ON events (tenant_id, actor_id, actor_type);

CREATE INDEX IF NOT EXISTS idx_events_datetime_range
  ON events (tenant_id, datetime_start, datetime_end);

CREATE INDEX IF NOT EXISTS idx_events_visibility
  ON events (tenant_id, visibility, status);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE events IS
  'Tabela canônica de eventos conforme CONTRATO DE EVENTOS v1.';

COMMENT ON COLUMN events.event_type IS
  'Discriminador central do evento. Taxonomia validada pela aplicação.';

COMMENT ON COLUMN events.event_subtype IS
  'Subtype dinâmico que refina event_type. Evolui por uso real.';

COMMENT ON COLUMN events.actor_id IS
  'Actor de origem do evento (obrigatório).';

COMMENT ON COLUMN events.actor_type IS
  'Tipo do actor de origem (ex: user, page).';

COMMENT ON COLUMN events.visibility IS
  'Visibilidade do evento. Regra de acesso validada no domínio.';

COMMENT ON COLUMN events.ticket_price_cents IS
  'Preço do ingresso em centavos. Execução financeira ocorre fora do banco.';

-- ============================================================
-- NOTA SOBRE MIGRATION 090 (actor_id / actor_type)
-- ============================================================
-- A Migration 026 criou a tabela events com o campo created_by_global_user_id, que é considerado legado.
-- A Migration 090 adiciona os campos actor_id e actor_type.
-- Este contrato canônico exige responsible_actor_id e responsible_actor_type,
-- que são mapeados diretamente para actor_id e actor_type no banco.
-- O campo created_by_global_user_id:
-- - não deve ser usado como responsabilidade institucional
-- - não deve ser inferido como ator responsável
-- - permanece apenas para compatibilidade histórica


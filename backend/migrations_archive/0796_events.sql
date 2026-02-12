-- ============================================================
-- UNIFICARD - MIGRATION 207
-- SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)
-- Tabela: events - Adicionar colunas faltantes
-- ============================================================
--
-- NOTA: A tabela events já existe de migrations anteriores.
-- Esta migration apenas adiciona colunas/índices faltantes.
-- ============================================================

-- ============================================================
-- ENUM: Event Status (se não existir)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM (
      'DRAFT',      -- Rascunho
      'PUBLISHED',  -- Publicado (vendas abertas)
      'CLOSED',     -- Fechado (vendas encerradas)
      'CANCELLED'   -- Cancelado
    );
  END IF;
END$$;

-- ============================================================
-- ADICIONAR COLUNAS FALTANTES
-- ============================================================

-- Adicionar organizer_actor_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'organizer_actor_id'
    ) THEN
        ALTER TABLE events ADD COLUMN organizer_actor_id UUID;
    END IF;
END $$;

-- Adicionar location_actor_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'location_actor_id'
    ) THEN
        ALTER TABLE events ADD COLUMN location_actor_id UUID;
    END IF;
END $$;

-- Adicionar published_at se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'published_at'
    ) THEN
        ALTER TABLE events ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Adicionar cancelled_at se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE events ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Adicionar cancellation_reason se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE events ADD COLUMN cancellation_reason TEXT;
    END IF;
END $$;

-- ============================================================
-- ÍNDICES (apenas se colunas existem)
-- ============================================================
-- Índice para buscar por tenant (coluna sempre existe)
CREATE INDEX IF NOT EXISTS idx_events_tenant_id
    ON events(tenant_id);

-- Índice para buscar por organizer_actor_id (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'organizer_actor_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_events_organizer
            ON events(tenant_id, organizer_actor_id);
    END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE events IS 'Eventos (shows, festas, palestras, espetáculos). Evento ≠ Order.';





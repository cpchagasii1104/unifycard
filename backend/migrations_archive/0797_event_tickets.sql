-- ============================================================
-- UNIFICARD - MIGRATION 208
-- SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)
-- Tabela: event_tickets - Adicionar colunas faltantes
-- ============================================================
--
-- NOTA: A tabela event_tickets já pode existir.
-- Esta migration apenas adiciona colunas/índices faltantes.
-- ============================================================

-- ============================================================
-- ENUM: Ticket Type (se não existir)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_ticket_type') THEN
    CREATE TYPE event_ticket_type AS ENUM (
      'GENERAL',   -- Ingresso geral
      'VIP',       -- VIP
      'BACKSTAGE'  -- Backstage
    );
  END IF;
END$$;

-- ============================================================
-- ADICIONAR COLUNAS FALTANTES (se tabela existe)
-- ============================================================

-- Adicionar ticket_type se não existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_tickets') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'event_tickets' AND column_name = 'ticket_type'
        ) THEN
            ALTER TABLE event_tickets ADD COLUMN ticket_type VARCHAR(50) DEFAULT 'GENERAL';
        END IF;
    END IF;
END $$;

-- Adicionar price_cents se não existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_tickets') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'event_tickets' AND column_name = 'price_cents'
        ) THEN
            ALTER TABLE event_tickets ADD COLUMN price_cents BIGINT DEFAULT 0;
        END IF;
    END IF;
END $$;

-- Adicionar quantity_total se não existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_tickets') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'event_tickets' AND column_name = 'quantity_total'
        ) THEN
            ALTER TABLE event_tickets ADD COLUMN quantity_total INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;

-- Adicionar quantity_sold se não existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_tickets') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'event_tickets' AND column_name = 'quantity_sold'
        ) THEN
            ALTER TABLE event_tickets ADD COLUMN quantity_sold INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;

-- ============================================================
-- ÍNDICES (apenas se tabela existe)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_tickets') THEN
        CREATE INDEX IF NOT EXISTS idx_event_tickets_tenant_id
            ON event_tickets(tenant_id);
    END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE event_tickets IS 'Tipos de ingressos para eventos. Ingresso ≠ Produto.';





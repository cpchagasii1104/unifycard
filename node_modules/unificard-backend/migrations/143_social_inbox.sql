-- ============================================================
-- UNIFICARD — SOCIAL INBOX DOMAIN
-- Arquivo: 143_social_inbox.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o domínio de INBOX SOCIAL DE AÇÕES
-- Consumindo Dispatch, Bookings, Decisões e Pagamentos
--
-- REGRAS CANÔNICAS:
-- * Inbox é READ MODEL (derivado de effects)
-- * Inbox NÃO decide nada
-- * Inbox NÃO cria ação automática
-- * Inbox apenas ORGANIZA o que já aconteceu
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_item_status') THEN
    CREATE TYPE inbox_item_status AS ENUM (
      'unread',   -- Item não lido
      'read',     -- Item lido
      'archived'  -- Item arquivado
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inbox_source_type') THEN
    CREATE TYPE inbox_source_type AS ENUM (
      'dispatch',  -- Oportunidade despachada
      'booking',   -- Booking solicitado
      'decision',  -- Decisão de booking
      'payment'    -- Pagamento solicitado/executado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: SOCIAL_INBOX_ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS social_inbox_items (
  inbox_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: Inbox é READ MODEL (derivado de effects)
  -- 🔴 BLINDAGEM: Inbox NÃO decide nada, apenas ORGANIZA
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor destinatário
  source_type inbox_source_type NOT NULL, -- Tipo da fonte (dispatch, booking, decision, payment)
  source_id UUID NOT NULL, -- ID da entidade fonte
  
  -- Status
  status inbox_item_status NOT NULL DEFAULT 'unread',
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ, -- Quando foi lido (se status = 'read')
  archived_at TIMESTAMPTZ, -- Quando foi arquivado (se status = 'archived')
  
  -- Constraints
  CONSTRAINT social_inbox_items_unique_source UNIQUE (actor_id, source_type, source_id)
    -- 🔴 BLINDAGEM: Apenas um item por actor + source_type + source_id
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_social_inbox_items_actor_id ON social_inbox_items(actor_id);
CREATE INDEX IF NOT EXISTS idx_social_inbox_items_source_type ON social_inbox_items(source_type);
CREATE INDEX IF NOT EXISTS idx_social_inbox_items_source_id ON social_inbox_items(source_id);
CREATE INDEX IF NOT EXISTS idx_social_inbox_items_tenant_id ON social_inbox_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_inbox_items_status ON social_inbox_items(status);
CREATE INDEX IF NOT EXISTS idx_social_inbox_items_created_at ON social_inbox_items(created_at DESC);

-- Índice composto para busca de inbox por actor e status
CREATE INDEX IF NOT EXISTS idx_social_inbox_items_actor_status 
  ON social_inbox_items(actor_id, status, created_at DESC);

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_social_inbox_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_social_inbox_items_updated_at
  BEFORE UPDATE ON social_inbox_items
  FOR EACH ROW
  EXECUTE FUNCTION update_social_inbox_items_updated_at();

-- ============================================================
-- FIM 143_social_inbox.sql
-- ============================================================

COMMIT;


-- ================================================
-- UNIFICARD - MIGRATION 087
-- Events Multi-Actor System
-- Sistema de eventos multi-atores (bandas, artistas, bares, teatros, empresas, produtores)
-- ================================================

-- ===========================
-- ATUALIZAR TABELA EVENTS
-- ===========================

-- Adicionar campos obrigatórios se não existirem
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INT CHECK (capacity > 0 OR capacity IS NULL);
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_actor_id UUID REFERENCES actors(actor_id) ON DELETE RESTRICT;

-- Atualizar status para incluir 'finished' (se não existir)
DO $$
BEGIN
  -- Verificar se a constraint existe e ajustar
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_event_status'
    AND conrelid = 'events'::regclass
  ) THEN
    -- Dropar constraint antiga
    ALTER TABLE events DROP CONSTRAINT IF EXISTS check_event_status;
  END IF;
  
  -- Criar nova constraint com todos os status
  ALTER TABLE events ADD CONSTRAINT check_event_status CHECK (
    status IN ('draft', 'published', 'cancelled', 'finished')
  );
END $$;

-- Renomear colunas para padrão snake_case se necessário
DO $$
BEGIN
  -- Verificar se datetime_start existe, senão criar a partir de start_time
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

-- Índices para novos campos
CREATE INDEX IF NOT EXISTS idx_events_created_by_actor ON events (created_by_actor_id) WHERE created_by_actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_datetime_start ON events (datetime_start);

-- ===========================
-- EVENT_ACTOR (Relacionamento N:N)
-- ===========================
CREATE TABLE IF NOT EXISTS event_actor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  
  -- Papel do actor no evento
  role VARCHAR(50) NOT NULL CHECK (role IN ('artist', 'venue', 'organizer', 'sponsor', 'supporter')),
  
  -- Permissões
  can_publish BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  
  -- Financeiro (preparação para divisão de receita)
  revenue_share_percent NUMERIC(5,2) CHECK (revenue_share_percent >= 0 AND revenue_share_percent <= 100),
  
  -- Status da participação
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'removed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: um actor só pode ter um papel por evento
  CONSTRAINT event_actor_unique UNIQUE (event_id, actor_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_actor_event ON event_actor (event_id);
CREATE INDEX IF NOT EXISTS idx_event_actor_actor ON event_actor (actor_id);
CREATE INDEX IF NOT EXISTS idx_event_actor_tenant ON event_actor (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_actor_role ON event_actor (role);
CREATE INDEX IF NOT EXISTS idx_event_actor_status ON event_actor (status);

-- RLS
ALTER TABLE event_actor ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_actor_rls ON event_actor
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- TRIGGERS
-- ===========================
CREATE OR REPLACE FUNCTION update_event_actor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_actor_updated_at
  BEFORE UPDATE ON event_actor
  FOR EACH ROW
  EXECUTE FUNCTION update_event_actor_updated_at();

-- ===========================
-- FUNÇÃO: Verificar requisitos para publicação
-- ===========================
CREATE OR REPLACE FUNCTION check_event_publish_requirements(event_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_artist BOOLEAN;
  has_venue BOOLEAN;
BEGIN
  -- Verificar se tem pelo menos 1 artist
  SELECT EXISTS (
    SELECT 1 FROM event_actor
    WHERE event_id = event_uuid
    AND role = 'artist'
    AND status = 'accepted'
  ) INTO has_artist;
  
  -- Verificar se tem pelo menos 1 venue
  SELECT EXISTS (
    SELECT 1 FROM event_actor
    WHERE event_id = event_uuid
    AND role = 'venue'
    AND status = 'accepted'
  ) INTO has_venue;
  
  RETURN has_artist AND has_venue;
END;
$$ LANGUAGE plpgsql;

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE event_actor IS 'Relacionamento N:N entre eventos e actors com papéis e permissões';
COMMENT ON COLUMN event_actor.role IS 'Papel do actor: artist (banda/artista), venue (local), organizer (produtor), sponsor (patrocinador), supporter (apoiador)';
COMMENT ON COLUMN event_actor.can_publish IS 'Se o actor pode publicar o evento';
COMMENT ON COLUMN event_actor.can_edit IS 'Se o actor pode editar o evento';
COMMENT ON COLUMN event_actor.revenue_share_percent IS 'Percentual de divisão de receita (0-100)';
COMMENT ON COLUMN event_actor.status IS 'Status da participação: pending (aguardando aceite), accepted (aceito), rejected (recusado), removed (removido)';
COMMENT ON FUNCTION check_event_publish_requirements IS 'Verifica se evento atende requisitos mínimos para publicação (1 artist + 1 venue)';


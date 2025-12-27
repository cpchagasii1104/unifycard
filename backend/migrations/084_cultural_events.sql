-- Migration: 084_cultural_events.sql
-- FASE 16: Cultura & Eventos - Eventos Culturais
-- Cria tabelas para eventos culturais, participantes e split de receita (impacto)

-- Tabela de Eventos Culturais
CREATE TABLE IF NOT EXISTS cultural_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    created_by_cultural_profile_id UUID NOT NULL REFERENCES cultural_profiles(id) ON DELETE CASCADE,
    co_creators_cultural_profile_ids UUID[], -- Array de IDs de outros PACs co-criadores (opcional)
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'SHOW', 'OFICINA', 'FESTIVAL', 'RODA', 'AULA', 
        'EXPOSICAO', 'DEBATE', 'INTERVENCAO'
    )),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    datetime_start TIMESTAMP WITH TIME ZONE NOT NULL,
    datetime_end TIMESTAMP WITH TIME ZONE NOT NULL,
    location_cultural_profile_id UUID REFERENCES cultural_profiles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'PUBLISHED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'ARCHIVED'
    )),
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'LOCAL', 'PRIVATE')),
    ticket_price_cents INTEGER, -- Em centavos (opcional, só se PJ VERIFIED)
    max_attendees INTEGER, -- Limite de público (opcional)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE, -- Quando evento foi marcado como COMPLETED
    
    CONSTRAINT cultural_events_datetime_check CHECK (datetime_end > datetime_start)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cultural_events_creator ON cultural_events(tenant_id, created_by_cultural_profile_id);
CREATE INDEX IF NOT EXISTS idx_cultural_events_location ON cultural_events(tenant_id, location_cultural_profile_id) WHERE location_cultural_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cultural_events_status ON cultural_events(tenant_id, status, datetime_start);
CREATE INDEX IF NOT EXISTS idx_cultural_events_type ON cultural_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_cultural_events_datetime ON cultural_events(tenant_id, datetime_start, datetime_end);

-- Tabela de Participantes do Evento
CREATE TABLE IF NOT EXISTS event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES cultural_events(id) ON DELETE CASCADE,
    cultural_profile_id UUID NOT NULL REFERENCES cultural_profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ARTIST', 'HOST', 'PRODUCER', 'SUPPORT')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Um PAC não pode ter múltiplos papéis no mesmo evento
    CONSTRAINT event_participants_unique UNIQUE (tenant_id, event_id, cultural_profile_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(tenant_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_profile ON event_participants(tenant_id, cultural_profile_id);

-- Tabela de Split de Receita (Impacto, não dinheiro ainda)
CREATE TABLE IF NOT EXISTS event_revenue_split (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES cultural_events(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('CULTURAL_PROFILE', 'REGION', 'FUND')),
    target_id VARCHAR(255) NOT NULL, -- ID do PAC, região ou fundo
    percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Um evento não pode ter múltiplos splits para o mesmo target
    CONSTRAINT event_revenue_split_unique UNIQUE (tenant_id, event_id, target_type, target_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_revenue_split_event ON event_revenue_split(tenant_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_revenue_split_target ON event_revenue_split(tenant_id, target_type, target_id);

-- Comentários
COMMENT ON TABLE cultural_events IS 'Eventos culturais criados por PACs';
COMMENT ON COLUMN cultural_events.status IS 'Estado: DRAFT (rascunho), PUBLISHED (publicado), CONFIRMED (local confirmou), COMPLETED (aconteceu), CANCELLED (cancelado), ARCHIVED (arquivado)';
COMMENT ON COLUMN cultural_events.location_cultural_profile_id IS 'PAC local (BAR/VENUE/CIRCLE) que hospeda o evento';
COMMENT ON COLUMN cultural_events.ticket_price_cents IS 'Preço do ingresso em centavos (só se criador tem PJ VERIFIED)';
COMMENT ON TABLE event_participants IS 'Participantes de eventos culturais (artistas, locais, produtores)';
COMMENT ON TABLE event_revenue_split IS 'Split percentual de receita/impacto do evento (público e imutável após PUBLISHED)';
COMMENT ON COLUMN event_revenue_split.target_type IS 'Destino: CULTURAL_PROFILE (PAC), REGION (região), FUND (fundo cultural)';
COMMENT ON COLUMN event_revenue_split.percentage IS 'Percentual (0-100). Soma de todos os splits de um evento deve ser 100';














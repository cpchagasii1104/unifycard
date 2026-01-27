-- ============================================================
-- UNIFICARD - MIGRATION 084
-- FASE 16: Cultura & Eventos - Eventos Culturais
-- ============================================================
--
-- OBJETIVO:
-- Modelar eventos culturais criados por Perfis de Atuação
-- Cultural (PAC), incluindo participantes e definição
-- declarativa de split de impacto/receita.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena eventos, participantes e splits declarados
--   • garante integridade estrutural e isolamento por tenant
-- - A APLICAÇÃO:
--   • controla ciclo de vida do evento (status)
--   • valida regras de publicação e visibilidade
--   • garante que a soma dos splits seja 100%
--   • executa distribuição real via SplitEngine
-- - Nenhuma regra econômica é executada no banco
--
-- DECISÕES IMPORTANTES:
-- - event_type e role são campos livres (sem CHECK rígido)
--   para permitir expansão cultural sem migrations traumáticas
-- - co_creators_cultural_profile_ids é um array proposital
--   (limitação conhecida: sem FK direta)
-- - percentage é INTEGER (limitação atual documentada)
-- - updated_at é controlado pela aplicação
--
-- DEPENDÊNCIAS:
-- - tenants
-- - cultural_profiles
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- EVENTOS CULTURAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS cultural_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    created_by_cultural_profile_id UUID NOT NULL
        REFERENCES cultural_profiles(id) ON DELETE CASCADE,

    co_creators_cultural_profile_ids UUID[],

    event_type VARCHAR(50) NOT NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    datetime_start TIMESTAMP WITH TIME ZONE NOT NULL,
    datetime_end TIMESTAMP WITH TIME ZONE NOT NULL,

    location_cultural_profile_id UUID
        REFERENCES cultural_profiles(id) ON DELETE SET NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',

    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',

    ticket_price_cents INTEGER,
    max_attendees INTEGER,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT cultural_events_datetime_check
        CHECK (datetime_end > datetime_start)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cultural_events_creator
    ON cultural_events (tenant_id, created_by_cultural_profile_id);

CREATE INDEX IF NOT EXISTS idx_cultural_events_location
    ON cultural_events (tenant_id, location_cultural_profile_id)
    WHERE location_cultural_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cultural_events_status
    ON cultural_events (tenant_id, status, datetime_start);

CREATE INDEX IF NOT EXISTS idx_cultural_events_type
    ON cultural_events (tenant_id, event_type);

CREATE INDEX IF NOT EXISTS idx_cultural_events_datetime
    ON cultural_events (tenant_id, datetime_start, datetime_end);


-- ============================================================
-- PARTICIPANTES DO EVENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    event_id UUID NOT NULL
        REFERENCES cultural_events(id) ON DELETE CASCADE,

    cultural_profile_id UUID NOT NULL
        REFERENCES cultural_profiles(id) ON DELETE CASCADE,

    role VARCHAR(50) NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT event_participants_unique
        UNIQUE (tenant_id, event_id, cultural_profile_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_participants_event
    ON event_participants (tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_participants_profile
    ON event_participants (tenant_id, cultural_profile_id);


-- ============================================================
-- SPLIT DE RECEITA / IMPACTO (DECLARATIVO)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_revenue_split (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    event_id UUID NOT NULL
        REFERENCES cultural_events(id) ON DELETE CASCADE,

    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(255) NOT NULL,

    percentage INTEGER NOT NULL
        CHECK (percentage >= 0 AND percentage <= 100),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT event_revenue_split_unique
        UNIQUE (tenant_id, event_id, target_type, target_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_revenue_split_event
    ON event_revenue_split (tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_revenue_split_target
    ON event_revenue_split (tenant_id, target_type, target_id);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE cultural_events IS
    'Eventos culturais criados por Perfis de Atuação Cultural (PAC).';

COMMENT ON COLUMN cultural_events.status IS
    'Estado do evento controlado pela aplicação (ex: DRAFT, PUBLISHED, CONFIRMED, COMPLETED, CANCELLED).';

COMMENT ON COLUMN cultural_events.location_cultural_profile_id IS
    'PAC local (BAR, VENUE, CIRCLE, etc) que hospeda o evento.';

COMMENT ON COLUMN cultural_events.ticket_price_cents IS
    'Preço do ingresso em centavos. Validação de permissões ocorre na aplicação.';

COMMENT ON TABLE event_participants IS
    'Participantes de eventos culturais e seus papéis declarativos.';

COMMENT ON TABLE event_revenue_split IS
    'Definição declarativa de split percentual de receita/impacto do evento. Execução ocorre fora do banco.';

COMMENT ON COLUMN event_revenue_split.target_type IS
    'Destino do split (CULTURAL_PROFILE, REGION, FUND, etc).';

COMMENT ON COLUMN event_revenue_split.percentage IS
    'Percentual do split. A aplicação garante que a soma total seja 100.';














-- Migration: 085_cultural_event_checkins.sql
-- FASE 17: Presença / Check-in em Eventos Culturais
-- Cria tabela para registrar check-ins físicos verificáveis

CREATE TABLE IF NOT EXISTS cultural_event_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES cultural_events(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL, -- global_user_id ou cultural_profile_id
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'page', 'cultural_profile')),
    checked_in_by_actor_id UUID, -- Quem validou (se foi validação manual)
    checked_in_by_actor_type VARCHAR(20) CHECK (checked_in_by_actor_type IN ('user', 'page', 'cultural_profile')),
    check_in_method VARCHAR(20) NOT NULL CHECK (check_in_method IN ('QR_CODE', 'MANUAL', 'AUTO')),
    geo_lat DECIMAL(10, 8), -- Latitude (opcional, se disponível)
    geo_lng DECIMAL(11, 8), -- Longitude (opcional, se disponível)
    device_fingerprint VARCHAR(255), -- Hash do dispositivo (anti-fraude)
    metadata JSONB, -- Dados extras (ex: foto, observações)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Um ator só pode fazer check-in uma vez por evento
    CONSTRAINT cultural_event_checkins_unique UNIQUE (tenant_id, event_id, actor_id, actor_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_event 
    ON cultural_event_checkins(tenant_id, event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_actor 
    ON cultural_event_checkins(tenant_id, actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_validator 
    ON cultural_event_checkins(tenant_id, checked_in_by_actor_id) 
    WHERE checked_in_by_actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_method 
    ON cultural_event_checkins(tenant_id, check_in_method, created_at DESC);

-- Comentários
COMMENT ON TABLE cultural_event_checkins IS 'Check-ins físicos verificáveis em eventos culturais - FASE 17';
COMMENT ON COLUMN cultural_event_checkins.actor_id IS 'Quem fez check-in (PF, PJ ou PAC)';
COMMENT ON COLUMN cultural_event_checkins.checked_in_by_actor_id IS 'Quem validou (se foi validação manual por staff/local)';
COMMENT ON COLUMN cultural_event_checkins.check_in_method IS 'Método: QR_CODE (público), MANUAL (staff valida), AUTO (futuro: geofence)';
COMMENT ON COLUMN cultural_event_checkins.geo_lat IS 'Latitude do check-in (opcional, mas recomendado para auditoria)';
COMMENT ON COLUMN cultural_event_checkins.device_fingerprint IS 'Hash do dispositivo para anti-fraude';














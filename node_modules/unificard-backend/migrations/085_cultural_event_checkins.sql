-- ============================================================
-- UNIFICARD - MIGRATION 085
-- FASE 17: Presença / Check-in em Eventos Culturais
-- ============================================================
--
-- OBJETIVO:
-- Registrar check-ins físicos em eventos culturais de forma
-- auditável, antifraude e verificável.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - cultural_event_checkins é um LOG IMUTÁVEL
-- - O BANCO:
--   • registra o fato do check-in
--   • garante unicidade (1 check-in por ator por evento)
-- - A APLICAÇÃO:
--   • resolve identidade real via actor_type
--   • valida coerência entre método e validador
--   • dispara impacto / ledger / eventos derivados
--
-- DECISÕES IMPORTANTES:
-- - actor_id NÃO possui FK propositalmente
--   (pode representar user, page ou cultural_profile)
-- - actor_type e check_in_method são campos livres
--   (validação ocorre na aplicação)
-- - checked_in_by_* só é usado em validações manuais
-- - RLS por tenant_id é obrigatória (definida em migration própria)
--
-- DEPENDÊNCIAS:
-- - tenants
-- - cultural_events
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- CHECK-INS EM EVENTOS CULTURAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS cultural_event_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    event_id UUID NOT NULL
        REFERENCES cultural_events(id) ON DELETE CASCADE,

    actor_id UUID NOT NULL,
    actor_type VARCHAR(20) NOT NULL,

    checked_in_by_actor_id UUID,
    checked_in_by_actor_type VARCHAR(20),

    check_in_method VARCHAR(20) NOT NULL,

    geo_lat DECIMAL(10, 8),
    geo_lng DECIMAL(11, 8),

    device_fingerprint VARCHAR(255),
    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT cultural_event_checkins_unique
        UNIQUE (tenant_id, event_id, actor_id, actor_type)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_event
    ON cultural_event_checkins (tenant_id, event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_actor
    ON cultural_event_checkins (tenant_id, actor_id, actor_type);

CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_validator
    ON cultural_event_checkins (tenant_id, checked_in_by_actor_id)
    WHERE checked_in_by_actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cultural_event_checkins_method
    ON cultural_event_checkins (tenant_id, check_in_method, created_at DESC);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE cultural_event_checkins IS
    'Log imutável de check-ins físicos em eventos culturais.';

COMMENT ON COLUMN cultural_event_checkins.actor_id IS
    'Identificador do ator que realizou o check-in (user, page ou cultural_profile).';

COMMENT ON COLUMN cultural_event_checkins.checked_in_by_actor_id IS
    'Ator que validou o check-in manualmente (quando aplicável).';

COMMENT ON COLUMN cultural_event_checkins.check_in_method IS
    'Método do check-in (ex: QR_CODE, MANUAL, AUTO). Validação ocorre na aplicação.';

COMMENT ON COLUMN cultural_event_checkins.geo_lat IS
    'Latitude do check-in (opcional, recomendada para auditoria).';

COMMENT ON COLUMN cultural_event_checkins.device_fingerprint IS
    'Hash do dispositivo usado no check-in (anti-fraude).';














-- ============================================================
-- UNIFICARD - MIGRATION 161
-- Tabela: event_rsvp
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para RSVP (confirmação de presença) em eventos.
--
-- REGRAS CANÔNICAS:
-- - RSVP só acontece após clique explícito
-- - RSVP NÃO altera visibilidade
-- - RSVP NÃO dispara ações automáticas
-- - RSVP é reversível (usuário pode mudar)
--
-- ============================================================

-- ============================================================
-- TABELA PRINCIPAL: event_rsvp
-- ============================================================

CREATE TABLE IF NOT EXISTS event_rsvp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    -- Usuário autenticado
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,

    -- Convidado externo
    guest_email VARCHAR(255),
    guest_name VARCHAR(255),

    -- Status do RSVP
    status VARCHAR(20) NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),

    -- Observabilidade opcional
    notes TEXT,

    -- Auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONSTRAINTS DE UNICIDADE (ÍNDICES PARCIAIS)
-- ============================================================

-- Um RSVP por usuário autenticado por evento
CREATE UNIQUE INDEX IF NOT EXISTS ux_event_rsvp_user
    ON event_rsvp (event_id, user_id)
    WHERE user_id IS NOT NULL;

-- Um RSVP por convidado externo (email) por evento
CREATE UNIQUE INDEX IF NOT EXISTS ux_event_rsvp_guest
    ON event_rsvp (event_id, guest_email)
    WHERE guest_email IS NOT NULL;

-- ============================================================
-- ÍNDICES DE CONSULTA
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_rsvp_event
    ON event_rsvp (event_id);

CREATE INDEX IF NOT EXISTS idx_event_rsvp_user
    ON event_rsvp (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvp_tenant
    ON event_rsvp (tenant_id);

CREATE INDEX IF NOT EXISTS idx_event_rsvp_status
    ON event_rsvp (status);

CREATE INDEX IF NOT EXISTS idx_event_rsvp_created_at
    ON event_rsvp (created_at DESC);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION update_event_rsvp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_event_rsvp_updated_at ON event_rsvp;

CREATE TRIGGER trigger_update_event_rsvp_updated_at
    BEFORE UPDATE ON event_rsvp
    FOR EACH ROW
    EXECUTE FUNCTION update_event_rsvp_updated_at();

-- ============================================================
-- READ MODEL: event_rsvp_counts
-- ============================================================

CREATE TABLE IF NOT EXISTS event_rsvp_counts (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
    count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (event_id, status)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvp_counts_event
    ON event_rsvp_counts (event_id);

CREATE INDEX IF NOT EXISTS idx_event_rsvp_counts_tenant
    ON event_rsvp_counts (tenant_id);

-- ============================================================
-- TRIGGER DE AGREGAÇÃO
-- ============================================================

CREATE OR REPLACE FUNCTION update_event_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO event_rsvp_counts (event_id, tenant_id, status, count, updated_at)
        VALUES (NEW.event_id, NEW.tenant_id, NEW.status, 1, NOW())
        ON CONFLICT (event_id, status)
        DO UPDATE SET
            count = event_rsvp_counts.count + 1,
            updated_at = NOW();

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE event_rsvp_counts
        SET count = GREATEST(count - 1, 0),
            updated_at = NOW()
        WHERE event_id = OLD.event_id
          AND status = OLD.status;

    ELSIF TG_OP = 'UPDATE' THEN
        -- decrementa status antigo
        UPDATE event_rsvp_counts
        SET count = GREATEST(count - 1, 0),
            updated_at = NOW()
        WHERE event_id = OLD.event_id
          AND status = OLD.status;

        -- incrementa status novo
        INSERT INTO event_rsvp_counts (event_id, tenant_id, status, count, updated_at)
        VALUES (NEW.event_id, NEW.tenant_id, NEW.status, 1, NOW())
        ON CONFLICT (event_id, status)
        DO UPDATE SET
            count = event_rsvp_counts.count + 1,
            updated_at = NOW();
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_event_rsvp_count ON event_rsvp;

CREATE TRIGGER trigger_update_event_rsvp_count
    AFTER INSERT OR UPDATE OR DELETE ON event_rsvp
    FOR EACH ROW
    EXECUTE FUNCTION update_event_rsvp_count();

-- ============================================================
-- DOCUMENTAÇÃO
-- ============================================================

COMMENT ON TABLE event_rsvp IS
    'RSVP (confirmação de presença) em eventos. Observabilidade passiva, reversível e sem efeitos colaterais.';

COMMENT ON TABLE event_rsvp_counts IS
    'Read-model agregado de RSVPs por evento e status (performance).';

COMMENT ON COLUMN event_rsvp.status IS
    'Status da confirmação: yes, no, maybe';

COMMENT ON COLUMN event_rsvp.guest_email IS
    'Email do convidado externo quando não há usuário cadastrado';

COMMENT ON COLUMN event_rsvp.guest_name IS
    'Nome do convidado externo quando não há usuário cadastrado';

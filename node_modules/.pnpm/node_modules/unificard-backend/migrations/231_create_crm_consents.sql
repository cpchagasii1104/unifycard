-- ============================================================
-- UNIFICARD - MIGRATION 231
-- SPRINT 88: CRM CANÔNICO
-- Tabela: crm_consents
-- ============================================================
--
-- OBJETIVO:
-- Gerenciar consentimentos de comunicação por canal.
--
-- REGRAS:
-- - 1 consentimento por contact + channel
-- - Status: GRANTED ou REVOKED
-- - Tudo auditável
-- ============================================================

-- ============================================================
-- ENUM: CRM Consent Channel
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_consent_channel') THEN
    CREATE TYPE crm_consent_channel AS ENUM (
      'EMAIL',
      'SMS',
      'WHATSAPP',
      'PUSH'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: CRM Consent Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_consent_status') THEN
    CREATE TYPE crm_consent_status AS ENUM (
      'GRANTED',  -- Consentimento concedido
      'REVOKED'   -- Consentimento revogado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: crm_consents
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_consents (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculo com contact
    contact_id UUID NOT NULL
        REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Canal e status
    channel crm_consent_channel NOT NULL,
    status crm_consent_status NOT NULL DEFAULT 'REVOKED',
    
    -- Quem atualizou
    updated_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    updated_by_user_id UUID
        REFERENCES users(user_id) ON DELETE SET NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT crm_consents_unique_per_contact_channel UNIQUE (tenant_id, contact_id, channel)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_crm_consents_tenant_id
    ON crm_consents(tenant_id);

-- Índice para buscar por contact
CREATE INDEX IF NOT EXISTS idx_crm_consents_contact
    ON crm_consents(tenant_id, contact_id, channel);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_crm_consents_status
    ON crm_consents(tenant_id, channel, status)
    WHERE status = 'GRANTED';

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_crm_consents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crm_consents_updated_at
    BEFORE UPDATE ON crm_consents
    FOR EACH ROW
    EXECUTE FUNCTION update_crm_consents_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE crm_consents ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem consentimentos do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'crm_consents'
      AND policyname = 'crm_consents_tenant_isolation'
  ) THEN
    CREATE POLICY crm_consents_tenant_isolation
      ON crm_consents
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE crm_consents IS 'Consentimentos de comunicação por canal. 1 consentimento por contact + channel.';
COMMENT ON COLUMN crm_consents.channel IS 'Canal: EMAIL, SMS, WHATSAPP, PUSH';
COMMENT ON COLUMN crm_consents.status IS 'Status: GRANTED (concedido) ou REVOKED (revogado)';






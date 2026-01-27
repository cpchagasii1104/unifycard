-- ============================================================
-- UNIFICARD - MIGRATION 222
-- SPRINT 0: CONTACTS / CLIENTES UNIFICADOS
-- Tabela: contacts
-- ============================================================
--
-- OBJETIVO:
-- Criar entidade canônica "contacts" para representar
-- cliente/pagador/comprador (pessoa ou empresa),
-- independente de ser usuário do sistema.
--
-- REGRAS:
-- - Contact ≠ User
-- - Contact ≠ Actor
-- - Contact pode estar vinculado a User (opcional)
-- - Tax_id normalizado (só dígitos)
-- - Unique parcial: (tenant_id, tax_id) onde tax_id não nulo
-- ============================================================

-- ============================================================
-- ENUM: Contact Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_type') THEN
    CREATE TYPE contact_type AS ENUM (
      'PERSON',   -- Pessoa física
      'COMPANY'   -- Pessoa jurídica
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Tipo
    type contact_type NOT NULL,
    
    -- Dados básicos
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(20), -- CPF ou CNPJ (normalizado, só dígitos)
    email VARCHAR(255),
    phone VARCHAR(50),
    
    -- Endereço (JSONB)
    address JSONB DEFAULT '{}'::jsonb,
    
    -- Vínculo com usuário (opcional)
    user_id UUID, -- Referência a users (sem FK para flexibilidade)
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT check_tax_id_format CHECK (
        tax_id IS NULL OR (LENGTH(tax_id) >= 11 AND LENGTH(tax_id) <= 14)
    )
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id
    ON contacts(tenant_id);

-- Índice para buscar por tax_id (com unique parcial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_tenant_tax_id_unique
    ON contacts(tenant_id, tax_id)
    WHERE tax_id IS NOT NULL;

-- Índice para buscar por tax_id (sem unique, para busca)
CREATE INDEX IF NOT EXISTS idx_contacts_tax_id
    ON contacts(tenant_id, tax_id)
    WHERE tax_id IS NOT NULL;

-- Índice para buscar por email
CREATE INDEX IF NOT EXISTS idx_contacts_email
    ON contacts(tenant_id, email)
    WHERE email IS NOT NULL;

-- Índice para buscar por phone
CREATE INDEX IF NOT EXISTS idx_contacts_phone
    ON contacts(tenant_id, phone)
    WHERE phone IS NOT NULL;

-- Índice para buscar por user_id
CREATE INDEX IF NOT EXISTS idx_contacts_user_id
    ON contacts(tenant_id, user_id)
    WHERE user_id IS NOT NULL;

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_contacts_type
    ON contacts(tenant_id, type);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem contacts do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'contacts'
      AND policyname = 'contacts_tenant_isolation'
  ) THEN
    CREATE POLICY contacts_tenant_isolation
      ON contacts
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_contacts_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE contacts IS 'Contatos/Clientes unificados. Contact ≠ User, Contact ≠ Actor. Pode estar vinculado a User (opcional).';
COMMENT ON COLUMN contacts.type IS 'Tipo: PERSON (pessoa física) ou COMPANY (pessoa jurídica)';
COMMENT ON COLUMN contacts.tax_id IS 'CPF (11 dígitos) ou CNPJ (14 dígitos), normalizado (só dígitos)';
COMMENT ON COLUMN contacts.address IS 'Endereço completo em JSONB: {street, number, complement, neighborhood, city, state, zipCode}';
COMMENT ON COLUMN contacts.user_id IS 'ID do usuário vinculado (opcional, sem FK para flexibilidade)';






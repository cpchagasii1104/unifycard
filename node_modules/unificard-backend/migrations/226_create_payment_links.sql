-- ============================================================
-- UNIFICARD - MIGRATION 226
-- SPRINT 86: PAYMENT LINKS (LINK DE PAGAMENTO)
-- Tabela: payment_links
-- ============================================================
--
-- OBJETIVO:
-- Criar link público de pagamento que funciona sem login.
-- Suporta PIX e UNIFYCARD, respeita split, fiscal e auditoria.
--
-- REGRAS:
-- - Link pode ser usado sem login
-- - Valida expiração e limite de uso
-- - Não cria PaymentIntent automaticamente
-- - Tudo auditável
-- ============================================================

-- ============================================================
-- ENUM: Payment Link Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_link_status') THEN
    CREATE TYPE payment_link_status AS ENUM (
      'ACTIVE',    -- Link ativo
      'EXPIRED',   -- Link expirado
      'DISABLED'   -- Link desabilitado manualmente
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: payment_links
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_links (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Criador
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Slug público (único, usado na URL)
    slug VARCHAR(255) NOT NULL,
    
    -- Informações do link
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    
    -- Expiração e limite
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER, -- NULL = sem limite
    uses_count INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status payment_link_status NOT NULL DEFAULT 'ACTIVE',
    
    -- Contact opcional (vinculado ao link)
    contact_id UUID
        REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_amount_positive CHECK (amount > 0),
    CONSTRAINT check_uses_count_non_negative CHECK (uses_count >= 0),
    CONSTRAINT check_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
    CONSTRAINT payment_links_unique_slug UNIQUE (tenant_id, slug)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_payment_links_tenant_id
    ON payment_links(tenant_id);

-- Índice para buscar por slug (lookup público)
CREATE INDEX IF NOT EXISTS idx_payment_links_slug
    ON payment_links(tenant_id, slug)
    WHERE status = 'ACTIVE';

-- Índice para buscar por criador
CREATE INDEX IF NOT EXISTS idx_payment_links_created_by
    ON payment_links(tenant_id, created_by_actor_id, created_at DESC);

-- Índice para buscar links expirados
CREATE INDEX IF NOT EXISTS idx_payment_links_expired
    ON payment_links(tenant_id, expires_at)
    WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem links do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'payment_links'
      AND policyname = 'payment_links_tenant_isolation'
  ) THEN
    CREATE POLICY payment_links_tenant_isolation
      ON payment_links
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_links_updated_at
    BEFORE UPDATE ON payment_links
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_links_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE payment_links IS 'Links públicos de pagamento. Funcionam sem login, suportam PIX e UNIFYCARD.';
COMMENT ON COLUMN payment_links.slug IS 'Slug público único usado na URL (/pay/:slug)';
COMMENT ON COLUMN payment_links.max_uses IS 'Limite de usos (NULL = sem limite)';
COMMENT ON COLUMN payment_links.uses_count IS 'Contador de usos (incrementado após pagamento SUCCESS)';






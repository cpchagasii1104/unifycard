-- ============================================================
-- UNIFICARD - MIGRATION 182
-- SPRINT 47: SOCIAL COMO PLUGIN TRANSACIONAL DO MARKETPLACE
-- Tabela: social_marketplace_refs
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para referências do marketplace no social feed.
-- Social observa, referencia e inicia fluxos, mas NUNCA executa economia.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Social NÃO cria Order
-- - Social NÃO cria PaymentIntent
-- - Social NÃO toca Bank
-- - Social é apenas entrada/contexto
-- ============================================================

-- ============================================================
-- ENUM: Tipo de referência
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'social_marketplace_ref_type') THEN
        CREATE TYPE social_marketplace_ref_type AS ENUM (
            'PRODUCT',   -- Referência a produto/variante
            'ORDER',     -- Referência a pedido
            'CAMPAIGN'   -- Referência a campanha (futuro)
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: social_marketplace_refs
-- ============================================================
CREATE TABLE IF NOT EXISTS social_marketplace_refs (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculo com post social
    post_id UUID NOT NULL,
    -- NOTA: Não há FK para posts porque pode ser de módulo externo
    -- Validação é feita no service
    
    -- Tipo de referência
    ref_type social_marketplace_ref_type NOT NULL,
    
    -- ID da referência (product_variant_id, order_id, etc.)
    ref_id UUID NOT NULL,
    
    -- Metadados adicionais (JSONB)
    -- Ex: variant_name, order_status, campaign_name (futuro)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_social_marketplace_refs_tenant
    ON social_marketplace_refs (tenant_id);

-- Índice para buscar por post
CREATE INDEX IF NOT EXISTS idx_social_marketplace_refs_post
    ON social_marketplace_refs (tenant_id, post_id);

-- Índice para buscar por tipo e referência
CREATE INDEX IF NOT EXISTS idx_social_marketplace_refs_ref
    ON social_marketplace_refs (tenant_id, ref_type, ref_id);

-- Índice único: um post pode ter apenas uma referência de cada tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_marketplace_refs_post_type
    ON social_marketplace_refs (tenant_id, post_id, ref_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE social_marketplace_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_marketplace_refs_rls ON social_marketplace_refs
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE social_marketplace_refs IS
    'Referências do marketplace no social feed. Social observa, referencia e inicia fluxos, mas NUNCA executa economia.';

COMMENT ON COLUMN social_marketplace_refs.post_id IS
    'ID do post social. Não há FK porque pode ser de módulo externo.';

COMMENT ON COLUMN social_marketplace_refs.ref_type IS
    'Tipo: PRODUCT (produto/variante), ORDER (pedido), CAMPAIGN (campanha).';

COMMENT ON COLUMN social_marketplace_refs.ref_id IS
    'ID da referência: product_variant_id, order_id, campaign_id (futuro).';

COMMENT ON COLUMN social_marketplace_refs.metadata IS
    'Metadados: variant_name, order_status, campaign_name (futuro).';








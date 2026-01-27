-- ============================================================
-- UNIFICARD - MIGRATION 181
-- SPRINT 44: DOCUMENTO FISCAL - BASE CANÔNICA
-- Tabelas: fiscal_documents, fiscal_document_items
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de documento fiscal.
-- Representação declarativa, sem integração com SEFAZ ainda.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Documento é REPRESENTAÇÃO, não execução
-- - Não integra com SEFAZ ainda
-- - Não bloqueia venda
-- - Append-only (histórico não é deletado)
-- ============================================================

-- ============================================================
-- ENUM: Tipo de documento fiscal
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_document_type') THEN
        CREATE TYPE fiscal_document_type AS ENUM (
            'NFCE',  -- Nota Fiscal de Consumidor Eletrônica (PDV)
            'NFE',   -- Nota Fiscal Eletrônica (Marketplace)
            'SAT',   -- Sistema Autenticador e Transmissor (futuro)
            'NONE'   -- Sem documento fiscal (opcional)
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Status do documento fiscal
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscal_document_status') THEN
        CREATE TYPE fiscal_document_status AS ENUM (
            'DRAFT',     -- Rascunho (não emitido)
            'ISSUED',    -- Emitido
            'CANCELLED'  -- Cancelado
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: fiscal_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_documents (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculo com venda
    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,
    
    -- Vínculo com pagamento (opcional, pode haver múltiplos intents)
    payment_intent_id UUID
        REFERENCES payment_intents(id) ON DELETE SET NULL,
    
    -- Tipo de documento
    document_type fiscal_document_type NOT NULL DEFAULT 'NONE',
    
    -- Status do documento
    status fiscal_document_status NOT NULL DEFAULT 'DRAFT',
    
    -- Valor total do documento
    total_amount NUMERIC(20, 2) NOT NULL CHECK (total_amount >= 0),
    
    -- Metadados adicionais (JSONB)
    -- Ex: chave_acesso, protocolo, xml (futuro)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Data de emissão (nullable até ser emitido)
    issued_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant
    ON fiscal_documents (tenant_id);

-- Índice para buscar por pedido
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_order
    ON fiscal_documents (tenant_id, order_id);

-- Índice para buscar por payment intent
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_payment_intent
    ON fiscal_documents (tenant_id, payment_intent_id)
    WHERE payment_intent_id IS NOT NULL;

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status
    ON fiscal_documents (tenant_id, status);

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_type
    ON fiscal_documents (tenant_id, document_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE fiscal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY fiscal_documents_rls ON fiscal_documents
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER fiscal_documents_updated_at
    BEFORE UPDATE ON fiscal_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABELA: fiscal_document_items
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_document_items (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Documento fiscal
    fiscal_document_id UUID NOT NULL
        REFERENCES fiscal_documents(id) ON DELETE CASCADE,
    
    -- Variante do produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,
    
    -- Quantidade
    quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
    
    -- Unidade
    unit VARCHAR(10) NOT NULL DEFAULT 'UN',
    
    -- Metadados adicionais (JSONB)
    -- Ex: CFOP, NCM, CST, valor_unitario, valor_total (futuro)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES (fiscal_document_items)
-- ============================================================
-- Índice para buscar por documento
CREATE INDEX IF NOT EXISTS idx_fiscal_document_items_document
    ON fiscal_document_items (fiscal_document_id);

-- Índice para buscar por variante
CREATE INDEX IF NOT EXISTS idx_fiscal_document_items_variant
    ON fiscal_document_items (product_variant_id);

-- ============================================================
-- ROW LEVEL SECURITY (fiscal_document_items)
-- ============================================================
-- RLS é herdado via fiscal_documents (tenant_id)
-- Não precisamos criar policy separada, pois items são acessados via document

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE fiscal_documents IS
    'Documentos fiscais canônicos. Representação declarativa, sem integração com SEFAZ ainda.';

COMMENT ON COLUMN fiscal_documents.document_type IS
    'Tipo: NFC-e (PDV), NF-e (Marketplace), SAT (futuro), NONE (sem documento).';

COMMENT ON COLUMN fiscal_documents.status IS
    'Status: DRAFT (rascunho), ISSUED (emitido), CANCELLED (cancelado).';

COMMENT ON COLUMN fiscal_documents.total_amount IS
    'Valor total do documento. Não recalcula, apenas espelha a venda.';

COMMENT ON COLUMN fiscal_documents.metadata IS
    'Metadados: chave_acesso, protocolo, xml (futuro quando integrar SEFAZ).';

COMMENT ON TABLE fiscal_document_items IS
    'Itens do documento fiscal. Espelha order_items.';

COMMENT ON COLUMN fiscal_document_items.metadata IS
    'Metadados: CFOP, NCM, CST, valor_unitario, valor_total (futuro).';








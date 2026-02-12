-- ============================================================
-- UNIFICARD - MIGRATION 196
-- SPRINT 69: SUPPLIERS + PURCHASE ORDERS
-- Tabela: suppliers
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de Fornecedores (Suppliers) que:
-- - Representa fornecedores de produtos
-- - NÃO executa pagamentos
-- - NÃO emite fiscal
-- - É totalmente auditável
--
-- REGRAS:
-- - Append-only (status muda, mas registros não desaparecem)
-- - Status declarativos
-- - Audit em todas as mudanças
-- ============================================================

-- ============================================================
-- ENUM: Supplier Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_status') THEN
    CREATE TYPE supplier_status AS ENUM (
      'ACTIVE',    -- Ativo
      'INACTIVE',  -- Inativo
      'SUSPENDED'  -- Suspenso
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Informações básicas
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50), -- Código interno (opcional)
    
    -- Informações de contato
    email VARCHAR(255),
    phone VARCHAR(50),
    contact_name VARCHAR(255), -- Nome do contato
    
    -- Endereço
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    
    -- Documentos
    tax_id VARCHAR(50), -- CNPJ/CPF
    registration_number VARCHAR(50), -- Inscrição estadual
    
    -- Status
    status supplier_status NOT NULL DEFAULT 'ACTIVE',
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_supplier_code_per_tenant UNIQUE (tenant_id, code)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id
    ON suppliers(tenant_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_suppliers_status
    ON suppliers(tenant_id, status);

-- Índice para buscar por nome
CREATE INDEX IF NOT EXISTS idx_suppliers_name
    ON suppliers(tenant_id, name);

-- Índice para buscar por código
CREATE INDEX IF NOT EXISTS idx_suppliers_code
    ON suppliers(tenant_id, code)
    WHERE code IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem fornecedores do próprio tenant
CREATE POLICY suppliers_tenant_isolation
    ON suppliers
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_suppliers_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE suppliers IS 'Fornecedores de produtos. Append-only: status muda, mas registros não desaparecem.';
COMMENT ON COLUMN suppliers.status IS 'Status do fornecedor: ACTIVE, INACTIVE, SUSPENDED';
COMMENT ON COLUMN suppliers.code IS 'Código interno do fornecedor (opcional, único por tenant)';







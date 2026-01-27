-- ============================================================
-- UNIFICARD - MIGRATION 186
-- SPRINT 51: MULTI-EMPRESA, FILIAIS E CONSOLIDAÇÃO
-- Tabela: organization_units
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para unidades organizacionais (matriz, filiais).
-- Permitir consolidação de dados sem quebrar isolamento.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - NÃO misturar dados sem permissão
-- - Consolidação é leitura
-- - Operação continua por actor
-- ============================================================

-- ============================================================
-- ENUM: Tipo de unidade organizacional
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_unit_type') THEN
        CREATE TYPE organization_unit_type AS ENUM (
            'MATRIX',  -- Matriz
            'BRANCH',  -- Filial
            'DC'       -- Centro de Distribuição
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: organization_units
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_units (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Nome da unidade
    name VARCHAR(255) NOT NULL,
    
    -- Tipo de unidade
    type organization_unit_type NOT NULL,
    
    -- Hierarquia (parent_id pode ser NULL para matriz)
    parent_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
    
    -- Metadados adicionais (JSONB)
    -- Ex: address, phone, manager_id
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_organization_units_tenant
    ON organization_units (tenant_id);

-- Índice para buscar por parent (hierarquia)
CREATE INDEX IF NOT EXISTS idx_organization_units_parent
    ON organization_units (tenant_id, parent_id);

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_organization_units_type
    ON organization_units (tenant_id, type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE organization_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_units_rls ON organization_units
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER organization_units_updated_at
    BEFORE UPDATE ON organization_units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ADICIONAR organization_unit_id A ACTORS
-- ============================================================
-- Verificar se coluna já existe antes de adicionar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'actors' AND column_name = 'organization_unit_id'
    ) THEN
        ALTER TABLE actors
        ADD COLUMN organization_unit_id UUID
        REFERENCES organization_units(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_actors_organization_unit
            ON actors (tenant_id, organization_unit_id);
    END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE organization_units IS
    'Unidades organizacionais (matriz, filiais, centros de distribuição).';

COMMENT ON COLUMN organization_units.type IS
    'Tipo: MATRIX (matriz), BRANCH (filial), DC (centro de distribuição).';

COMMENT ON COLUMN organization_units.parent_id IS
    'ID da unidade pai. NULL para matriz.';

COMMENT ON COLUMN organization_units.metadata IS
    'Metadados: address, phone, manager_id.';

COMMENT ON COLUMN actors.organization_unit_id IS
    'SPRINT 51: Unidade organizacional do actor. NULL = não associado.';








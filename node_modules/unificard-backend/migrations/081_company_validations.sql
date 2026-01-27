-- ============================================================
-- UNIFICARD - MIGRATION 081
-- FASE 12: Validação Presencial com QR + Funcionário Auditável
-- ============================================================
--
-- OBJETIVO:
-- Registrar validações presenciais de empresas de forma
-- auditável, rastreável e antifraude.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - company_validations é um LOG IMUTÁVEL
-- - O BANCO NÃO altera status da empresa automaticamente
-- - A APLICAÇÃO:
--   • decide se a validação é permitida
--   • atualiza companies.status separadamente
-- - partner_employees representa agentes humanos auditáveis
-- - updated_at é controlado pela aplicação
--
-- DECISÕES IMPORTANTES:
-- - partner_id NÃO possui FK propositalmente
--   (pode representar parceiro externo ou não-modelado)
-- - company_status_before é histórico livre (snapshot)
-- - company_status_after é informativo, não normativo
--
-- DEPENDÊNCIAS:
-- - tenants
-- - companies
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- FUNCIONÁRIOS DE PARCEIROS VALIDADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS partner_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    partner_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),

    active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT partner_employees_tenant_partner_unique
        UNIQUE (tenant_id, partner_id, name)
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_partner_employees_tenant
    ON partner_employees (tenant_id);

CREATE INDEX IF NOT EXISTS idx_partner_employees_active
    ON partner_employees (tenant_id, active)
    WHERE active = true;


-- ============================================================
-- REGISTRO DE VALIDAÇÕES DE EMPRESAS
-- ============================================================
CREATE TABLE IF NOT EXISTS company_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,

    company_id UUID NOT NULL
        REFERENCES companies(company_id) ON DELETE CASCADE,

    company_status_before VARCHAR(50) NOT NULL,
    company_status_after VARCHAR(50) NOT NULL,

    validation_method VARCHAR(50) NOT NULL DEFAULT 'IN_PERSON_QR',

    validated_by_employee_id UUID
        REFERENCES partner_employees(id) ON DELETE SET NULL,

    validated_by_partner_id UUID,

    validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    geo_lat DECIMAL(10, 8),
    geo_lng DECIMAL(11, 8),

    device_fingerprint VARCHAR(255),
    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT company_validations_method_check
        CHECK (validation_method IN (
            'IN_PERSON_QR',
            'ADMIN_OVERRIDE',
            'DOCUMENT_UPLOAD'
        ))
);

-- Índices para auditoria e investigação
CREATE INDEX IF NOT EXISTS idx_company_validations_company
    ON company_validations (tenant_id, company_id);

CREATE INDEX IF NOT EXISTS idx_company_validations_employee
    ON company_validations (tenant_id, validated_by_employee_id);

CREATE INDEX IF NOT EXISTS idx_company_validations_partner
    ON company_validations (tenant_id, validated_by_partner_id);

CREATE INDEX IF NOT EXISTS idx_company_validations_date
    ON company_validations (tenant_id, validated_at DESC);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE partner_employees IS
    'Funcionários de parceiros autorizados a validar empresas presencialmente.';

COMMENT ON TABLE company_validations IS
    'Log auditável e imutável de validações presenciais de empresas. Não altera status automaticamente.';

COMMENT ON COLUMN company_validations.validation_method IS
    'Método de validação utilizado (presencial QR, override admin, documentos).';

COMMENT ON COLUMN company_validations.device_fingerprint IS
    'Hash do dispositivo usado na validação (anti-fraude).';

COMMENT ON COLUMN company_validations.metadata IS
    'Dados adicionais da validação (foto, documento, observações, etc).';














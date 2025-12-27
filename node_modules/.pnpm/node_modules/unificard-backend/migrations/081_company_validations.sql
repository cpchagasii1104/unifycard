-- Migration: 081_company_validations.sql
-- FASE 12: Validação Presencial com QR + Funcionário Auditável
-- Cria tabelas para rastrear validações presenciais de empresas

-- Tabela de funcionários parceiros (lojas/parceiros que podem validar)
CREATE TABLE IF NOT EXISTS partner_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    partner_id UUID NOT NULL, -- ID do parceiro/loja (pode ser UUID ou string)
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100), -- Ex: "atendente", "gerente", "validador"
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT partner_employees_tenant_partner_unique UNIQUE (tenant_id, partner_id, name)
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_partner_employees_tenant ON partner_employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partner_employees_partner ON partner_employees(tenant_id, partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_employees_active ON partner_employees(tenant_id, active) WHERE active = true;

-- Tabela de validações de empresas
CREATE TABLE IF NOT EXISTS company_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    company_status_before VARCHAR(50) NOT NULL, -- Status antes da validação (geralmente PROVISIONAL)
    company_status_after VARCHAR(50) NOT NULL DEFAULT 'VERIFIED', -- Status após validação
    validation_method VARCHAR(50) NOT NULL DEFAULT 'IN_PERSON_QR', -- Método de validação
    validated_by_employee_id UUID REFERENCES partner_employees(id) ON DELETE SET NULL,
    validated_by_partner_id UUID, -- ID do parceiro (pode ser diferente do employee.partner_id se necessário)
    validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    geo_lat DECIMAL(10, 8), -- Latitude (opcional, mas recomendado)
    geo_lng DECIMAL(11, 8), -- Longitude (opcional, mas recomendado)
    device_fingerprint VARCHAR(255), -- Hash do dispositivo (opcional, anti-fraude)
    metadata JSONB, -- Dados adicionais (ex: foto, documento, observações)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT company_validations_status_check CHECK (company_status_after IN ('VERIFIED', 'APPROVED')),
    CONSTRAINT company_validations_method_check CHECK (validation_method IN ('IN_PERSON_QR', 'ADMIN_OVERRIDE', 'DOCUMENT_UPLOAD'))
);

-- Índices para busca e auditoria
CREATE INDEX IF NOT EXISTS idx_company_validations_company ON company_validations(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_company_validations_employee ON company_validations(tenant_id, validated_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_company_validations_date ON company_validations(tenant_id, validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_validations_partner ON company_validations(tenant_id, validated_by_partner_id);

-- Comentários
COMMENT ON TABLE partner_employees IS 'Funcionários de parceiros/lojas autorizados a validar empresas presencialmente';
COMMENT ON TABLE company_validations IS 'Registro auditável de todas as validações presenciais de empresas';
COMMENT ON COLUMN company_validations.validation_method IS 'Método usado: IN_PERSON_QR (presencial com QR), ADMIN_OVERRIDE (override administrativo), DOCUMENT_UPLOAD (futuro)';
COMMENT ON COLUMN company_validations.device_fingerprint IS 'Hash do dispositivo usado para validação (anti-fraude)';
COMMENT ON COLUMN company_validations.metadata IS 'Dados adicionais da validação (foto, documento, observações, etc)';














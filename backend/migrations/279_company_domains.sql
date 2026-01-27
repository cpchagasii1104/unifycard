-- ============================================================
-- UNIFICARD - MIGRATION 279
-- Company Domains - Domínios de atuação das empresas
-- ============================================================

BEGIN;

-- ============================================================
-- TABELA company_domains
-- ============================================================
CREATE TABLE IF NOT EXISTS company_domains (
  company_domain_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL
    REFERENCES companies(company_id)
    ON DELETE CASCADE,
  domain VARCHAR(50) NOT NULL
    CHECK (domain IN ('market', 'services', 'events', 'real_estate', 'vehicles', 'jobs')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT company_domains_unique_company_domain
    UNIQUE (company_id, domain)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_company_domains_company
  ON company_domains (company_id);

CREATE INDEX IF NOT EXISTS idx_company_domains_domain
  ON company_domains (domain);

CREATE INDEX IF NOT EXISTS idx_company_domains_enabled
  ON company_domains (company_id, enabled)
  WHERE enabled = true;

-- ============================================================
-- MIGRAÇÃO: Setar 'market' como default para empresas existentes
-- ============================================================
INSERT INTO company_domains (company_id, domain, enabled, config)
SELECT 
  company_id,
  'market',
  true,
  '{}'::jsonb
FROM companies
WHERE NOT EXISTS (
  SELECT 1 
  FROM company_domains 
  WHERE company_domains.company_id = companies.company_id
)
ON CONFLICT (company_id, domain) DO NOTHING;

COMMIT;




-- ============================================================
-- FASE 3.3-A PJ (DECISION-0097 D3/D4 + SELO_DECISION_0097_ONTOLOGY_FULL_READ)
-- companies.company_status: prender no cercado de LIFECYCLE compat; bloquear ghosts de
-- verificação fiscal (VERIFIED/APPROVED) por CHECK.
-- ------------------------------------------------------------
-- REGRA-MÃE: verificação fiscal PJ = fiscal_identities.kyb_status (ÚNICO). company_status
-- NÃO verifica PJ — só sobrevive como lifecycle/projeção compat (DECISION-0097 D3/D4).
-- Conjunto lifecycle vivo (estado vivo + contrato CompanyStatus - deprecated): DRAFT,
-- PROVISIONAL, ACTIVE (default da coluna), SUSPENDED. VERIFIED/APPROVED = legado/morto.
-- NÃO toca: companies.status, is_verified, verifiedAt(inexistente), fiscal_identities,
-- kyb_status, Bank. Forward-only / transacional / idempotente.
-- ============================================================

BEGIN;

-- 1. Idempotência: remove CHECK anterior desta fatia se já existir (re-execução segura).
ALTER TABLE companies DROP CONSTRAINT IF EXISTS chk_companies_company_status_lifecycle;

-- 2. Política de dados legados (ambiente não-zero): normalizar ghosts de verificação fiscal
--    para lifecycle ACTIVE. NÃO finge KYB — verificação continua em fiscal_identities.kyb_status.
UPDATE companies
   SET company_status = 'ACTIVE'
 WHERE company_status IN ('VERIFIED', 'APPROVED');

-- 3. FAIL-CLOSED: valores desconhecidos fora do lifecycle permitido → ABORTA explicitamente.
--    Sem mapeamento silencioso para valores não previstos (DECISION-0097 disciplina).
DO $$
DECLARE
  bad_count  integer;
  bad_sample text;
BEGIN
  SELECT COUNT(*), MIN(company_status)
    INTO bad_count, bad_sample
    FROM companies
   WHERE company_status IS NOT NULL
     AND company_status NOT IN ('DRAFT', 'PROVISIONAL', 'ACTIVE', 'SUSPENDED');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'FASE-3.3-A FAIL-CLOSED: % linha(s) com company_status fora do lifecycle permitido (ex.: %). Resolver manualmente antes de aplicar — sem mapeamento silencioso.',
      bad_count, bad_sample;
  END IF;
END $$;

-- 4. CHECK lifecycle: company_status restrito ao conjunto compat (NULL permitido).
--    VERIFIED/APPROVED ficam BLOQUEADOS — verificação fiscal NÃO mora aqui.
ALTER TABLE companies
  ADD CONSTRAINT chk_companies_company_status_lifecycle
  CHECK (company_status IS NULL OR company_status IN ('DRAFT', 'PROVISIONAL', 'ACTIVE', 'SUSPENDED'));

COMMIT;

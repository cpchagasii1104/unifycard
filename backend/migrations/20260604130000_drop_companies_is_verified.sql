-- ============================================================
-- FASE 3.3-B2 PJ (DECISION-0097 D3/D4 + DECISION-0093 §4.3)
-- Drop da coluna vestigial companies.is_verified.
-- ------------------------------------------------------------
-- A Fase 3.3-B1 removeu isVerified/is_verified de código/payload/tipos no domínio companies
-- (a coluna ficou órfã). Verificação fiscal PJ = fiscal_identities.kyb_status (ÚNICA).
-- is_verified NÃO verifica PJ e NÃO vira alias de kyb_status (DECISION-0093 §4.3). Sem deps de
-- schema (zero índice/constraint/view/trigger). NÃO toca companies.status, company_status (CHECK
-- 3.3-A intacto), fiscal_identities, kyb_status, Bank. Forward-only / transacional / idempotente.
-- ============================================================

BEGIN;

ALTER TABLE companies DROP COLUMN IF EXISTS is_verified;

COMMIT;

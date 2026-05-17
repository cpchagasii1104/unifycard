-- ============================================================
-- DECISION-0042 — MEMBERSHIP SSOT: company_users expandido
-- ============================================================
-- Frente: MEMBERSHIP (PASSO 2.c do plano 2026-05-16)
-- Contexto: company_members tabela ausente em runtime; authorization.service:369,
--           bank-balance-by-cpf:151 e company-members.* (repo/service/routes)
--           apontavam para tabela inexistente. company_users (9 rows vivas)
--           absorve role-based membership como SSOT único.
--
-- Mudancas:
--   1. CHECK constraint em `role` (relaxado: aceitar valores membership)
--      — role JÁ existe (text, default 'member'); 9 rows atuais = 'owner'
--   2. Adicionar `member_status` TEXT NOT NULL DEFAULT 'active'
--      — substrato para fluxo invited/active/suspended sem perder is_active
--   3. CHECK em member_status
--   4. Backfill member_status a partir de is_active
--
-- Reversibilidade: ALTA (drop colunas + check constraints)
-- Blast: BAIXO (apenas company_users, tabela viva)
-- ============================================================

BEGIN;

-- 1) Adicionar member_status (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_users'
      AND column_name = 'member_status'
  ) THEN
    ALTER TABLE company_users
      ADD COLUMN member_status TEXT NOT NULL DEFAULT 'active';
  END IF;
END$$;

-- 2) Backfill member_status a partir de is_active
UPDATE company_users
SET member_status = CASE
  WHEN is_active = true THEN 'active'
  ELSE 'suspended'
END
WHERE member_status = 'active' AND is_active = false;

-- 3) CHECK constraint em role (aceita conjunto canonico membership)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_company_users_role_valid'
      AND conrelid = 'public.company_users'::regclass
  ) THEN
    ALTER TABLE company_users
      ADD CONSTRAINT chk_company_users_role_valid
      CHECK (role IN ('owner', 'admin', 'staff', 'contractor', 'member'));
  END IF;
END$$;

-- 4) CHECK constraint em member_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_company_users_member_status_valid'
      AND conrelid = 'public.company_users'::regclass
  ) THEN
    ALTER TABLE company_users
      ADD CONSTRAINT chk_company_users_member_status_valid
      CHECK (member_status IN ('active', 'invited', 'suspended'));
  END IF;
END$$;

-- 5) Indice composto (company_id, role, member_status) para queries de listMembers
CREATE INDEX IF NOT EXISTS idx_company_users_company_role_status
  ON company_users(company_id, role, member_status);

COMMIT;

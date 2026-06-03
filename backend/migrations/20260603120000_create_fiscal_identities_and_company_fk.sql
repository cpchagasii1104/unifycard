-- ============================================================
-- F1 PJ FISCAL IDENTITY (DECISION-0085 / D2-tecnica) — casa fiscal PJ canonica + projecao
-- ============================================================
-- Cria `fiscal_identities` (GLOBAL, sem tenant_id): identidade fiscal canonica da empresa/CNPJ,
-- fonte da verdade do CNPJ. CNPJ VARCHAR(14) NOT NULL + UNIQUE global + CHECK 14 digitos.
-- kyb_status enxuto (pending/approved/rejected/suspended/closed). Auditoria por *_actor_id
-- (FK actors(id) — todas as FKs do schema referenciam actors(id); FK bypassa RLS).
-- NAO inclui: tenant_id, kyb_level, metadata, legal_name, document_number, company_id.
-- Adiciona `companies.fiscal_identity_id` (FK -> fiscal_identities; nullable p/ compat de migracao,
-- writer garante preenchido em PJ nova) + indice. `companies.cnpj` passa a ser PROJECAO de
-- `fiscal_identities.cnpj` (fonte->projecao, unidirecional — DECISION-0085 §4.7).
-- Forward-only / idempotente. NAO toca identities PF, Bank, schema fora do escopo. DV = borda.
-- ============================================================

BEGIN;

-- 1) Tabela fiscal_identities (GLOBAL — sem tenant_id).
CREATE TABLE IF NOT EXISTS fiscal_identities (
  fiscal_identity_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                 VARCHAR(14) NOT NULL,
  kyb_status           TEXT NOT NULL DEFAULT 'pending',
  created_by_actor_id  UUID NULL,
  reviewed_by_actor_id UUID NULL,
  reviewed_at          TIMESTAMPTZ NULL,
  decision_reason      TEXT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Constraints nomeadas (idempotentes).
DO $$
BEGIN
  -- UNIQUE GLOBAL do CNPJ (precedente vivo: global_users.cpf UNIQUE global). Trava de atomicidade
  -- do nascimento fiscal-first: CNPJ duplicado explode aqui dentro da tx -> rollback total.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fiscal_identities_cnpj') THEN
    ALTER TABLE fiscal_identities ADD CONSTRAINT uq_fiscal_identities_cnpj UNIQUE (cnpj);
  END IF;

  -- CHECK exatamente 14 digitos (DV e validado na BORDA — DECISION-0085 §4.3, nao no banco).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fiscal_identities_cnpj_14') THEN
    ALTER TABLE fiscal_identities ADD CONSTRAINT chk_fiscal_identities_cnpj_14 CHECK (cnpj ~ '^[0-9]{14}$');
  END IF;

  -- CHECK lifecycle enxuto (DECISION-0085 §4.8).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fiscal_identities_kyb_status') THEN
    ALTER TABLE fiscal_identities ADD CONSTRAINT chk_fiscal_identities_kyb_status
      CHECK (kyb_status IN ('pending','approved','rejected','suspended','closed'));
  END IF;

  -- CHECK auditoria minima quando approved (DECISION-0085 §3 / §5).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fiscal_identities_approved_audit') THEN
    ALTER TABLE fiscal_identities ADD CONSTRAINT chk_fiscal_identities_approved_audit
      CHECK (kyb_status <> 'approved' OR (reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL));
  END IF;

  -- FK auditoria -> actors(id). Auditoria nao bloqueia delete de actor (SET NULL).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fiscal_identities_created_by_actor') THEN
    ALTER TABLE fiscal_identities ADD CONSTRAINT fk_fiscal_identities_created_by_actor
      FOREIGN KEY (created_by_actor_id) REFERENCES actors(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fiscal_identities_reviewed_by_actor') THEN
    ALTER TABLE fiscal_identities ADD CONSTRAINT fk_fiscal_identities_reviewed_by_actor
      FOREIGN KEY (reviewed_by_actor_id) REFERENCES actors(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON TABLE fiscal_identities IS
  'DECISION-0085 (D2-tecnica): casa fiscal PJ canonica e GLOBAL (sem tenant). Fonte da verdade do CNPJ. '
  'Escopo PJ/CNPJ. NAO substitui identities (PF). NAO e actor/authority. kyb_status enxuto; KYB approve = F2.';
COMMENT ON COLUMN fiscal_identities.cnpj IS
  'CNPJ canonico (14 digitos, UNIQUE global). Digito verificador validado na borda (DECISION-0085 §4.3).';

-- 3) companies.fiscal_identity_id (vinculo/projecao). Nullable p/ compat de migracao em ambientes
--    nao-zero; o writer (createCompany fiscal-first) garante preenchido em toda PJ nova.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_identity_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_companies_fiscal_identity') THEN
    ALTER TABLE companies ADD CONSTRAINT fk_companies_fiscal_identity
      FOREIGN KEY (fiscal_identity_id) REFERENCES fiscal_identities(fiscal_identity_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_fiscal_identity_id ON companies (fiscal_identity_id);

COMMENT ON COLUMN companies.fiscal_identity_id IS
  'DECISION-0085 §4.5 (Opcao 2): FK para a casa fiscal PJ canonica (fiscal_identities), presente desde o '
  'nascimento pending. Direcao unica companies->fiscal (fiscal NAO carrega company_id).';
COMMENT ON COLUMN companies.cnpj IS
  'DECISION-0085 §4.7: PROJECAO operacional de fiscal_identities.cnpj (fonte->projecao, unidirecional). '
  'NAO e fonte. createCompany reserva o CNPJ em fiscal_identities (fiscal-first) e projeta aqui.';

-- VERIFICACAO POS (fail-closed).
DO $$
BEGIN
  IF to_regclass('public.fiscal_identities') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fiscal_identities nao foi criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fiscal_identities_cnpj') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uq_fiscal_identities_cnpj ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fiscal_identities_cnpj_14') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_fiscal_identities_cnpj_14 ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='fiscal_identity_id') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: companies.fiscal_identity_id nao foi criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_companies_fiscal_identity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fk_companies_fiscal_identity ausente';
  END IF;
END $$;

COMMIT;

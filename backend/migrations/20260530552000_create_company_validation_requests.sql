-- ============================================================
-- FRENTE B (Parte 1) — company_validation_requests
-- ============================================================
-- Sessão: 2026-05-25 (após Fatia 1 / A1 / A2)
--
-- Contexto:
--   `company_validations` (tabela existente) é CARIMBO IMUTÁVEL por design (FASE 12) — não
--   suporta workflow (sem `status`, sem `reviewer_id`, sem `submitted_at`). O Fatia A2 fechou
--   o vetor de gravação de audit ad-hoc em `actors.metadata.validation`, mas não dá fila
--   queryável.
--
--   Frente B do raio-x (`docs/04_audit/2026-05-25-raio-x-junta-universal.md`, seção 5b):
--   "Fluxo de submissão→análise→decisão para formalização". Convergência sobre padrão
--   submit→analyze→approve que já existe em orders/disputes/subscriptions — disputes é o
--   mais simples e foi escolhido como referência (`modules/disputes/financial-dispute-
--   repository.ts`).
--
--   Esta migration cria a tabela de workflow. NÃO toca `company_validations` (carimbo).
--   NÃO toca `companies.company_status` (ghost `APPROVED` permanece sem semântica).
--   NÃO toca KYC humano (`identities`) — frente paralela só se houver pressão material.
--
-- Identidade canônica (§8 03_IDENTITY_CANONICA):
--   - `tenant_id` obrigatório (RLS + FORCE)
--   - `submitted_by_user_id` / `reviewed_by_user_id` referenciam `users(id)` (PK).
--     `req.user.id = users.id` (alias em auth.plugin.ts:104 para `userId`, que vem de
--     `payload.userId ?? payload.sub`; `auth.service.ts` payload usa `userId: row.id`).
--     CHECK vivo `users_id_user_id_equal` (id = user_id) confirma equivalência.
--
-- Reversibilidade: ALTA (DROP TABLE)
-- Blast: BAIXO (tabela nova, zero callers prévios)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS company_validation_requests (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID         NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  company_id            UUID         NOT NULL REFERENCES companies (company_id) ON DELETE CASCADE,
  submitted_by_user_id  UUID         NOT NULL REFERENCES users (id),
  submitted_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  submission_notes      TEXT,
  status                VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by_user_id   UUID         REFERENCES users (id),
  decision_reason       TEXT,
  metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índices para queries do service (queue por tenant+status, lookup por company)
CREATE INDEX IF NOT EXISTS idx_company_validation_requests_tenant_status
  ON company_validation_requests (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_company_validation_requests_company
  ON company_validation_requests (tenant_id, company_id);

-- Índice parcial único: garante no máximo 1 request pending por company
-- (PostgreSQL exige índice separado, não suporta CONSTRAINT ... UNIQUE ... WHERE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_validation_requests_pending
  ON company_validation_requests (company_id)
  WHERE status = 'pending';

-- RLS: tenant-scoped, padrão das tabelas vizinhas (bank_limit_change_requests, etc.)
ALTER TABLE company_validation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_validation_requests FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON company_validation_requests
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMENT ON TABLE company_validation_requests IS
  'Fila estruturada de pedidos de validação de empresa (submit→review→approve/reject). Complementa company_validations (carimbo imutável) com workflow queryável. Frente B do raio-x 2026-05-25.';

COMMIT;

-- ============================================================
-- FRENTE C Fatia C2 — identity_validation_requests
-- ============================================================
-- Sessão: 2026-05-25 (após Fatia C1 que faz /auth/register criar
--   identity pending/none — descontinuidade cadastro↔gate eliminada).
--
-- Contexto:
--   `identities` (tabela existente) tem ESTADO (kyc_status/kyc_level)
--   mas ZERO campos de workflow (sem submitted_at, reviewed_at, reviewer,
--   audit). Análogo exato ao `company_validations` (carimbo imutável)
--   antes da Frente B — só estado, sem fluxo.
--
--   Esta migration cria a tabela de workflow submit→review→approve para
--   KYC humano, espelhando o padrão da Frente B (company_validation_requests)
--   e dos vizinhos (orders/disputes/subscriptions).
--
-- Decisão de escopo de tenant (Frente C Etapa 1 Passo 1):
--   identities é GLOBAL (PK só global_user_id; sem tenant_id; sem RLS).
--   kyc_status é atributo da PESSOA, não da pessoa-no-tenant — confirmado
--   pelo gate authority-decision.service que faz LEFT JOIN tenant-free
--   em identities. Logo:
--     - identity_validation_requests é GLOBAL (sem tenant_id, sem RLS).
--     - submitted_by_user_id / reviewed_by_user_id (FKs users) carregam
--       o tenant do operador APENAS para auditoria.
--     - Workflow: 1 request por pessoa (não por pessoa-tenant).
--   Nota institucional: se no futuro segmentar KYC por tenant (compliance
--   team de tenant A não ver pessoas de B), é decisão arquitetural que
--   afeta TAMBÉM identities — não fatia isolada deste workflow.
--
-- Convergência das 3 camadas (decisão Clayton, Frente C):
--   1. cadastro CRIA EXISTÊNCIA  (identity nasce pending/none — Fatia C1)
--   2. KYC      APROVA CAPACIDADE (workflow desta migration aprova/rejeita)
--   3. authority LIBERA EXECUÇÃO  (gate em authority-decision permanece
--                                  intocado — pending bloqueia, approved
--                                  passa, rejected bloqueia)
--
-- Reversibilidade: ALTA (DROP TABLE)
-- Blast: BAIXO (tabela nova, zero callers prévios)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS identity_validation_requests (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id        UUID         NOT NULL REFERENCES identities (global_user_id) ON DELETE CASCADE,
  submitted_by_user_id  UUID         NOT NULL REFERENCES users (id),
  submitted_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  submission_notes      TEXT,
  status                VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by_user_id   UUID         REFERENCES users (id),
  decision_reason       TEXT,
  target_kyc_level      VARCHAR(20)  NOT NULL DEFAULT 'basic'
                        CHECK (target_kyc_level IN ('basic', 'complete')),
  metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índices para queries do service (queue por status, lookup por pessoa)
CREATE INDEX IF NOT EXISTS idx_identity_validation_requests_status
  ON identity_validation_requests (status);

CREATE INDEX IF NOT EXISTS idx_identity_validation_requests_global_user
  ON identity_validation_requests (global_user_id);

-- Índice parcial único: garante no máximo 1 request pending por pessoa.
-- (PostgreSQL exige índice separado, não suporta CONSTRAINT ... UNIQUE ... WHERE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_validation_requests_pending
  ON identity_validation_requests (global_user_id)
  WHERE status = 'pending';

-- SEM RLS — consistente com identities (também global, sem RLS).
-- Acesso controlado por camada HTTP via requireRole(['admin']).

COMMENT ON TABLE identity_validation_requests IS
  'Fila estruturada de validação de identidade (submit→review→approve/rejected). Global como identities (kyc_status é atributo da pessoa, não da pessoa-no-tenant). Frente C Fatia C2 (2026-05-25).';

COMMIT;

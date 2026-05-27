-- ============================================================
-- Financial Approval Substrate
-- DECISION-0054 / F-APROVACAO-FINANCEIRA-SUBSTRATE (2026-05-27)
--
-- Materializa o substrato canônico de aprovação financeira definido em
-- CORE_APROVACAO_FINANCEIRA_CANONICO.md §7.2, que existia apenas como norma
-- sem banco desde a fundação do projeto.
--
-- Escopo desta migration:
--   - approval_requests  (solicitações de aprovação antes de execução financeira)
--   - approval_votes     (votos de aprovação — append-only, um por user por request)
--
-- Fora do escopo (frentes futuras):
--   - bank_account_policies (thresholds/limites — DECISION posterior)
--   - approval service / rotas públicas
--   - integração com recovery/reversal (DECISION-0053 C2 satisfeito por esta migration)
--
-- operation_type inclui 'actor_wallet_recovery' (DECISION-0053 D1 —
-- recovery pós-D-money não é 'manual_refund'; são domínios distintos).
--
-- Reversibilidade: DROP TABLE (sem dados, risco baixo).
-- Blast: BAIXO — nenhum código existente depende destas tabelas.
-- ============================================================

BEGIN;

-- ============================================================
-- approval_requests
-- ============================================================
CREATE TABLE approval_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL,

  -- Partes (auditáveis)
  requested_by_user_id   UUID NOT NULL REFERENCES users(id),
  acting_for_actor_id    UUID NOT NULL REFERENCES actors(id),
  acting_for_account_id  UUID NOT NULL REFERENCES bank_accounts(id),

  -- Operação sendo aprovada
  operation_type         VARCHAR(50) NOT NULL,
  operation_data         JSONB       NOT NULL DEFAULT '{}',

  -- Configuração de aprovação
  required_approvals     INTEGER     NOT NULL DEFAULT 1,
  approval_type          VARCHAR(20) NOT NULL DEFAULT 'sequential',

  -- Estado
  status                 VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at             TIMESTAMPTZ NOT NULL,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Invariantes de domínio
  CONSTRAINT chk_approval_request_operation_type CHECK (operation_type IN (
    'transfer',
    'payment',
    'manual_refund',
    'actor_wallet_recovery',   -- DECISION-0053: recovery pós-D-money (≠ manual_refund)
    'add_beneficiary',
    'remove_beneficiary',
    'change_limit',
    'change_policy'
  )),
  CONSTRAINT chk_approval_request_approval_type CHECK (
    approval_type IN ('sequential', 'parallel')
  ),
  CONSTRAINT chk_approval_request_status CHECK (
    status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')
  ),
  CONSTRAINT chk_approval_request_required_approvals CHECK (
    required_approvals >= 1
  )
);

COMMENT ON TABLE approval_requests IS
  'Solicitações de aprovação financeira. Gate obrigatório ANTES de execução financeira. '
  'CORE_APROVACAO_FINANCEIRA_CANONICO §7.2. DECISION-0054 (2026-05-27). '
  'Sem approval approved: nenhuma operação crítica é executada. '
  'operation_type actor_wallet_recovery = recovery pós-D-money (DECISION-0053).';

COMMENT ON COLUMN approval_requests.operation_data IS
  'Snapshot da operação no momento da solicitação. Imutável após criação. '
  'Inclui campos como amount_cents, from_account_id, to_account_id, policy_snapshot.';

COMMENT ON COLUMN approval_requests.expires_at IS
  'Deadline de coleta de aprovações. Após este timestamp: status=expired, '
  'operação não pode mais ser executada. Nova solicitação necessária.';

-- Índices operacionais
CREATE INDEX idx_approval_requests_tenant_status
  ON approval_requests(tenant_id, status);

CREATE INDEX idx_approval_requests_requested_by
  ON approval_requests(requested_by_user_id);

CREATE INDEX idx_approval_requests_acting_for_actor
  ON approval_requests(acting_for_actor_id);

CREATE INDEX idx_approval_requests_acting_for_account
  ON approval_requests(acting_for_account_id);

-- ============================================================
-- approval_votes
-- ============================================================
CREATE TABLE approval_votes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id   UUID        NOT NULL REFERENCES approval_requests(id),
  voted_by_user_id      UUID        NOT NULL REFERENCES users(id),
  vote_type             VARCHAR(20) NOT NULL,
  reason                TEXT,
  permission_snapshot   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Um voto por usuário por solicitação
  CONSTRAINT uq_approval_vote_per_user
    UNIQUE (approval_request_id, voted_by_user_id),

  CONSTRAINT chk_approval_vote_type CHECK (
    vote_type IN ('approve', 'reject')
  )
);

COMMENT ON TABLE approval_votes IS
  'Votos em approval_requests. Append-only (sem UPDATE/DELETE). '
  'Um voto por usuário por solicitação (constraint uq_approval_vote_per_user). '
  'CORE_APROVACAO_FINANCEIRA_CANONICO §7.2. DECISION-0054 (2026-05-27). '
  'Aprovação financeira exige financial:approve_recovery para operation_type=actor_wallet_recovery.';

COMMENT ON COLUMN approval_votes.permission_snapshot IS
  'Snapshot das permissões do aprovador no momento do voto. '
  'Auditável mesmo que permissões mudem depois.';

-- Índices operacionais
CREATE INDEX idx_approval_votes_request_id
  ON approval_votes(approval_request_id);

CREATE INDEX idx_approval_votes_voted_by
  ON approval_votes(voted_by_user_id);

COMMIT;

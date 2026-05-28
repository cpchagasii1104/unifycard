-- ============================================================
-- Actor Wallet Payout Requests Substrate
-- DECISION-0058 / F-ACTOR-WALLET-PAYOUT-WIRING F1 (2026-05-28)
--
-- Materializa o substrato de solicitação de saque voluntário de actor_wallet:
--   - actor_wallet_payout_requests  (solicitação de saque — uma por pedido)
--
-- Também:
--   - Estende approval_requests.operation_type CHECK com 'actor_wallet_payout'
--   - Seed do concept 'actor-wallet-payout' em domínio 'financeiro-payout'
--
-- IMPORTANTE — escopo estrito desta migration:
--   Schema + tipos + seed. Zero movimento financeiro.
--   Zero serviço de execução. Zero worker. Zero rota pública.
--
-- Fora do escopo (frentes F2–F4):
--   - Serviço de criação de pedido (F2)
--   - Execução atômica drain+payout (F3: SELECT FOR UPDATE + debit + transfer)
--   - Gateway externo PIX/TED (F4 — não autorizado)
--   - Rota pública
--
-- Pré-requisitos satisfeitos:
--   - DECISION-0058 registrada (commit beafd350)
--   - approval_requests/approval_votes (20260530569000)
--   - actor_wallet account_type (20260530557000)
--   - bank_transactions tabela (0030_payment_intents.sql e derivadas)
--   - concepts + trigger de governança (0069, 0075)
--   - domínio 'financeiro-payout' já existe (20260530507000)
--
-- Reversibilidade: DROP TABLE CASCADE + restore CHECK (sem dados financeiros — risco baixo).
-- Blast: BAIXO — additive only; sem row existente impactada.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Estender approval_requests.operation_type CHECK
--    Adiciona 'actor_wallet_payout' ao conjunto canônico.
--    DECISION-0054 substrate + DECISION-0058 D4 (gate obrigatório).
-- ============================================================
ALTER TABLE approval_requests
  DROP CONSTRAINT IF EXISTS chk_approval_request_operation_type;

ALTER TABLE approval_requests
  ADD CONSTRAINT chk_approval_request_operation_type CHECK (operation_type IN (
    'transfer',
    'payment',
    'manual_refund',
    'actor_wallet_recovery',  -- DECISION-0053: recovery pós-D-money
    'actor_wallet_payout',    -- DECISION-0058: saque voluntário de actor_wallet
    'add_beneficiary',
    'remove_beneficiary',
    'change_limit',
    'change_policy'
  ));

-- ============================================================
-- 2. Seed concept 'actor-wallet-payout'
--    Domínio: financeiro-payout (já existe desde 20260530507000)
--    Usado como concept_id em bank_transactions de débito de saque.
-- ============================================================
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain)
  VALUES ('actor-wallet-payout', 'financeiro-payout')
ON CONFLICT (domain, slug) DO NOTHING;

-- ============================================================
-- 3. actor_wallet_payout_requests
--    Solicitação de saque voluntário de actor_wallet.
--    Lifecycle: pending_approval → approved → processing → completed.
--    Execução financeira (F3) requer approval_request aprovado.
--    DECISION-0058 D1–D5.
-- ============================================================
CREATE TABLE actor_wallet_payout_requests (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID NOT NULL,

  -- Actor e conta de origem (imutáveis após criação)
  actor_id                   UUID NOT NULL REFERENCES actors(id)        ON DELETE RESTRICT,
  actor_wallet_account_id    UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,

  -- Aprovação (gate obrigatório — DECISION-0054 + DECISION-0058 D4)
  approval_request_id        UUID NULL REFERENCES approval_requests(id) ON DELETE RESTRICT,

  -- Montante
  requested_amount_cents     BIGINT NOT NULL,  -- valor solicitado pelo actor
  approved_amount_cents      BIGINT NULL,       -- fixado pelo aprovador (pode ser <= requested)
  executed_amount_cents      BIGINT NULL,       -- real após drain de obrigações (F3 D2)

  -- Destino (DECISION-0058 D3: MVP = 'internal_settlement' apenas)
  destination_type           TEXT NOT NULL DEFAULT 'internal_settlement',
  destination_key            TEXT,               -- chave PIX / dados TED (fase 2 — não autorizado)

  -- Rastreabilidade pós-execução (preenchido em F3)
  settlement_transaction_id  UUID NULL REFERENCES bank_transactions(id) ON DELETE RESTRICT,

  -- Idempotência (prevenção de double-submit)
  idempotency_key            TEXT NULL,

  -- Lifecycle
  status                     TEXT NOT NULL DEFAULT 'pending_approval',
  failed_reason              TEXT,

  -- Auditoria
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints de integridade
  CONSTRAINT chk_payout_request_amount_positive
    CHECK (requested_amount_cents > 0),
  CONSTRAINT chk_payout_request_approved_positive
    CHECK (approved_amount_cents IS NULL OR approved_amount_cents > 0),
  CONSTRAINT chk_payout_request_executed_positive
    CHECK (executed_amount_cents IS NULL OR executed_amount_cents > 0),
  CONSTRAINT chk_payout_request_status CHECK (status IN (
    'pending_approval',  -- criado, aguardando gate de aprovação
    'approved',          -- aprovado pelo gate; pronto para execução financeira
    'processing',        -- execução em andamento (lock tomado)
    'completed',         -- saque executado; settlement_transaction_id preenchido
    'failed',            -- falha durante execução após approved
    'cancelled',         -- cancelado antes da execução
    'rejected'           -- reprovado no vote de aprovação
  )),
  CONSTRAINT chk_payout_request_destination_type CHECK (
    -- MVP: apenas settlement interno (DECISION-0058 D3).
    -- PIX/TED: frente posterior — NÃO habilitar sem DECISION explícita.
    destination_type IN ('internal_settlement')
  ),
  CONSTRAINT chk_payout_request_idempotency_format
    CHECK (idempotency_key IS NULL OR length(idempotency_key) > 0)
);

-- Índice por tenant + actor (listagem de pedidos do actor)
CREATE INDEX idx_payout_request_tenant_actor
  ON actor_wallet_payout_requests (tenant_id, actor_id);

-- Índice por tenant + status (worker / dashboard)
CREATE INDEX idx_payout_request_tenant_status
  ON actor_wallet_payout_requests (tenant_id, status);

-- Índice por conta de origem (reconciliação)
CREATE INDEX idx_payout_request_account
  ON actor_wallet_payout_requests (actor_wallet_account_id);

-- Unique por idempotency_key (prevenção de double-submit)
CREATE UNIQUE INDEX uq_payout_request_idempotency
  ON actor_wallet_payout_requests (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE actor_wallet_payout_requests IS
  'Solicitações de saque voluntário de actor_wallet (DECISION-0058, 2026-05-28). '
  'Gate obrigatório: approval_request approved antes de qualquer débito. '
  'Execução (F3): SELECT FOR UPDATE em obrigações + drain + payout em transação única. '
  'MVP: destination_type = internal_settlement apenas. PIX/TED = frente posterior. '
  'NÃO reutiliza payout_requests (trilho exclusivo seller_available → seller_payout).';

COMMENT ON COLUMN actor_wallet_payout_requests.executed_amount_cents IS
  'Valor real executado após drain síncrono de actor_wallet_recovery_obligations (DECISION-0058 D2). '
  'Pode ser menor que approved_amount_cents se novas obrigações surgiram entre aprovação e execução. '
  'Preenchido apenas em F3 (execução financeira). NULL em F1/F2.';

COMMENT ON COLUMN actor_wallet_payout_requests.settlement_transaction_id IS
  'Referência à bank_transactions do débito de saque (SSOT). '
  'Preenchido em F3 após COMMIT. NULL indica pedido não executado. '
  'NUNCA atualizar sem o débito correspondente em bank_ledger.';

COMMENT ON COLUMN actor_wallet_payout_requests.destination_type IS
  'MVP: internal_settlement (liquidação interna via bankTransactionService.transfer). '
  'DECISION-0058 D3: PIX/TED são fase 2 — não adicionar ao CHECK sem nova DECISION.';

COMMIT;

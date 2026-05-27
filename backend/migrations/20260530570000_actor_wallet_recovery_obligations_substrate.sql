-- ============================================================
-- Actor Wallet Recovery Obligations Substrate
-- DECISION-0053 C6 / F-ACTOR-WALLET-RECOVERY-SUBSTRATE (2026-05-27)
--
-- Materializa o substrato persistente de recovery pós-D-money:
--   - actor_wallet_recovery_obligations       (obrigação principal — uma por caso)
--   - actor_wallet_recovery_obligation_entries (parcelas de recovery — append-only)
--
-- Inclui seed do concept 'actor-wallet-recovery' em domínio 'financeiro-reversal'.
--
-- Fora do escopo desta migration:
--   - Serviço de débito de actor_wallet (DECISION-0055 C3 — frente separada)
--   - Resolver de creditor_account_id (frente C4 separada)
--   - Income withholding gate (DT-RECOVERY-PAYOUT-GATE — frente separada)
--   - Fluxo de finalização pós-D-money (DT-DMONEY-FINALIZATION-FLOW-MISSING)
--   - Nenhuma movimentação financeira
--
-- Pré-requisitos satisfeitos:
--   - C1: DECISION-0053 aprovada (ce9c36cf)
--   - C2: approval_requests/approval_votes (20260530569000)
--
-- Reversibilidade: DROP TABLE CASCADE (sem dados financeiros — risco baixo).
-- Blast: BAIXO — nenhum código existente depende destas tabelas.
-- ============================================================

BEGIN;

-- Libera trigger de governança de concepts para esta transação (trg_concept_governance / 0075)
SELECT set_config('app.concept_governance', 'true', true);

-- ============================================================
-- actor_wallet_recovery_obligations
-- Tabela principal — uma obrigação por caso (unique index total sem WHERE)
-- DECISION-0053 §5: reabrir caso terminal exige fluxo administrativo auditado.
-- ============================================================
CREATE TABLE actor_wallet_recovery_obligations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,

  -- Partes causais (imutáveis após criação)
  debtor_actor_id         UUID NOT NULL REFERENCES actors(id)        ON DELETE RESTRICT,
  debtor_account_id       UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  creditor_actor_id       UUID NOT NULL REFERENCES actors(id)        ON DELETE RESTRICT,
  creditor_account_id     UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,

  -- Origem causal (imutável após criação)
  original_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE RESTRICT,
  payment_intent_id       UUID NOT NULL REFERENCES payment_intents(id)   ON DELETE RESTRICT,
  reversal_id             UUID     NULL REFERENCES reversals(id)          ON DELETE RESTRICT,

  -- Montante e justificativa (imutáveis após criação)
  amount_cents            BIGINT NOT NULL,
  reason                  TEXT   NOT NULL,

  -- Campos operacionais (projeções — atualizados via serviço canônico)
  status                  VARCHAR(40) NOT NULL DEFAULT 'pending_approval',
  recovered_amount_cents  BIGINT      NOT NULL DEFAULT 0,
  approval_request_id     UUID     NULL REFERENCES approval_requests(id) ON DELETE RESTRICT,

  -- Auditoria
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints de integridade
  CONSTRAINT chk_recovery_obligation_amount_positive
    CHECK (amount_cents > 0),
  CONSTRAINT chk_recovery_obligation_recovered_bounds
    CHECK (recovered_amount_cents >= 0 AND recovered_amount_cents <= amount_cents),
  CONSTRAINT chk_recovery_obligation_status
    CHECK (status IN (
      'pending_approval',
      'approved',
      'partially_recovered',
      'recovered',
      'cancelled',
      'failed'
    ))
);

-- Unique total sem filtro WHERE — garante uma obrigação por caso mesmo após status terminal.
-- DECISION-0053 §5: sem partial unique, status terminal não impede duplicação automática.
CREATE UNIQUE INDEX uq_recovery_obligation_per_case
  ON actor_wallet_recovery_obligations (tenant_id, payment_intent_id, original_transaction_id, debtor_actor_id);

-- Índices operacionais
CREATE INDEX idx_recovery_obligation_tenant  ON actor_wallet_recovery_obligations (tenant_id);
CREATE INDEX idx_recovery_obligation_debtor  ON actor_wallet_recovery_obligations (tenant_id, debtor_actor_id);
CREATE INDEX idx_recovery_obligation_status  ON actor_wallet_recovery_obligations (tenant_id, status);
CREATE INDEX idx_recovery_obligation_payment ON actor_wallet_recovery_obligations (tenant_id, payment_intent_id);

COMMENT ON TABLE actor_wallet_recovery_obligations IS
  'Obrigações de recovery pós-D-money (DECISION-0053 + DECISION-0055, 2026-05-27). '
  'Uma por caso (unique index total sem WHERE). '
  'Criada quando payment_intent.payment_status=released_to_actor_wallet e recovery é exigido. '
  'Execução financeira requer: approval_request approved + clearance financial_recovery. '
  'Reversal tradicional bloqueado para este caso — caminho próprio de recovery exclusivo.';

COMMENT ON COLUMN actor_wallet_recovery_obligations.recovered_amount_cents IS
  'Projeção do total recuperado. Deve reconciliar com SUM(entries.amount_cents). '
  'Atualizado apenas via serviço canônico (debitActorWalletForRecovery — DECISION-0055 C3). '
  'Invariante: recovered_amount_cents <= amount_cents (CHECK enforced).';

COMMENT ON COLUMN actor_wallet_recovery_obligations.status IS
  'Lifecycle: pending_approval → approved → (partially_recovered)* → recovered (terminal). '
  'Alternativo: pending_approval → cancelled (terminal). Ou: approved → failed (terminal). '
  'Terminal não reabre automaticamente — unique index total impede nova obrigação pelo mesmo caso.';

-- ============================================================
-- actor_wallet_recovery_obligation_entries
-- Tabela filha — trilha de parcelas efetivamente recuperadas (append-only)
-- Cada row representa uma transferência real actor_wallet → creditor_account.
-- ============================================================
CREATE TABLE actor_wallet_recovery_obligation_entries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,

  obligation_id           UUID NOT NULL REFERENCES actor_wallet_recovery_obligations(id) ON DELETE RESTRICT,
  recovery_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE RESTRICT,

  amount_cents            BIGINT NOT NULL,

  -- Append-only: sem updated_at por design
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_recovery_entry_amount_positive
    CHECK (amount_cents > 0)
);

CREATE INDEX idx_recovery_entry_obligation   ON actor_wallet_recovery_obligation_entries (obligation_id);
CREATE INDEX idx_recovery_entry_tenant       ON actor_wallet_recovery_obligation_entries (tenant_id);
CREATE INDEX idx_recovery_entry_transaction  ON actor_wallet_recovery_obligation_entries (recovery_transaction_id);

COMMENT ON TABLE actor_wallet_recovery_obligation_entries IS
  'Parcelas de recovery executadas — append-only por design (DECISION-0053, 2026-05-27). '
  'Cada row = uma transferência real actor_wallet → creditor_account via bank_transactions. '
  'SUM(amount_cents) por obligation_id deve = obligations.recovered_amount_cents. '
  'Referência idempotente: recovery_transaction_id vincula à bank_transactions.';

-- ============================================================
-- Concept seed: actor-wallet-recovery
-- Domínio: financeiro-reversal (já existente desde migration 20260530507000)
-- Usado como concept_id em bank_transactions para débitos de recovery.
-- ============================================================
INSERT INTO concepts (slug, domain)
  VALUES ('actor-wallet-recovery', 'financeiro-reversal')
ON CONFLICT (domain, slug) DO NOTHING;

COMMIT;

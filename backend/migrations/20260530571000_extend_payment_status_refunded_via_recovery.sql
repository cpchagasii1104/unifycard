-- ============================================================
-- Extend payment_intents.payment_status CHECK: add 'refunded_via_recovery'
-- ============================================================
-- Sessão: 2026-05-27 (C7 — Recovery Finalization)
--
-- Significado de payment_status='refunded_via_recovery':
--   Estado terminal pós-recovery. O payment_intent que estava em
--   'released_to_actor_wallet' (D-money liberou para actor_wallet)
--   foi totalmente recuperado via actor_wallet_recovery_obligations
--   e creditado ao user_wallet do payer. Obligation atingiu 'recovered'.
--
--   DISTINTO de 'reversed': 'reversed' é o caminho de estorno tradicional
--   (bankSplitRepository → reversal.service.ts). 'refunded_via_recovery'
--   é o caminho próprio pós-D-money sem toque em reversals nem bank_splits.
--
-- Transição válida:
--   'released_to_actor_wallet' → 'refunded_via_recovery'
--   Executada por finalizeRecoveryCase (recovery-finalization.service.ts)
--   quando obligation.status = 'recovered'. Atômica com INSERT event_outbox.
--
-- Guard: reversal.service.ts checkPostDmoneyBlock bloqueia também este status.
-- Ref: DT-DMONEY-FINALIZATION-FLOW-MISSING (fecha com este commit).
--
-- Reversibilidade: BAIXA (DROP CHECK + ADD CHECK inverso). Blast: BAIXO.
-- ============================================================

BEGIN;

ALTER TABLE payment_intents
  DROP CONSTRAINT IF EXISTS payment_intents_payment_status_check;

ALTER TABLE payment_intents
  ADD CONSTRAINT payment_intents_payment_status_check
  CHECK (payment_status IN (
    -- legado canônico (07_NOMENCLATURA_CANONICA §4.11)
    'pending', 'authorized', 'captured',
    'escrowed', 'settled', 'failed',
    'cancelled', 'reversed',
    'partially_refunded', 'disputed', 'expired',
    -- Camada 1 D-money — 2026-05-26
    'released_to_actor_wallet',
    -- C7 Recovery Finalization — 2026-05-27
    'refunded_via_recovery'
  ));

COMMENT ON CONSTRAINT payment_intents_payment_status_check ON payment_intents IS
  'Defesa em profundidade alinhada com PaymentIntentStatus (payment-intent-
   repository.ts). released_to_actor_wallet: D-money liberou para actor_wallet.
   refunded_via_recovery: pós-recovery completo via actor_wallet_recovery_obligations
   (DECISION-0053 C7, 2026-05-27) — NÃO confundir com reversed (estorno tradicional).';

COMMIT;

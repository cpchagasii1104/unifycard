-- ============================================================
-- Extend payment_intents.payment_status CHECK: add 'released_to_actor_wallet'
-- ============================================================
-- Sessão: 2026-05-26 (Camada 1 — D-money)
--
-- Significado de payment_status='released_to_actor_wallet':
--   Estado final do payment_intent escrowed (Camada 1 entrada,
--   commit `62771db9`) APÓS D-money mover o dinheiro de escrow_payments
--   para a actor_wallet do(s) receiver(s) do split. Estado distinto de
--   'settled' propositalmente — release-worker antigo (BOOT.ts:213)
--   consome WHERE payment_status='settled', e D-money NÃO QUER acordar
--   esse worker (caminho dorme em produção, DT-PIPELINE-WIRING-GAP).
--
-- Transição válida (única em D-money):
--   'escrowed' → 'released_to_actor_wallet' atômico com:
--     - transfer escrow_payments → actor_wallet por split
--     - service_orders.status='release_approved' → 'funds_released'
--     - INSERT event_outbox SERVICE_ORDER_FUNDS_RELEASED_TO_ACTOR_WALLET.
--   Tudo em uma única transação (pattern existingClient).
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
    'released_to_actor_wallet'
  ));

COMMENT ON CONSTRAINT payment_intents_payment_status_check ON payment_intents IS
  'Defesa em profundidade alinhada com PaymentIntentStatus (payment-intent-
   repository.ts:13-24). released_to_actor_wallet (D-money 2026-05-26):
   dinheiro saiu de escrow_payments para actor_wallet do receiver; NÃO
   confundir com settled (consumido pelo release-worker antigo, plano Bank
   lifecycle dormente).';

COMMIT;

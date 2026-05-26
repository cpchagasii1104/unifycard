-- ============================================================
-- Extend service_order_status enum: add 'funds_released' (D-money)
-- ============================================================
-- Sessão: 2026-05-26 (Camada 1 — D-money)
--
-- Significado de service_order.status='funds_released':
--   Estado final da service_order Camada 1 (fixed_price_escrow) APÓS
--   D-money mover o dinheiro de escrow_payments → actor_wallet do(s)
--   receiver(s). Sequência:
--     in_progress → seller_pending (F1, prestador conclui)
--     seller_pending → release_approved (D2, buyer confirma OU timeout)
--     release_approved → funds_released (D-money, ledger move)
--
-- IMPORTANTE — distinção semântica:
--   'funds_released' = dinheiro liberado para actor_wallet (custódia
--     interna do prestador no UnifyBank). NÃO significa "pago" no sentido
--     de payout externo. Saque para banco externo é frente posterior
--     (DT-ACTOR-WALLET-PAYOUT-WIRING).
--
-- Em D2 (commit `40afc3f1`) o nome 'funds_released' havia sido VETADO
-- como business_audit_action porque D2 não movia dinheiro. Em D-money
-- o dinheiro MOVE materialmente, então o nome é semanticamente preciso.
--
-- Reversibilidade: BAIXA (ALTER TYPE ... DROP VALUE não é suportado em
-- postgres). Blast: BAIXO (adição de valor; nada removido).
-- ============================================================

BEGIN;

ALTER TYPE service_order_status ADD VALUE IF NOT EXISTS 'funds_released'
  AFTER 'release_approved';

COMMENT ON TYPE service_order_status IS
  'Status do ciclo operacional de uma service_order. Valores:
   draft / confirmed / in_progress / completed / seller_pending /
   release_approved / funds_released / cancelled.
   seller_pending, release_approved e funds_released são estados
   específicos do fluxo Camada 1 (fixed_price_escrow):
     - seller_pending (F1): prestador concluiu serviço.
     - release_approved (D2): buyer confirmou ou timeout venceu, sem
       disputa; NÃO move dinheiro.
     - funds_released (D-money 2026-05-26): dinheiro saiu de
       escrow_payments para actor_wallet do receiver; saque externo
       fica para frente posterior.';

COMMIT;

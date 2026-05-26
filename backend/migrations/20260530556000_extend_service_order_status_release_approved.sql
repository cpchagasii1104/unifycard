-- ============================================================
-- Extend service_order_status enum: add 'release_approved' (D2)
-- ============================================================
-- Sessão: 2026-05-26 (Camada 1 saída — D2)
--
-- DECISÃO SEMÂNTICA (Clayton/ChatGPT — 2026-05-26):
--   Status operacional D2 chamado 'release_approved' (NÃO
--   'seller_available').
--
-- Motivo:
--   `bank_accounts.account_type='seller_available'` JÁ significa saldo
--   FINANCEIRO real disponível para payout, lastreado por bank_ledger.
--   Usar a mesma palavra num service_orders.status sem mover dinheiro
--   criaria DUAS VERDADES com o mesmo nome:
--     1. seller_available financeiro (Plano Bank — saldo real).
--     2. seller_available operacional (Plano service_orders — sem $).
--
--   'release_approved' é semanticamente preciso:
--     - comprador confirmou conclusão OU
--     - timeout do release_eligible_at venceu E
--     - disputed_at IS NULL.
--   Significa "serviço APROVADO para futura liberação financeira" —
--   NÃO "fundos liberados".
--
--   Frente financeira FUTURA é responsável por mover dinheiro do
--   plano escrow_payments para seller_available (Bank) lastreado por
--   bank_ledger. Ver DT-D2-WIRING-MONEY-PENDING.
--
-- Histórico desta migration:
--   - Aplicação local prévia tentou 'seller_available' e foi ajustada
--     ANTES de qualquer commit/registro em schema_migrations. O nome
--     correto 'release_approved' é o único valor introduzido.
--
-- Reversibilidade: BAIXA (ALTER TYPE ... DROP VALUE não é suportado
-- nativamente em postgres). Reversão exige reconstrução do tipo.
-- Blast: BAIXO — adiciona valor novo, não remove nenhum.
-- ============================================================

BEGIN;

ALTER TYPE service_order_status ADD VALUE IF NOT EXISTS 'release_approved'
  AFTER 'seller_pending';

COMMENT ON TYPE service_order_status IS
  'Status do ciclo operacional de uma service_order. Valores:
   draft / confirmed / in_progress / completed / seller_pending /
   release_approved / cancelled. seller_pending e release_approved
   são estados específicos do fluxo Camada 1 (fixed_price_escrow);
   release_approved é estado-only e NÃO move dinheiro — release
   financeiro real fica em frente própria. Ver DT-D2-WIRING-MONEY-PENDING.

   IMPORTANTE: NÃO confundir com bank_accounts.account_type=
   ''seller_available'', que é saldo financeiro real lastreado por
   bank_ledger. release_approved é APROVAÇÃO operacional para
   futura movimentação financeira.';

COMMIT;

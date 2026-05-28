-- ============================================================
-- Actor Wallet Payout — one active request per actor gate
-- DECISION-0058 / F-ACTOR-WALLET-PAYOUT-WIRING hardening (2026-05-28)
--
-- Garante que um actor só possa ter 1 payout request ativo por vez
-- (status: pending_approval | approved | processing).
--
-- A restrição é semântica, não financeira:
--   - Evita exposição a aprovação duplicada (dois pedidos disputando o
--     mesmo saldo no gate de aprovação).
--   - NÃO altera bank_ledger. NÃO move dinheiro. NÃO bloqueia saldo.
--
-- Index parcial: só aplica quando status é ativo.
-- Requests terminais (completed/failed/cancelled/rejected) NÃO são
-- cobertos pelo index — actor pode criar novo pedido após encerramento.
--
-- Pré-requisito: 20260530572000 (CREATE TABLE actor_wallet_payout_requests).
-- Reversibilidade: DROP INDEX — sem risco de perda de dados.
-- Blast: BAIXO — additive only; zero rows impactadas no dev (tabela vazia).
-- ============================================================

BEGIN;

-- Verificação de segurança: garante que não há duplicatas ativas antes
-- de criar o index. Se houver, o CREATE UNIQUE INDEX falhará naturalmente
-- com mensagem clara (não silencia dados).
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT tenant_id, actor_id, COUNT(*) AS n
      FROM actor_wallet_payout_requests
     WHERE status IN ('pending_approval', 'approved', 'processing')
     GROUP BY tenant_id, actor_id
    HAVING COUNT(*) > 1
  ) dupes;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'HARDENING ABORTADO: % par(es) (tenant_id, actor_id) têm múltiplos requests ativos. '
      'Resolver manualmente antes de aplicar esta migration.',
      dup_count;
  END IF;
END $$;

-- Partial unique index: um request ativo por (tenant_id, actor_id)
CREATE UNIQUE INDEX uidx_actor_wallet_payout_one_active_per_actor
  ON actor_wallet_payout_requests (tenant_id, actor_id)
  WHERE status IN ('pending_approval', 'approved', 'processing');

COMMENT ON INDEX uidx_actor_wallet_payout_one_active_per_actor IS
  'Gate semântico: um actor só pode ter 1 payout request ativo por vez. '
  'Ativos = pending_approval | approved | processing. '
  'Requests terminais (completed/failed/cancelled/rejected) não são cobertos. '
  'DECISION-0058 hardening pós-F2 (2026-05-28).';

COMMIT;

BEGIN;

-- FIX: system_coverage excluía liquidity_issuance do capacity
-- A conta system:liquidity_issuance é mecanismo interno de double-entry (emissão).
-- Seus débitos não representam consumo de reserva real — não devem anular execution_capacity.
-- Apenas contas system que NÃO sejam liquidity_issuance contam como capacity.

CREATE OR REPLACE VIEW system_coverage AS
SELECT
  t.id as tenant_id,
  COALESCE((
    SELECT SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_cents ELSE -bl.amount_cents END)
    FROM bank_accounts ba
    JOIN bank_ledger bl ON bl.account_id = ba.id
    WHERE ba.tenant_id = t.id
      AND ba.owner_type = 'system'
      AND ba.owner_id NOT LIKE 'system:liquidity_issuance:%'
  ), 0) as execution_capacity_cents,
  COALESCE((
    SELECT SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_cents ELSE -bl.amount_cents END)
    FROM bank_accounts ba
    JOIN bank_ledger bl ON bl.account_id = ba.id
    WHERE ba.tenant_id = t.id AND ba.owner_type != 'system'
  ), 0) as total_credits_cents
FROM tenants t;

COMMIT;

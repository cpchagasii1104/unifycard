/*
Arquivo: 220_region_balances_read_model.sql
Projeto: UnifiCard
Banco: PostgreSQL 14+
Tipo: READ MODEL (DERIVADO DO LEDGER)

REGRAS ABSOLUTAS:
- NÃO existe saldo persistido
- NÃO existe UPDATE / INSERT / DELETE
- Fonte única da verdade: bank_ledger
- Este artefato é APENAS leitura
*/

BEGIN;

-- ============================================================
-- VIEW: region_balances
-- ============================================================
-- Saldo regional calculado dinamicamente a partir do ledger
-- Nenhum dado financeiro é armazenado aqui

CREATE OR REPLACE VIEW region_balances AS
SELECT
  bl.tenant_id,
  ra.region_id,
  ba.currency,

  SUM(
    CASE
      WHEN bl.direction = 'credit' THEN bl.amount_cents
      WHEN bl.direction = 'debit'  THEN -bl.amount_cents
      ELSE 0
    END
  ) AS balance_cents

FROM bank_ledger bl
JOIN bank_accounts ba
  ON ba.id = bl.bank_account_id

-- Mapeamento explícito da conta para região
JOIN region_account_map ra
  ON ra.bank_account_id = ba.id

GROUP BY
  bl.tenant_id,
  ra.region_id,
  ba.currency;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON VIEW region_balances IS
  'READ MODEL de saldo regional. Derivado exclusivamente do bank_ledger. Nenhum saldo é persistido.';

COMMENT ON COLUMN region_balances.balance_cents IS
  'Saldo calculado dinamicamente em centavos (SSOT: bank_ledger).';

COMMIT;

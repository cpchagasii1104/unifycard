-- 0024_account_type_constraint.sql
-- Tipos de conta canônicos do motor financeiro.
-- credit = compatibilidade com contas existentes.
-- Demais = lifecycle do Settlement Engine.

ALTER TABLE bank_accounts
DROP CONSTRAINT IF EXISTS bank_accounts_account_type_check;

ALTER TABLE bank_accounts
ADD CONSTRAINT bank_accounts_account_type_check
CHECK (
  account_type IN (
    'credit',
    'user_wallet',
    'escrow_payments',
    'escrow_disputes',
    'seller_pending',
    'seller_available',
    'seller_payout',
    'platform_revenue',
    'platform_fees',
    'clearing',
    'bank_settlement',
    'adjustment',
    'risk_reserve'
  )
);

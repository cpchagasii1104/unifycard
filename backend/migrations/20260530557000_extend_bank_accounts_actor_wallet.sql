-- ============================================================
-- Extend bank_accounts.account_type CHECK: add 'actor_wallet'
-- ============================================================
-- Sessão: 2026-05-26 (Camada 1 — D-money)
--
-- DECISÃO Clayton/ChatGPT (K_wallet_1 = Opção D):
--   Criar account_type canônico NOVO 'actor_wallet' como destino do
--   release financeiro da Camada 1 (escrow_payments → actor_wallet).
--
-- SIGNIFICADO de actor_wallet:
--   - Carteira interna do actor (PF, empresa, ou outro actor econômico)
--     dentro do UnifyBank.
--   - Lastreada exclusivamente por bank_ledger (Bank é SSOT).
--   - Recebe valores LIBERADOS de serviços/vendas APÓS aprovação D2
--     (service_order.status='release_approved') E ANTES de saque externo.
--   - NÃO é receita da plataforma (platform_revenue/platform_fees têm
--     contas system próprias).
--   - NÃO é payout externo (frente posterior; payout-worker antigo
--     continua dormente DT-PIPELINE-WIRING-GAP elo 2).
--   - NÃO é bank_settlement (saída para banco externo, frente posterior).
--
-- COEXISTÊNCIA COM TIPOS LEGADOS:
--   - user_wallet: 0 rows hoje; tipo dormente. Mantido no CHECK por
--     compatibilidade.
--   - seller_available: existe como conta SYSTEM tenant-única (legado/
--     agregado). NÃO será usada por D-money. Mantida no CHECK por
--     compatibilidade com workers/plano antigo.
--   - credit: conta default genérica do actor (51 rows). Continua
--     existindo paralelamente à actor_wallet para outros usos.
--
-- Reversibilidade: BAIXA (DROP CHECK + ADD CHECK inverso). Blast: BAIXO
-- (apenas adiciona valor permitido).
-- ============================================================

BEGIN;

ALTER TABLE bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_account_type_check;

ALTER TABLE bank_accounts
  ADD CONSTRAINT bank_accounts_account_type_check
  CHECK (account_type IN (
    -- legado mantido por compatibilidade
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
    'risk_reserve',
    -- Camada 1 D-money — 2026-05-26 (decisão Clayton K_wallet_1 = Opção D)
    'actor_wallet'
  ));

COMMENT ON CONSTRAINT bank_accounts_account_type_check ON bank_accounts IS
  'Defesa em profundidade alinhada com BankAccountType (bank-account.types.ts).
   actor_wallet (2026-05-26, D-money): carteira interna do actor — saldo
   custodial do prestador dentro do UnifyBank, lastreada por bank_ledger,
   distinto de seller_available SYSTEM (legado) e de user_wallet (dormente).
   NÃO é receita da plataforma. Ver DT-CAMADA1-FEE-SPLIT.';

COMMIT;

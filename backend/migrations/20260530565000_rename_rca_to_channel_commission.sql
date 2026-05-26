-- ============================================================
-- DECISION-0048: Renomear rca_commission → channel_commission
-- ============================================================
-- Sessão: 2026-05-26 (convergência pós-PE-1).
--
-- "RCA" (Representante Comercial Autônomo) é jargão brasileiro
-- estreito demais para virar line_type estrutural. Renomear para
-- channel_commission (canal genérico — afiliado, parceiro, RCA,
-- influencer, marketplace externo etc.).
--
-- Idem para destination_type: rca_actor_wallet → channel_actor_wallet.
--
-- Identidade específica do canal (RCA, afiliado X, marketplace Y)
-- fica em metadata.channelKind ou em destination_key, NÃO em
-- line_type/destination_type estrutural.
--
-- Sem backfill (economic_policy_lines = 0 rows quando esta migration
-- é aplicada — PE-1 acabou de ser commitado, tabela vazia em prod
-- e em dev).
--
-- Reversibilidade: ALTA. Blast: ZERO (sem dados afetados).
-- ============================================================

BEGIN;

-- 1) economic_policy_lines.line_type: substituir 'rca_commission' por
--    'channel_commission' na CHECK constraint.
ALTER TABLE economic_policy_lines DROP CONSTRAINT IF EXISTS economic_policy_lines_line_type_check;
ALTER TABLE economic_policy_lines ADD CONSTRAINT economic_policy_lines_line_type_check
  CHECK (line_type IN (
    'revenue_share',
    'platform_fee',
    'regional_fund',
    'reserve',
    'referral',
    'group_allocation',
    'channel_commission',
    'custom'
  ));

-- 2) economic_policy_lines.destination_type: substituir 'rca_actor_wallet'
--    por 'channel_actor_wallet' na CHECK constraint.
ALTER TABLE economic_policy_lines DROP CONSTRAINT IF EXISTS economic_policy_lines_destination_type_check;
ALTER TABLE economic_policy_lines ADD CONSTRAINT economic_policy_lines_destination_type_check
  CHECK (destination_type IN (
    'receiver_actor',
    'actor_wallet',
    'platform_fees',
    'platform_revenue',
    'regional_fund',
    'risk_reserve',
    'referrer_actor_wallet',
    'group_wallet',
    'channel_actor_wallet',
    'escrow_payments',
    'custom'
  ));

COMMIT;

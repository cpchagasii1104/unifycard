-- ============================================================
-- PE-1: Economic Policy Engine — economic_policy_lines
-- ============================================================
-- Sessão: 2026-05-26.
--
-- Linhas de split tipadas para uma economic_policy. Cada linha define
-- 1 destino econômico + quanto (em BPS inteiro OU fixed_amount_cents).
--
-- BPS inteiro (Clayton K_pe_5):
--   - 10000 = 100%
--   - 300 = 3%
--   - sem float, sem NUMERIC.
--   - sum de bps de uma policy deve fechar 10000 (validado em código).
--   - drift de arredondamento aplica a revenue_share[0] (K_pe_7).
--
-- destination_type (canônico):
--   receiver_actor           — actor_wallet do receiverActorId
--   actor_wallet             — alias explícito (mesmo destino)
--   platform_fees            — conta system platform_fees do tenant
--   platform_revenue         — conta system platform_revenue do tenant
--   regional_fund            — conta system regional_fund do tenant
--   risk_reserve             — conta system risk_reserve do tenant
--   referrer_actor_wallet    — actor_wallet do referrer (via getActiveReferral)
--   group_wallet             — actor_wallet do grupo (via user_group_allocation)
--   rca_actor_wallet         — actor_wallet do RCA/canal
--   escrow_payments          — custódia (Camada 1 entrada)
--   custom                   — destination_key carrega owner_id explícito
--
-- Reversibilidade: ALTA. Blast: ZERO.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS economic_policy_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES economic_policies(id) ON DELETE CASCADE,

  line_type TEXT NOT NULL
    CHECK (line_type IN (
      'revenue_share',
      'platform_fee',
      'regional_fund',
      'reserve',
      'referral',
      'group_allocation',
      'rca_commission',
      'custom'
    )),

  destination_type TEXT NOT NULL
    CHECK (destination_type IN (
      'receiver_actor',
      'actor_wallet',
      'platform_fees',
      'platform_revenue',
      'regional_fund',
      'risk_reserve',
      'referrer_actor_wallet',
      'group_wallet',
      'rca_actor_wallet',
      'escrow_payments',
      'custom'
    )),

  -- Chave livre para destinos custom (ex.: owner_id específico,
  -- account_type custom). NULL para destinos canônicos resolvíveis
  -- por convenção.
  destination_key TEXT,

  -- Valor: BPS (%) OU fixed_amount_cents — pelo menos um obrigatório.
  bps INTEGER CHECK (bps IS NULL OR (bps >= 0 AND bps <= 10000)),
  fixed_amount_cents BIGINT CHECK (fixed_amount_cents IS NULL OR fixed_amount_cents >= 0),
  CHECK (bps IS NOT NULL OR fixed_amount_cents IS NOT NULL),

  -- Base de cálculo:
  --   'gross'      — sobre amount_cents bruto.
  --   'net'        — sobre amount_cents - Σ(fees prévios).
  applies_to TEXT NOT NULL DEFAULT 'gross'
    CHECK (applies_to IN ('gross', 'net')),

  -- Condição opcional (ex.: 'if_active_referral', 'if_actor_in_group').
  condition_type TEXT,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Prioridade interna (ordem de aplicação dentro de uma policy).
  priority INTEGER NOT NULL DEFAULT 0,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_economic_policy_lines_policy
  ON economic_policy_lines(policy_id, priority);

COMMENT ON TABLE economic_policy_lines IS
  'Linhas de split tipadas. Cada linha = 1 destino + valor (BPS inteiro
   ou fixed_amount_cents). Σ(bps) de uma policy COMMISSION_SPLIT deve
   fechar 10000; resolver aplica floor + drift para revenue_share[0].';

COMMENT ON COLUMN economic_policy_lines.bps IS
  'Basis points (0..10000 = 0%..100%). Integer. Sem float. DECISION-0047.';

COMMENT ON COLUMN economic_policy_lines.applies_to IS
  '''gross'' calcula sobre amount bruto da transação. ''net'' calcula
   sobre amount - Σ(fees aplicados antes desta linha). Order via priority.';

COMMIT;

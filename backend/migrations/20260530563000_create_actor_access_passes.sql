-- ============================================================
-- PE-1: Economic Policy Engine — actor_access_passes
-- ============================================================
-- Sessão: 2026-05-26.
--
-- Instâncias de access pass comprado por um actor. status='active'
-- + NOW() in [starts_at, ends_at] = passe vivo.
--
-- Resolutor consulta esta tabela ao calcular splits — se actor tem
-- passe ativo no contexto (vertical/module/geo), aplica
-- commission_override_bps do produto.
--
-- Pagamento do passe (price_cents) é frente separada — quando ele
-- existir, vai gerar payment_intent + transferência → platform_revenue
-- (account system tenant). NÃO nesta fatia.
--
-- Reversibilidade: ALTA. Blast: ZERO.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS actor_access_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES access_pass_products(id) ON DELETE RESTRICT,

  -- Vigência da assinatura.
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  CHECK (ends_at > starts_at),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'refunded')),

  -- Vínculo opcional com o pagamento do passe (frente futura).
  paid_payment_intent_id UUID,
  paid_bank_transaction_id UUID,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index parcial: passes "vivos" por actor — uso quente do resolutor.
CREATE INDEX IF NOT EXISTS idx_actor_access_passes_active
  ON actor_access_passes(tenant_id, actor_id, ends_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_actor_access_passes_product
  ON actor_access_passes(tenant_id, product_id);

CREATE OR REPLACE FUNCTION update_actor_access_passes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_actor_access_passes_updated_at ON actor_access_passes;
CREATE TRIGGER trigger_update_actor_access_passes_updated_at
  BEFORE UPDATE ON actor_access_passes
  FOR EACH ROW
  EXECUTE FUNCTION update_actor_access_passes_updated_at();

ALTER TABLE actor_access_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_access_passes FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY actor_access_passes_tenant_isolation ON actor_access_passes
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

COMMENT ON TABLE actor_access_passes IS
  'Instâncias de access pass por actor. Resolutor consulta passes
   ativos (status=''active'' AND NOW() BETWEEN starts_at AND ends_at)
   ao calcular splits — se houver match com vertical/module/geo,
   aplica commission_override_bps do produto.';

COMMIT;

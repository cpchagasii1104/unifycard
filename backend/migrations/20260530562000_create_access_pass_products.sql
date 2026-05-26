-- ============================================================
-- PE-1: Economic Policy Engine — access_pass_products
-- ============================================================
-- Sessão: 2026-05-26.
--
-- Catálogo de produtos de "passe/assinatura" que actor pode comprar
-- para isenção/redução de comissão em vertical/módulo específico.
--
-- Modelo (Clayton K_pe_6):
--   - vertical + module_context: escopo de atuação do passe.
--   - duration_seconds: vida útil após compra (segundos para
--     precisão; 1 dia = 86400, 30 dias = 2_592_000).
--   - price_cents: preço de compra do passe.
--   - commission_override_bps: BPS de comissão DURANTE vigência
--     do passe (ex.: 0 = isento; 250 = 2,5% reduzido).
--
-- Compra cria row em actor_access_passes (entidade viva) com
-- starts_at + ends_at calculados.
--
-- Reversibilidade: ALTA. Blast: ZERO.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS access_pass_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  product_code TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,

  -- Escopo do passe.
  vertical TEXT NOT NULL,
  module_context TEXT NOT NULL,
  actor_type TEXT,
  country TEXT,
  region TEXT,
  city TEXT,

  -- Duração + preço.
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',

  -- Override de comissão durante vigência (NULL = sem override).
  commission_override_bps INTEGER
    CHECK (commission_override_bps IS NULL
        OR (commission_override_bps >= 0 AND commission_override_bps <= 10000)),

  -- Status + vigência.
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'inactive')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  CHECK (effective_until IS NULL OR effective_until > effective_from),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, product_code, version)
);

CREATE INDEX IF NOT EXISTS idx_access_pass_products_lookup
  ON access_pass_products(tenant_id, module_context, vertical, status)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION update_access_pass_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_access_pass_products_updated_at ON access_pass_products;
CREATE TRIGGER trigger_update_access_pass_products_updated_at
  BEFORE UPDATE ON access_pass_products
  FOR EACH ROW
  EXECUTE FUNCTION update_access_pass_products_updated_at();

ALTER TABLE access_pass_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_pass_products FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY access_pass_products_tenant_isolation ON access_pass_products
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

COMMENT ON TABLE access_pass_products IS
  'Catálogo de access passes — actor compra para ter override de
   comissão durante vigência. commission_override_bps=0 = isento total.';

COMMIT;

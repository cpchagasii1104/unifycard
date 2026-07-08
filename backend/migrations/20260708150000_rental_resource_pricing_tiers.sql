-- 20260708150000: F-RENTAL-PRICING-QUANTITY-GEO-MVP Fase 1 — PREÇO POR FAIXA. Um recurso pode ter
-- várias faixas (R$/hora, /dia, /semana, /mês, /semestre, /ano). PRÉ-DINHEIRO: preço = ANÚNCIO, não
-- cobrança (Δbank=0). Dinheiro SEMPRE cents/BIGINT (nunca FLOAT/DECIMAL/NUMERIC). Forward-only.
BEGIN;
-- vocabulário governado += por_semestre, por_ano (não string solta) — no par legado e na tabela nova.
ALTER TABLE rentable_resources DROP CONSTRAINT IF EXISTS rentable_resources_pricing_unit_check;
ALTER TABLE rentable_resources ADD CONSTRAINT rentable_resources_pricing_unit_check
  CHECK (pricing_unit IS NULL OR pricing_unit = ANY (ARRAY[
    'por_hora','por_dia','por_semana','por_mes','por_semestre','por_ano']::text[]));

CREATE TABLE IF NOT EXISTS rental_resource_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES rentable_resources(id) ON DELETE CASCADE,
  unit TEXT NOT NULL CHECK (unit = ANY (ARRAY[
    'por_hora','por_dia','por_semana','por_mes','por_semestre','por_ano']::text[])),
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),  -- dinheiro: cents/BIGINT, nunca float
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rental_pricing_resource_unit UNIQUE (resource_id, unit)
);
CREATE INDEX IF NOT EXISTS idx_rrp_resource ON rental_resource_pricing (resource_id);

-- Backfill: migra o par legado (pricing_unit+price_cents) para a tabela de faixas (SSOT das faixas).
INSERT INTO rental_resource_pricing (resource_id, unit, price_cents)
SELECT r.id, r.pricing_unit, r.price_cents
  FROM rentable_resources r
 WHERE r.pricing_unit IS NOT NULL AND r.price_cents IS NOT NULL
ON CONFLICT (resource_id, unit) DO NOTHING;
COMMIT;

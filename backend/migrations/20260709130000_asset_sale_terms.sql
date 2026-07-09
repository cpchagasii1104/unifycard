-- 20260709130000: F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 — VENDA ASSET-FIRST (implementação do adendo
-- RFC_ASSET_SALE_TERMS_ADENDO, D-α..D-ζ). Camada de TERMOS de venda de um bem durável INDIVIDUAL do actor,
-- 1:1 sobre actor_assets. Migration ADDITIVA, forward-only, sistema virgem (0 linhas) — sem backfill.
--
-- INVARIANTES (adendo): sale_terms = ANÚNCIO/termo comercial, NÃO acordo/pagamento/transferência (D-γ).
-- price_cents = anúncio (Δbank=0, D-δ). status v1 = active/paused, SEM 'sold'/'paid'/'transferred' (D-ε).
-- Identidade (concept/owner/label/condition) fica em actor_assets — NÃO se repete aqui. Ativação = modo 'sale'
-- em actor_asset_modes (já governado). NÃO toca products/product_offers/inventory/Bank/orders/payment_intents.
-- Nasce tenant-owned com RLS ENABLE+FORCE (policy DERIVADA via actor_assets, sem tenant_id denormalizado —
-- mesmo padrão das filhas de locação, sem segunda verdade). D-δ.
BEGIN;

-- (1) Termos de venda — extensão 1:1 de actor_assets (PK=asset_id, NÃO identidade paralela).
CREATE TABLE IF NOT EXISTS actor_asset_sale_terms (
  asset_id                    UUID PRIMARY KEY REFERENCES actor_assets(id) ON DELETE CASCADE,
  price_cents                 BIGINT,
  status                      TEXT NOT NULL DEFAULT 'active',
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  visibility                  TEXT NOT NULL DEFAULT 'public',
  audience_relationship_types TEXT[],
  negotiable                  BOOLEAN NOT NULL DEFAULT false,
  sale_notes                  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- D-ε: status v1 = active/paused. 'sold'/'completed'/'paid'/'transferred' FORA da v1 (implicam execução).
  CONSTRAINT chk_aast_status CHECK (status IN ('active', 'paused')),
  CONSTRAINT chk_aast_visibility CHECK (visibility IN ('public', 'connections', 'only_me')),
  -- D-δ: price_cents = ANÚNCIO (nunca negativo). NULL permitido (preço a combinar / negotiable).
  CONSTRAINT chk_aast_price_nonneg CHECK (price_cents IS NULL OR price_cents >= 0)
);

-- (2) RLS tenant-owned (ENABLE+FORCE) — policy DERIVADA via actor_assets (mesmo padrão das filhas de locação).
ALTER TABLE actor_asset_sale_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_asset_sale_terms FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_asset_sale_terms_tenant_isolation ON actor_asset_sale_terms;
CREATE POLICY actor_asset_sale_terms_tenant_isolation ON actor_asset_sale_terms
  USING (EXISTS (SELECT 1 FROM actor_assets a WHERE a.id = actor_asset_sale_terms.asset_id
                  AND a.tenant_id = current_setting('app.current_tenant', true)::uuid));

COMMIT;

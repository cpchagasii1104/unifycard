-- 20260611180000_offerings_variant_sku_service.sql
-- DECISION-0117 A/D (CP4) — oferta empresarial ligada à VARIANTE canônica.
--
-- PRODUTO: product_offers ganha canonical_variant_id + internal_sku + sale_unit +
-- min_quantity + conditions + fulfillment + status (draft/active/inactive).
-- A UNIQUE legada (tenant, product, merchant) impediria 2 variantes do mesmo
-- produto pelo mesmo merchant — substituída por par de parciais (tabela com 0
-- linhas; sem rewrite de dados). store_product_activations ganha a variante +
-- SKU + unidade comercial. product_variants (SKU tenant, dono do estoque
-- actor-scoped) ganha a PONTE canonical_variant_id — inventory permanece o SSOT
-- de estoque por actor; a identidade vem do canônico.
--
-- SERVIÇO: service_offerings (prestador × serviço canônico): price_cents BIGINT,
-- duração efetiva, profissional, modalidade, localização/área, condições, status.
-- Disponibilidade = Unified Availability com owner ('service_offering', id) —
-- NENHUM calendário paralelo. Booking transacional/pagamento FORA.
--
-- Aditiva, forward-only, idempotente. Zero Bank.

BEGIN;

-- ── PRODUTO: oferta por variante ─────────────────────────────────────────────
ALTER TABLE product_offers
  ADD COLUMN IF NOT EXISTS canonical_variant_id uuid REFERENCES canonical_variants(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS internal_sku text,
  ADD COLUMN IF NOT EXISTS sale_unit text REFERENCES canonical_units(unit_code),
  ADD COLUMN IF NOT EXISTS min_quantity integer CHECK (min_quantity IS NULL OR min_quantity > 0),
  ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fulfillment jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','inactive'));

COMMENT ON COLUMN product_offers.status IS
  'DECISION-0117 (CP4): estado soberano da oferta; is_active legado é mantido em sincronia pelo writer (status=active ⇒ is_active=true).';

-- UNIQUE legada → parciais por presença de variante (tabela vazia; sem dados a reescrever).
ALTER TABLE product_offers
  DROP CONSTRAINT IF EXISTS product_offers_tenant_id_product_id_merchant_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_product_offers_legacy_no_variant
  ON product_offers (tenant_id, product_id, merchant_id)
  WHERE canonical_variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_product_offers_merchant_variant
  ON product_offers (tenant_id, merchant_id, canonical_variant_id)
  WHERE canonical_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_offers_variant
  ON product_offers (canonical_variant_id) WHERE canonical_variant_id IS NOT NULL;

-- ── ATIVAÇÃO por loja guarda variante + SKU + unidade comercial ──────────────
ALTER TABLE store_product_activations
  ADD COLUMN IF NOT EXISTS canonical_variant_id uuid REFERENCES canonical_variants(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS internal_sku text,
  ADD COLUMN IF NOT EXISTS sale_unit text REFERENCES canonical_units(unit_code);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_store_activations_store_variant
  ON store_product_activations (store_id, canonical_variant_id)
  WHERE canonical_variant_id IS NOT NULL;

-- ── PONTE inventory: variante tenant (dona do estoque) ↔ variante canônica ───
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS canonical_variant_id uuid REFERENCES canonical_variants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_product_variants_canonical
  ON product_variants (canonical_variant_id) WHERE canonical_variant_id IS NOT NULL;

-- ── SERVIÇO: oferta de serviço canônico (DECISION-0117 D) ────────────────────
CREATE TABLE IF NOT EXISTS service_offerings (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  canonical_service_id    uuid NOT NULL REFERENCES canonical_services(id) ON DELETE RESTRICT,
  provider_actor_id       uuid NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  company_id              uuid REFERENCES companies(company_id) ON DELETE SET NULL,
  service_id              uuid REFERENCES services(service_id) ON DELETE SET NULL,
  price_cents             bigint NOT NULL CHECK (price_cents >= 0),
  duration_minutes        integer NOT NULL CHECK (duration_minutes > 0),
  professional_actor_id   uuid REFERENCES actors(id) ON DELETE SET NULL,
  modality                text NOT NULL DEFAULT 'in_person' CHECK (modality IN ('in_person','remote','home')),
  location                jsonb NOT NULL DEFAULT '{}'::jsonb,
  service_area            jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions              jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                  text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_actor_id, canonical_service_id)
);

CREATE INDEX IF NOT EXISTS idx_service_offerings_tenant_service
  ON service_offerings (tenant_id, canonical_service_id);
CREATE INDEX IF NOT EXISTS idx_service_offerings_provider
  ON service_offerings (provider_actor_id);

COMMIT;

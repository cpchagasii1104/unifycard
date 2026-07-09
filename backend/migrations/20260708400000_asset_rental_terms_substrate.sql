-- 20260708400000: F-ASSET-MULTI-OFFER-FOUNDATION Fatia 2b-1 (migration ADDITIVA — não quebra fluxo vivo).
-- Cria a camada de TERMOS de locação sobre actor_assets (1:1 por asset_id) + tiers de preço + estende
-- owner_type de availability/address para 'actor_asset'. Ainda NÃO rewire do módulo vivo (2b-2/2b-3/2b-4).
-- Identidade do item = actor_assets; aqui SÓ termos comerciais/operacionais. Sem preço em actor_assets/modes.
-- Δbank=0. Forward-only. Sistema virgem (rentable_resources=0), sem backfill.
BEGIN;

-- (1) Camada de termos de locação — extensão 1:1 de actor_assets (PK=asset_id, NÃO identidade paralela).
-- Colunas de IDENTIDADE do item (concept_id/owner/label/resource_year) NÃO entram aqui — vêm de actor_assets.
CREATE TABLE IF NOT EXISTS actor_asset_rental_terms (
  asset_id              UUID PRIMARY KEY REFERENCES actor_assets(id) ON DELETE CASCADE,
  resource_type         TEXT NOT NULL,
  pricing_unit          TEXT,
  price_cents           BIGINT,
  quantity              INTEGER NOT NULL DEFAULT 1,
  booking_approval_mode TEXT NOT NULL DEFAULT 'manual',
  start_handoff_method  TEXT NOT NULL DEFAULT 'renter_pickup',
  end_handoff_method    TEXT NOT NULL DEFAULT 'renter_return',
  delivery_radius_km    INTEGER,
  delivery_fee_cents    BIGINT,
  collection_fee_cents  BIGINT,
  handoff_time_start    TIME,
  handoff_time_end      TIME,
  mileage_policy        TEXT,
  included_km_per_day   INTEGER,
  included_km_total     INTEGER,
  extra_km_fee_cents    BIGINT,
  rental_modality       TEXT,
  cleaning_fee_policy   TEXT,
  cleaning_fee_cents    BIGINT,
  visibility            TEXT NOT NULL DEFAULT 'public',
  audience_relationship_types TEXT[],
  status                TEXT NOT NULL DEFAULT 'active',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_aart_resource_type CHECK (resource_type IN ('equipment', 'vehicle', 'property', 'space')),
  CONSTRAINT chk_aart_pricing_unit CHECK (pricing_unit IS NULL OR pricing_unit IN ('por_hora','por_dia','por_semana','por_mes','por_semestre','por_ano')),
  CONSTRAINT chk_aart_booking_approval CHECK (booking_approval_mode IN ('manual','automatic')),
  CONSTRAINT chk_aart_start_handoff CHECK (start_handoff_method IN ('renter_pickup','owner_delivery','to_be_arranged')),
  CONSTRAINT chk_aart_end_handoff CHECK (end_handoff_method IN ('renter_return','owner_collection','to_be_arranged')),
  CONSTRAINT chk_aart_mileage CHECK (mileage_policy IS NULL OR mileage_policy IN ('unlimited','limited','to_be_arranged')),
  CONSTRAINT chk_aart_modality CHECK (rental_modality IS NULL OR rental_modality IN ('long_term','seasonal','commercial')),
  CONSTRAINT chk_aart_cleaning CHECK (cleaning_fee_policy IS NULL OR cleaning_fee_policy IN ('none','included','separate_required','to_be_arranged')),
  CONSTRAINT chk_aart_visibility CHECK (visibility IN ('public','connections','only_me')),
  CONSTRAINT chk_aart_status CHECK (status IN ('active','paused','retired')),
  CONSTRAINT chk_aart_price_nonneg CHECK (price_cents IS NULL OR price_cents >= 0),
  CONSTRAINT chk_aart_quantity CHECK (quantity >= 1)
);

-- (2) Faixas de preço da locação (SSOT), por asset (via camada rental). Preço = ANÚNCIO (cents/BIGINT).
CREATE TABLE IF NOT EXISTS actor_asset_rental_pricing_tiers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID NOT NULL REFERENCES actor_asset_rental_terms(asset_id) ON DELETE CASCADE,
  unit       TEXT NOT NULL,
  price_cents BIGINT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_aarpt_unit CHECK (unit IN ('por_hora','por_dia','por_semana','por_mes','por_semestre','por_ano')),
  CONSTRAINT chk_aarpt_price_nonneg CHECK (price_cents >= 0),
  CONSTRAINT uq_aarpt_asset_unit UNIQUE (asset_id, unit)
);

-- (3) Estende owner_type para 'actor_asset' (ADDITIVO — 'rentable_resource' segue válido durante a transição).
ALTER TABLE availability DROP CONSTRAINT IF EXISTS chk_availability_owner_type;
ALTER TABLE availability ADD CONSTRAINT chk_availability_owner_type
  CHECK (owner_type::text = ANY (ARRAY['user','service','event','group','page','service_offering','rentable_resource','actor_asset']));

ALTER TABLE address_assignments DROP CONSTRAINT IF EXISTS address_assignments_owner_type_check;
ALTER TABLE address_assignments ADD CONSTRAINT address_assignments_owner_type_check
  CHECK (owner_type = ANY (ARRAY['company','profile','event','ride','group','tenant_hq','service_provider','rentable_resource','actor_asset']));

COMMIT;

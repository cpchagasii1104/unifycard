-- 20260709120000: F-ASSET-CONDITION-AND-RENTAL-MINIMUMS (implementação D1-D7 do adendo
-- RFC_ASSET_CONDITION_AND_RENTAL_MINIMUMS_ADENDO). Migration ADDITIVA, forward-only, sistema virgem
-- (0 locações vivas) — sem backfill. Δbank=0 (nada financeiro; condição e mínimo não são dinheiro).
--
-- D1: condição do item (novo/usado) = característica da UNIDADE real → actor_assets.condition. NULL
--     permitido na v1 (não presumir; sem default 'used'). Vocab ASSET_CONDITIONS=['new','used'].
-- D2/D3: mínimo de locação = TERMO da oferta rental → actor_asset_rental_terms.min_rental_quantity/
--     min_rental_unit. Re-home de actor_assets.metadata (JSONB do item) para colunas governadas dos termos.
BEGIN;

-- D1 — condição do item real (compartilhada por sale/rental/service_use; NÃO é status/modo/categoria).
ALTER TABLE actor_assets ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE actor_assets DROP CONSTRAINT IF EXISTS chk_actor_assets_condition;
ALTER TABLE actor_assets ADD CONSTRAINT chk_actor_assets_condition
  CHECK (condition IS NULL OR condition IN ('new', 'used'));

-- D2/D3 — mínimo de locação nos TERMOS (não no item). min_rental_quantity >= 1; unit no vocab governado.
ALTER TABLE actor_asset_rental_terms ADD COLUMN IF NOT EXISTS min_rental_quantity INTEGER;
ALTER TABLE actor_asset_rental_terms ADD COLUMN IF NOT EXISTS min_rental_unit TEXT;
ALTER TABLE actor_asset_rental_terms DROP CONSTRAINT IF EXISTS chk_aart_min_rental_qty;
ALTER TABLE actor_asset_rental_terms ADD CONSTRAINT chk_aart_min_rental_qty
  CHECK (min_rental_quantity IS NULL OR min_rental_quantity >= 1);
ALTER TABLE actor_asset_rental_terms DROP CONSTRAINT IF EXISTS chk_aart_min_rental_unit;
ALTER TABLE actor_asset_rental_terms ADD CONSTRAINT chk_aart_min_rental_unit
  CHECK (min_rental_unit IS NULL OR min_rental_unit IN ('hour', 'day', 'week', 'month', 'semester', 'year'));
-- D3 — consistência de PAR: quantidade e unidade juntas, ou ambas ausentes (nunca uma só).
ALTER TABLE actor_asset_rental_terms DROP CONSTRAINT IF EXISTS chk_aart_min_rental_pair;
ALTER TABLE actor_asset_rental_terms ADD CONSTRAINT chk_aart_min_rental_pair
  CHECK ((min_rental_quantity IS NULL) = (min_rental_unit IS NULL));

COMMIT;

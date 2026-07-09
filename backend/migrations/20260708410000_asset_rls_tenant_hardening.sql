-- 20260708410000: F-ASSET-MULTI-OFFER-FOUNDATION Fatia 2b-1b — BLINDAGEM RLS / isolamento de tenant.
-- ACHADO soberano: rentable_resources tinha RLS ENABLE+FORCE, mas as tabelas asset (Fatia 1 + 2b-1) nasceram
-- SEM. A locação não pode migrar para asset sem preservar o isolamento de tenant (arco RLS-live). Hardening
-- forward-only, mesmo padrão vivo (current_setting('app.current_tenant')). NÃO muda o modelo de camadas.
-- concept_asset_eligibilities NÃO é tocada: é governança GLOBAL por CONCEPT (irmã de concept_offer_kinds/
-- concept_rentable_types/shared_subject_concepts, todas rls=false/sem tenant_id) — RLS tenant-scoped nela
-- transformaria verdade canônica em verdade por tenant (viola SSOT). Filhas usam policy DERIVADA via asset
-- (sem tenant_id denormalizado = sem segunda verdade). Δbank=0.
BEGIN;

-- (1) actor_assets — tenant-owned, JÁ tem tenant_id → policy direta (mesmo padrão de rentable_resources).
ALTER TABLE actor_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_assets_tenant_isolation ON actor_assets;
CREATE POLICY actor_assets_tenant_isolation ON actor_assets
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- (2) actor_asset_modes — filha do asset; policy DERIVADA via actor_assets (sem denormalizar tenant_id).
ALTER TABLE actor_asset_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_asset_modes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_asset_modes_tenant_isolation ON actor_asset_modes;
CREATE POLICY actor_asset_modes_tenant_isolation ON actor_asset_modes
  USING (EXISTS (SELECT 1 FROM actor_assets a WHERE a.id = actor_asset_modes.asset_id
                  AND a.tenant_id = current_setting('app.current_tenant', true)::uuid));

-- (3) actor_asset_rental_terms — filha 1:1 do asset; policy DERIVADA via actor_assets.
ALTER TABLE actor_asset_rental_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_asset_rental_terms FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_asset_rental_terms_tenant_isolation ON actor_asset_rental_terms;
CREATE POLICY actor_asset_rental_terms_tenant_isolation ON actor_asset_rental_terms
  USING (EXISTS (SELECT 1 FROM actor_assets a WHERE a.id = actor_asset_rental_terms.asset_id
                  AND a.tenant_id = current_setting('app.current_tenant', true)::uuid));

-- (4) actor_asset_rental_pricing_tiers — neta (asset_id → actor_assets); policy DERIVADA via actor_assets.
ALTER TABLE actor_asset_rental_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_asset_rental_pricing_tiers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_asset_rental_pricing_tiers_tenant_isolation ON actor_asset_rental_pricing_tiers;
CREATE POLICY actor_asset_rental_pricing_tiers_tenant_isolation ON actor_asset_rental_pricing_tiers
  USING (EXISTS (SELECT 1 FROM actor_assets a WHERE a.id = actor_asset_rental_pricing_tiers.asset_id
                  AND a.tenant_id = current_setting('app.current_tenant', true)::uuid));

-- concept_asset_eligibilities: INTOCADA (governança global por CONCEPT). Sem RLS/tenant_id/category_id.

COMMIT;

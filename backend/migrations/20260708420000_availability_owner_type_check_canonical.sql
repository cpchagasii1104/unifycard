-- 20260708420000: F-ASSET-MULTI-OFFER-FOUNDATION 2b-4 — re-define chk_availability_owner_type na FORMA
-- CANÔNICA `owner_type IN (...)` (a 2b-1 usou `= ANY(ARRAY[...])`, semanticamente idêntica, mas o guard
-- audit-availability-owner-authority lê a paridade enum↔CHECK via regex `CHECK (owner_type IN (...))`).
-- Mesmo conjunto de 8 valores (inclui 'actor_asset'). Sem mudança semântica; só alinha a forma lida pelo guard.
BEGIN;
ALTER TABLE availability DROP CONSTRAINT IF EXISTS chk_availability_owner_type;
ALTER TABLE availability ADD CONSTRAINT chk_availability_owner_type
  CHECK (owner_type IN ('user', 'service', 'event', 'group', 'page', 'service_offering', 'rentable_resource', 'actor_asset'));
COMMIT;

-- 20260708140000: F-RENTABLE-RESOURCE-LOCATION-MVP (Clayton 2026-07-08).
-- Trava #1 (governança de vocabulário): address_assignments.owner_type é CHECK fechado. Para o recurso
-- alugável ter localização pelo padrão canônico (address_assignments → addresses → cities), 'rentable_
-- resource' precisa entrar no vocabulário por MIGRATION, não string solta. role='PICKUP' já existe.
BEGIN;
ALTER TABLE address_assignments DROP CONSTRAINT address_assignments_owner_type_check;
ALTER TABLE address_assignments ADD CONSTRAINT address_assignments_owner_type_check
  CHECK (owner_type = ANY (ARRAY[
    'company','profile','event','ride','group','tenant_hq','service_provider','rentable_resource'
  ]::text[]));
COMMIT;

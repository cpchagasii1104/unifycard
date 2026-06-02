-- ============================================================
-- F-GEO-4d (DECISION-0074/0079) — cleanup do blob de endereço civil PF
-- ============================================================
-- Remove SOMENTE a subchave `address` de `profiles.metadata`, preservando todo o restante do JSONB
-- (gender, onboarding_*, personal_data_locked*, etc.). O endereço PF passou a ser SSOT do Location Core
-- (addresses + address_assignments profile/RESIDENCE): CEP/rua/número/complemento + UF (FK states) +
-- cidade (FK cities/IBGE) + bairro (addresses.neighborhood_display_text). O core.service já lê tudo do
-- Location Core (F-GEO-3/4c) e NÃO depende mais do blob.
--
-- GUARD fail-closed: a migration ABORTA se existir qualquer profile com `metadata.address` SEM residência
-- canônica profile/RESIDENCE vigente — não apaga endereço órfão. Remove apenas a subchave (NUNCA o JSONB
-- inteiro). Forward-only/idempotente; NÃO recria endereço; NÃO chama internet; NÃO toca PJ/CPF/gender/
-- actor_active_location/Location Core.
-- ============================================================

BEGIN;

-- GUARD 1 (fail-closed): nenhum profile com blob.address pode estar sem residência canônica espelhada.
DO $$
DECLARE orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM profiles p
  WHERE p.metadata ? 'address'
    AND NOT EXISTS (
      SELECT 1
      FROM actors a
      JOIN address_assignments aa
        ON aa.owner_type = 'profile' AND aa.owner_id = a.actor_id
       AND aa.role = 'RESIDENCE' AND aa.is_primary = true AND aa.valid_until_at IS NULL
      JOIN addresses ad ON ad.address_id = aa.address_id
      WHERE a.tenant_id = p.tenant_id AND a.user_id = p.user_id AND a.actor_type = 'user'
    );
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % profile(s) com metadata.address SEM residencia canonica profile/RESIDENCE -- cleanup bloqueado', orphan_count;
  END IF;
END $$;

-- Remove SOMENTE a subchave 'address' (preserva o resto do JSONB).
UPDATE profiles
SET metadata = metadata - 'address',
    updated_at = now()
WHERE metadata ? 'address';

-- VERIFICACAO POS: nenhum profile com metadata.address remanescente.
DO $$
DECLARE remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining FROM profiles WHERE metadata ? 'address';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ainda existem % profile(s) com metadata.address apos cleanup', remaining;
  END IF;
END $$;

COMMIT;

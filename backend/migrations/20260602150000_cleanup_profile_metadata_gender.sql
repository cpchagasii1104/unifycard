-- ============================================================
-- F4 GENDER (DECISION-0080) — cleanup do blob profiles.metadata.gender
-- ============================================================
-- Remove SOMENTE a subchave `gender` de `profiles.metadata`, preservando todo o restante do JSONB
-- (onboarding_*, personal_data_locked*, etc.). O gender civil passou a ser SSOT de `global_users.gender`
-- (F1 coluna+backfill / F2 writers+readers); o core.service espelha gu.gender em metadata.gender no objeto
-- montado, então os consumidores (identity_status, social-targeting) NÃO dependem mais do blob.
--
-- GUARD fail-closed: aborta se algum `metadata.gender` NÃO estiver espelhado em `global_users.gender`
-- (ausente ou divergente). Remove apenas a subchave (NUNCA o JSONB inteiro). Forward-only/idempotente;
-- NÃO recria gender; NÃO chama internet; NÃO toca CPF/endereço/PJ/Health/Lifestyle/lock/onboarding.
--
-- Mapeamento verificado: profiles -> users(tenant_id,id=user_id) -> global_user_id -> global_users.
-- ============================================================

BEGIN;

-- GUARD 1 (fail-closed): nenhum blob.gender pode estar SEM global_users.gender espelhado.
DO $$
DECLARE missing_count INT;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM profiles p
  JOIN users u ON u.tenant_id = p.tenant_id AND u.id = p.user_id
  JOIN global_users gu ON gu.global_user_id = u.global_user_id
  WHERE p.metadata ? 'gender'
    AND gu.gender IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % profile(s) com metadata.gender SEM global_users.gender espelhado -- cleanup bloqueado', missing_count;
  END IF;
END $$;

-- GUARD 2 (fail-closed): nenhum conflito blob.gender <> global_users.gender.
DO $$
DECLARE conflict_count INT;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM profiles p
  JOIN users u ON u.tenant_id = p.tenant_id AND u.id = p.user_id
  JOIN global_users gu ON gu.global_user_id = u.global_user_id
  WHERE p.metadata ? 'gender'
    AND gu.gender IS NOT NULL
    AND gu.gender <> p.metadata->>'gender';
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % conflito(s) metadata.gender <> global_users.gender -- cleanup bloqueado', conflict_count;
  END IF;
END $$;

-- GUARD 3 (fail-closed): nenhum blob.gender órfão (profile sem user/global_user resolvível) -- não migrável com segurança.
DO $$
DECLARE orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM profiles p
  WHERE p.metadata ? 'gender'
    AND NOT EXISTS (
      SELECT 1
      FROM users u
      JOIN global_users gu ON gu.global_user_id = u.global_user_id
      WHERE u.tenant_id = p.tenant_id AND u.id = p.user_id AND gu.gender IS NOT NULL
    );
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % profile(s) com metadata.gender sem global_users.gender resolvivel -- cleanup bloqueado', orphan_count;
  END IF;
END $$;

-- Remove SOMENTE a subchave 'gender' (preserva o resto do JSONB).
UPDATE profiles
SET metadata = metadata - 'gender',
    updated_at = now()
WHERE metadata ? 'gender';

-- VERIFICACAO POS: nenhum profile com metadata.gender remanescente.
DO $$
DECLARE remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining FROM profiles WHERE metadata ? 'gender';
  IF remaining > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ainda existem % profile(s) com metadata.gender apos cleanup', remaining;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- F1 GENDER (DECISION-0080) — global_users.gender (Identity SSOT) + backfill do blob
-- ============================================================
-- Cria a coluna canônica `global_users.gender` (atributo civil/identity-core, simétrica a full_name/
-- birthdate/cpf) e faz backfill idempotente de `profiles.metadata.gender` → `global_users.gender`.
--
-- Natureza (DECISION-0080): gender = atributo CIVIL/identity-core declarado. NÃO health, NÃO lifestyle,
-- NÃO sexualOrientation, NÃO biologicalSex. Enum canônico = GENDER_VALUES ('male'|'female'|'other').
--
-- Esta fatia (F1) APENAS cria a gaveta certa na identidade e copia o valor. NÃO altera writers/readers,
-- NÃO limpa o blob (cleanup = F4), NÃO altera lock/onboarding, NÃO toca CPF/endereço/PJ/Health/Lifestyle/
-- social-targeting. Forward-only/idempotente; backfill fail-closed (aborta em valor inválido ou conflito).
-- ============================================================

BEGIN;

-- 1) Coluna + CHECK nomeado (idempotente).
ALTER TABLE global_users
  ADD COLUMN IF NOT EXISTS gender TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_global_users_gender') THEN
    ALTER TABLE global_users
      ADD CONSTRAINT chk_global_users_gender
      CHECK (gender IS NULL OR gender IN ('male','female','other'));
  END IF;
END $$;

COMMENT ON COLUMN global_users.gender IS
  'F1/DECISION-0080: sexo/genero civil (identity-core, simetrico a full_name/birthdate/cpf). '
  'Enum male|female|other. NAO health, NAO lifestyle, NAO sexualOrientation, NAO biologicalSex.';

-- 2) GUARD fail-closed: nenhum valor inválido no blob a migrar.
DO $$
DECLARE invalid_count INT;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM profiles p
  WHERE p.metadata ? 'gender'
    AND NULLIF(BTRIM(p.metadata->>'gender'), '') IS NOT NULL
    AND p.metadata->>'gender' NOT IN ('male','female','other');
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % profile(s) com metadata.gender invalido (fora de male/female/other) -- backfill bloqueado', invalid_count;
  END IF;
END $$;

-- 3) GUARD fail-closed: conflito blob vs coluna já preenchida (valor diferente).
DO $$
DECLARE conflict_count INT;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM profiles p
  JOIN users u ON u.tenant_id = p.tenant_id AND u.id = p.user_id
  JOIN global_users gu ON gu.global_user_id = u.global_user_id
  WHERE p.metadata->>'gender' IN ('male','female','other')
    AND gu.gender IS NOT NULL
    AND gu.gender <> p.metadata->>'gender';
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % conflito(s) blob.gender != global_users.gender -- backfill bloqueado', conflict_count;
  END IF;
END $$;

-- 4) GUARD fail-closed: ambiguidade intra-blob (mesmo global_user com generos divergentes em profiles distintos).
DO $$
DECLARE ambiguous_count INT;
BEGIN
  SELECT COUNT(*) INTO ambiguous_count FROM (
    SELECT u.global_user_id
    FROM profiles p
    JOIN users u ON u.tenant_id = p.tenant_id AND u.id = p.user_id
    WHERE p.metadata->>'gender' IN ('male','female','other')
    GROUP BY u.global_user_id
    HAVING COUNT(DISTINCT p.metadata->>'gender') > 1
  ) amb;
  IF ambiguous_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % global_user(s) com genero ambiguo entre profiles -- backfill bloqueado', ambiguous_count;
  END IF;
END $$;

-- 5) Backfill idempotente: só preenche quando a coluna está NULL (re-run pula já preenchidos).
UPDATE global_users gu
SET gender = src.g, updated_at = now()
FROM (
  SELECT u.global_user_id AS gid, p.metadata->>'gender' AS g
  FROM profiles p
  JOIN users u ON u.tenant_id = p.tenant_id AND u.id = p.user_id
  WHERE p.metadata->>'gender' IN ('male','female','other')
) src
WHERE gu.global_user_id = src.gid
  AND gu.gender IS NULL;

-- VERIFICACAO POS: coluna + constraint existem.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_users' AND column_name = 'gender'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: global_users.gender nao foi criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_global_users_gender') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_global_users_gender nao foi criada';
  END IF;
END $$;

COMMIT;

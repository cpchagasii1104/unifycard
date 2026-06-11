-- ============================================================
-- GENDER 5 VALORES (DECISION-0115 D3 — implementada pela macrofrente C1, 2026-06-11)
-- ============================================================
-- Expande o vocabulário soberano de `global_users.gender` de 3 → 5 valores:
--   male | female | non_binary | other | prefer_not_to_say
--
-- Precedência normativa: a fonte soberana é a DECISION-0115 D3, ratificada expressamente por
-- Clayton, que SUPEROU a regra de 3 valores da DECISION-0080 §4 exclusivamente nesse ponto.
-- O GO da macrofrente C1 não promulga norma — apenas executa a D3. Esta migration IMPLEMENTA
-- a decisão soberana, alinhando o CHECK do banco ao vocabulário já oferecido pela UI de Register
-- (adendo factual registrado na DECISION-0080).
-- [Correção de atribuição normativa 2026-06-12 — só comentários; SQL executável intocado.]
--
-- Casa canônica INALTERADA: global_users.gender (set-once via setUserGenderIfAbsent).
-- Nenhum dado existente é alterado (valores vivos 'male'/NULL são subconjunto dos 5).
-- Forward-only / idempotente. NÃO toca writers/readers (código na mesma fatia), NÃO toca blob.
-- ============================================================

BEGIN;

-- GUARD fail-closed: nenhum valor vivo fora do vocabulário de 5 (expansão pura — não pode haver).
DO $$
DECLARE
  bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM global_users
  WHERE gender IS NOT NULL
    AND gender NOT IN ('male','female','non_binary','other','prefer_not_to_say');
  IF bad > 0 THEN
    RAISE EXCEPTION 'ABORT: % linha(s) de global_users.gender fora do vocabulário de 5 valores', bad;
  END IF;
END $$;

-- Substitui o CHECK de 3 valores pelo de 5 (idempotente: só recria se a definição antiga existir).
DO $$
DECLARE
  current_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO current_def
  FROM pg_constraint WHERE conname = 'chk_global_users_gender';

  IF current_def IS NULL OR current_def NOT LIKE '%non_binary%' THEN
    IF current_def IS NOT NULL THEN
      ALTER TABLE global_users DROP CONSTRAINT chk_global_users_gender;
    END IF;
    ALTER TABLE global_users
      ADD CONSTRAINT chk_global_users_gender
      CHECK (gender IS NULL OR gender IN ('male','female','non_binary','other','prefer_not_to_say'));
  END IF;
END $$;

COMMENT ON COLUMN global_users.gender IS
  'Gender civil/identity-core (DECISION-0080 + GO C1 2026-06-11): enum male|female|non_binary|other|prefer_not_to_say. '
  'Set-once (setUserGenderIfAbsent). NAO health, NAO lifestyle, NAO sexualOrientation, NAO biologicalSex.';

COMMIT;

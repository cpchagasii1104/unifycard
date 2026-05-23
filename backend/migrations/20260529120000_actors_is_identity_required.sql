-- Métrica A2 (reconciliação): só actors "humanos" para os quais a identidade civil
-- é exigida pelo negócio. Ver PLANO_IDENTITY_RECONCILIATION.md §2.1.
BEGIN;

ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS is_identity_required BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN actors.is_identity_required IS
  'Se false, o actor não entra na métrica A2 (sem obrigação de global_user_id). Default true = comportamento legado até CP-5.';

COMMIT;

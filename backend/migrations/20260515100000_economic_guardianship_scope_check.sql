-- Dívida DDL (plano §1B): domínio canónico para economic_guardianship.scope.
-- Valores: hoje só 'full' em dados legados; reservar extensões documentadas sem libertar texto livre.
BEGIN;

ALTER TABLE economic_guardianship
  DROP CONSTRAINT IF EXISTS economic_guardianship_scope_chk;

ALTER TABLE economic_guardianship
  ADD CONSTRAINT economic_guardianship_scope_chk
  CHECK (scope IN ('full', 'limited', 'custom'));

COMMENT ON COLUMN economic_guardianship.scope IS
  'Âmbito da tutela; valores canónicos: full | limited | custom. Alinhar a norma antes de novos valores.';

COMMIT;

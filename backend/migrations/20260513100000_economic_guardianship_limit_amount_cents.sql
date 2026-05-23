-- Correcção normativa: economic_guardianship — minor units inteiras (§4.7 / §19.2).
-- Não altera migrations anteriores. Substitui limit_amount NUMERIC por limit_amount_cents BIGINT.
--
-- Backfill: o código (authority-decision.service) compara o valor da coluna a amountCents sem *100;
-- portanto o NUMERIC legado deve ser interpretado como já em centavos (arredondado para bigint).
-- Se existir dado legado em unidade principal, corrigir manualmente antes ou após este passo.

BEGIN;

ALTER TABLE economic_guardianship
  ADD COLUMN IF NOT EXISTS limit_amount_cents BIGINT;

UPDATE economic_guardianship
SET limit_amount_cents = ROUND(limit_amount)::bigint
WHERE limit_amount_cents IS NULL;

-- Tabela vazia: coluna fica NOT NULL sem linhas; com linhas: UPDATE preenche a partir de limit_amount
ALTER TABLE economic_guardianship
  ALTER COLUMN limit_amount_cents SET NOT NULL;

ALTER TABLE economic_guardianship
  DROP CONSTRAINT IF EXISTS chk_economic_guardianship_limit_amount_cents_positive;

ALTER TABLE economic_guardianship
  ADD CONSTRAINT chk_economic_guardianship_limit_amount_cents_positive
  CHECK (limit_amount_cents > 0);

ALTER TABLE economic_guardianship
  DROP COLUMN IF EXISTS limit_amount;

COMMENT ON COLUMN economic_guardianship.limit_amount_cents IS
  'Teto por transação em centavos (minor units), alinhado ao ledger (amount_cents).';

COMMENT ON TABLE economic_guardianship IS
  'SSOT de responsabilidade econômica (GUARDA). Alinhado a docs/01_normative/SSOT_REGISTRY_UNIFICARD.md §Guarda. '
  'Sem linha ativa = NO_ACTIVE_GUARDIANSHIP (não bloqueia). '
  'Com linha = aplica teto limit_amount_cents (minor units) por transação.';

COMMIT;

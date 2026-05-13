-- DECISION-0036 — bank_splits migra para target_account_id (refactor account-centric)
--
-- Contexto material:
--   bank_splits originalmente modelava apenas fluxos actor→actor (schema 0003_bank_core.sql).
--   Evolução do runtime introduziu destinos account-centric sistêmicos (fee/regional_fund/
--   reserve via split engine event_ticket) não representáveis pelo schema original.
--   3 consumers (transparency.service:441, economic-overview.projector:18, reporting-
--   bank-aggregates) já leem por target_account_id (coluna inexistente até esta migration).
--
-- Premissa ontológica ratificada por DECISION-0036:
--   "Conta = destino financeiro soberano; actor = camada contextual/autoritativa."
--
-- Decisão sobre source_actor_id: invariante atorial preservada (NOT NULL → actors).
--   Source de split sempre nasce de autoria atorial (comprador/payer); system nunca
--   é source nesta versão (vide 4 evidências convergentes em DECISION-0036).
--
-- Audit pré-execução: 2 rows actor→actor revenue_share legítimas (mesmo tenant
--   fbe13b78, target_actor 475a7d45 com 1 bank_account única cf544aaa).
--   Backfill determinístico 1:1 sem ambiguidade.

BEGIN;

-- Statement 1: adicionar target_account_id NULLABLE (durante backfill)
ALTER TABLE bank_splits
  ADD COLUMN target_account_id UUID REFERENCES bank_accounts(id);

-- Statement 2: tornar target_actor_id NULLABLE (preserva FK historical; permite
-- destinos system sem actor — fee/regional_fund/reserve)
ALTER TABLE bank_splits
  ALTER COLUMN target_actor_id DROP NOT NULL;

-- Statement 3: backfill determinístico das rows actor→actor existentes
-- Política especificada (DECISION-0036):
--   - JOIN canônico ba.actor_id = bs.target_actor_id (mapeamento actor→primary account)
--   - Múltiplas accounts por actor: NÃO aplicável às rows atuais (verificado pré-migration)
--   - Fallback ba.owner_id = actor_id direto: NÃO aplicável (verificado pré-migration)
UPDATE bank_splits bs
   SET target_account_id = ba.id
  FROM bank_accounts ba
 WHERE ba.actor_id = bs.target_actor_id
   AND ba.tenant_id = bs.tenant_id
   AND bs.target_account_id IS NULL;

-- Statement 4: validação pós-backfill (zero rows com target_account_id NULL)
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM bank_splits WHERE target_account_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'bank_splits backfill incompleto: % rows com target_account_id NULL', null_count;
  END IF;
END $$;

-- Statement 5: tornar target_account_id NOT NULL após validação
ALTER TABLE bank_splits
  ALTER COLUMN target_account_id SET NOT NULL;

-- Statement 6: índice para queries dos consumers (transparency, economic-overview, reporting)
CREATE INDEX idx_bank_splits_target_account ON bank_splits(target_account_id);

COMMIT;

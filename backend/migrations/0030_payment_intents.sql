-- 0030_payment_intents.sql
-- Payment Intent Engine: liga eventos de gateway ao fluxo financeiro interno.
--
-- payment_intents já existe em 0004_marketplace.sql — esta migration é apenas evolutiva.
-- Evita 42P07 (relação já existe).

-- Colunas novas (gateway / referência / moeda); preenchimento seguro para linhas antigas.
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS reference_id TEXT;
UPDATE payment_intents SET reference_id = id::text WHERE reference_id IS NULL;
ALTER TABLE payment_intents ALTER COLUMN reference_id SET NOT NULL;

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS gateway TEXT;
UPDATE payment_intents SET gateway = 'unknown' WHERE gateway IS NULL;
ALTER TABLE payment_intents ALTER COLUMN gateway SET NOT NULL;

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS currency TEXT;
UPDATE payment_intents SET currency = 'BRL' WHERE currency IS NULL;
ALTER TABLE payment_intents ALTER COLUMN currency SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_tenant_reference
  ON payment_intents (tenant_id, reference_id);

CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant_status
  ON payment_intents (tenant_id, status);

COMMENT ON TABLE payment_intents IS 'Intenções de pagamento vinculadas a eventos de gateway; não altera bank_transactions nem bank_ledger.';

BEGIN;

-- C52 Passo 1c: coluna source = origem do fluxo de negócio
-- Separação semântica: gateway = provedor de pagamento, source = origem do fluxo
-- Ref: 07_NOMENCLATURA_CANONICA linha 1590
ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_payment_intents_source
  ON payment_intents(source)
  WHERE source IS NOT NULL;

COMMIT;

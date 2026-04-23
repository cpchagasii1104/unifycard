BEGIN;

-- C52 Passo 1b: normalizar valores para lowercase (07_NOMENCLATURA_CANONICA §4.11)
-- processing REMOVIDO: não consta em §4.11 canônico
-- Mapeamento: CREATED→pending, PENDING→pending, AUTHORIZED→authorized,
-- CAPTURED→captured, SETTLED→settled, FAILED→failed,
-- CANCELLED→cancelled, REVERSED→reversed, completed→settled

-- 1) Dropar constraint ANTES do UPDATE (constraint antiga bloqueia lowercase)
ALTER TABLE payment_intents
  DROP CONSTRAINT payment_intents_payment_status_check;

-- 2) Normalizar valores para lowercase
UPDATE payment_intents
SET payment_status = CASE payment_status
  WHEN 'CREATED'    THEN 'pending'
  WHEN 'PENDING'    THEN 'pending'
  WHEN 'AUTHORIZED' THEN 'authorized'
  WHEN 'CAPTURED'   THEN 'captured'
  WHEN 'SETTLED'    THEN 'settled'
  WHEN 'FAILED'     THEN 'failed'
  WHEN 'CANCELLED'  THEN 'cancelled'
  WHEN 'REVERSED'   THEN 'reversed'
  WHEN 'completed'  THEN 'settled'
  ELSE LOWER(payment_status)
END;

-- 3) Adicionar nova constraint com valores canônicos lowercase (§4.11)
-- processing excluído intencionalmente — não consta no padrão canônico
ALTER TABLE payment_intents
  ADD CONSTRAINT payment_intents_payment_status_check
  CHECK (payment_status IN (
    'pending', 'authorized', 'captured',
    'settled', 'failed', 'cancelled', 'reversed',
    'partially_refunded', 'disputed', 'expired'
  ));

COMMIT;

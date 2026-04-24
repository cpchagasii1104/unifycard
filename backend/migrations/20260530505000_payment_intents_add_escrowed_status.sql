BEGIN;

-- C52: adicionar 'escrowed' ao CHECK constraint de payment_status
-- Necessário para listEscrowedPaymentIntents e claimEscrowedPaymentIntents no Writer B
ALTER TABLE payment_intents
  DROP CONSTRAINT payment_intents_payment_status_check;

ALTER TABLE payment_intents
  ADD CONSTRAINT payment_intents_payment_status_check
  CHECK (payment_status IN (
    'pending', 'authorized', 'captured', 'escrowed',
    'settled', 'failed', 'cancelled', 'reversed',
    'partially_refunded', 'disputed', 'expired'
  ));

COMMIT;

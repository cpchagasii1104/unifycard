BEGIN;

ALTER TABLE b2b_payment_intents
  ADD CONSTRAINT uidx_b2b_payment_intents_order UNIQUE (b2b_order_id);

COMMIT;

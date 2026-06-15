-- Migration: service_payment_requests_fk_index
-- F-C1-MONEY-SPR-SCHEMA-INTEGRITY-FK-INDEX (ONDA DECISION-0131 · C1_MONEY · DT-SPR-READ-AUTHORITY-RESIDUES R3)
--
-- Integridade material mínima de service_payment_requests, SEM mudar semântica de runtime:
--   (1) FK payer_actor_id  -> actors(id)
--   (2) FK receiver_actor_id -> actors(id)
--   (3) índice (tenant_id, payer_actor_id)
--   (4) índice (tenant_id, receiver_actor_id)
-- Forward-only · idempotente (guard DO-block p/ FK; IF NOT EXISTS p/ índice) · SEM DROP · SEM alterar dados/
-- status/lifecycle · SEM RLS/policy · SEM trigger · SEM mexer em `amount`/naming. Os índices (tenant_id,booking_id)
-- e (tenant_id,service_id) JÁ EXISTEM (idx_service_payment_requests_tenant_{booking,service}) e NÃO são recriados.
-- READ-FIRST provou: 0 FK existentes, 0 órfãos (payer/receiver), tipos uuid compatíveis com actors.id (PK).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_payment_requests_payer_actor') THEN
    ALTER TABLE service_payment_requests
      ADD CONSTRAINT fk_service_payment_requests_payer_actor
      FOREIGN KEY (payer_actor_id) REFERENCES actors(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_payment_requests_receiver_actor') THEN
    ALTER TABLE service_payment_requests
      ADD CONSTRAINT fk_service_payment_requests_receiver_actor
      FOREIGN KEY (receiver_actor_id) REFERENCES actors(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_payment_requests_tenant_payer
  ON service_payment_requests (tenant_id, payer_actor_id);

CREATE INDEX IF NOT EXISTS idx_service_payment_requests_tenant_receiver
  ON service_payment_requests (tenant_id, receiver_actor_id);

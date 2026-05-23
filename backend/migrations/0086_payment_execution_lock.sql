-- 0086_payment_execution_lock.sql
-- Trava física de execução para fluxos críticos (settlement).
-- Forward-only: criar novo artefato sem alterar migrations anteriores.

BEGIN;

CREATE TABLE payment_execution_lock (
  reference_id UUID NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reference_id, type)
);

COMMIT;

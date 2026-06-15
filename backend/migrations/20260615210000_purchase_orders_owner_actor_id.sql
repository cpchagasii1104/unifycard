-- Migration: purchase_orders_owner_actor_id
-- F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING (ONDA DECISION-0131 · C1_MONEY · DT-PO-RECEIVE-COMPANY-OWNER-PENDING)
--
-- Decisão Clayton: purchase_order ganha OWNER EMPRESARIAL MATERIAL via `owner_actor_id` = actor operacional da
-- empresa COMPRADORA (lado comprador). NÃO é supplier, NÃO é created_by_actor_id (autoria), NÃO é tenant inteiro.
-- O actor operacional de empresa, no vocabulário vivo/normativo (§4.38), é `actor_type='page' AND company_id IS NOT NULL`
-- (a validação organizacional é app-level nesta frente; aqui a FK garante só que aponta p/ um actor existente).
-- Forward-only · idempotente · SEM company_id · SEM received_by_actor_id · SEM RLS · SEM trigger · SEM alterar
-- created_by_actor_id/supplier_id/status/lifecycle · SEM tocar inventory/AP/Bank.
-- READ-FIRST provou: purchase_orders existe, row_count=0 (NOT NULL seguro; o create passa a setar no mesmo commit),
-- owner_actor_id ausente, actors.id uuid (PK).

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS owner_actor_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchase_orders_owner_actor') THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT fk_purchase_orders_owner_actor
      FOREIGN KEY (owner_actor_id) REFERENCES actors(id);
  END IF;
END $$;

-- row_count=0 → SET NOT NULL é seguro. Se houvesse linha sem owner, falharia (fail-closed correto; sem backfill).
ALTER TABLE purchase_orders ALTER COLUMN owner_actor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_owner
  ON purchase_orders (tenant_id, owner_actor_id);

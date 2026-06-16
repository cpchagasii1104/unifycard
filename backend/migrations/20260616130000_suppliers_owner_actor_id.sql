-- Migration: suppliers_owner_actor_id
-- F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING (materializa DECISION-0133)
--
-- Decisão Clayton (DECISION-0133): supplier é cadastro INSTITUCIONAL da empresa. Owner canônico =
-- `owner_actor_id` = actor operacional da empresa dona (`actor_type='page' AND company_id IS NOT NULL`, §4.38).
-- NÃO é created_by_actor_id (autoria), NÃO é created_by_user_id, NÃO é tenant (escopo), NÃO é supplier_id.
-- Espelha purchase_orders.owner_actor_id. A validação organizacional (page/company) é app-level nesta frente
-- (DT-SUPPLIERS-OWNER-ORG-ACTOR-DB-CONSTRAINT-HARDENING, OPEN); aqui a FK garante só que aponta p/ um actor existente.
-- Forward-only · idempotente · SEM alterar created_by_actor_id/created_by_user_id/tenant_id/status ·
-- SEM tocar purchase_orders.supplier_id · SEM RLS.
-- READ-FIRST provou (dev 389): suppliers existe, row_count=0 (NOT NULL seguro; create passa a setar no mesmo
-- commit), owner_actor_id ausente, actors.id uuid (PK).

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS owner_actor_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_suppliers_owner_actor') THEN
    ALTER TABLE suppliers
      ADD CONSTRAINT fk_suppliers_owner_actor
      FOREIGN KEY (owner_actor_id) REFERENCES actors(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- row_count=0 → SET NOT NULL é seguro. Se houvesse linha sem owner, falharia (fail-closed correto; sem backfill).
ALTER TABLE suppliers ALTER COLUMN owner_actor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_owner
  ON suppliers (tenant_id, owner_actor_id);

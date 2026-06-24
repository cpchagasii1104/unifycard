-- 20260624120000_rentable_resource_substrate.sql
-- 🔴 DECISION-0151 — F-RENTAL-RESOURCE-CORE FASE 2a: SUBSTRATO de locação (recurso específico bloqueado no tempo).
--
-- Locação = RECURSO bloqueado no tempo (DECISION-0151 Opção B). Esta fatia cria APENAS o registro do recurso +
-- estende o vocabulário canônico de availability.owner_type — SEM booking de rental, SEM exclusividade prometida
-- (a exclusividade por resource_id BLOQUEANTE é FASE 2b; até lá o booking de rental é fail-closed no service).
--   • rentable_resources = REGISTRO do recurso (NÃO produto/estoque/oferta financeira).
--   • concept_id = SSOT semântico do recurso (CONCEPT soberano; categoria = navegação opcional, nunca identidade).
--   • owner_actor_id = autoridade operacional/econômica (resolver polimórfico de availability lê daqui).
--   • availability segue SSOT temporal (sem agenda/booking/estoque/ledger paralelos).
-- HOLD (fora desta fatia e fora do MVP pré-money): caução/multa/late-fee/no-show/checkout/order/payment/payout/escrow/bank_*.
-- Forward-only; idempotente.

BEGIN;

-- 1) Registro do recurso alugável. SEM coluna financeira (se aparecer, é violação da DECISION-0151).
CREATE TABLE IF NOT EXISTS rentable_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  owner_actor_id  UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,        -- autoridade operacional do recurso
  concept_id      UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE RESTRICT, -- SSOT semântico (significado)
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('equipment', 'vehicle', 'property', 'space', 'other')),
  label           TEXT NOT NULL,
  description     TEXT NULL,
  category_id     UUID NULL REFERENCES categories(category_id) ON DELETE SET NULL, -- navegação opcional, NUNCA identidade
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'retired')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rentable_resources_tenant_owner ON rentable_resources (tenant_id, owner_actor_id);
CREATE INDEX IF NOT EXISTS idx_rentable_resources_tenant_concept ON rentable_resources (tenant_id, concept_id);

-- RLS + FORCE (padrão do projeto — isolamento por tenant via app.current_tenant).
ALTER TABLE rentable_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentable_resources FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rentable_resources' AND policyname = 'rentable_resources_tenant_isolation'
  ) THEN
    CREATE POLICY rentable_resources_tenant_isolation ON rentable_resources
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
  END IF;
END $$;

-- 2) availability.owner_type += 'rentable_resource' (forward-only; ESPELHA o enum AvailabilityOwnerType —
--    não alterar um sem o outro; o resolver polimórfico de autoridade vigia a cobertura).
DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad FROM availability
   WHERE owner_type NOT IN ('user', 'service', 'event', 'group', 'page', 'service_offering', 'rentable_resource');
  IF bad > 0 THEN
    RAISE EXCEPTION 'rentable_resource_substrate: % linhas de availability com owner_type fora do vocabulário — abortando.', bad;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_availability_owner_type') THEN
    ALTER TABLE availability DROP CONSTRAINT chk_availability_owner_type;
  END IF;
  ALTER TABLE availability ADD CONSTRAINT chk_availability_owner_type
    CHECK (owner_type IN ('user', 'service', 'event', 'group', 'page', 'service_offering', 'rentable_resource'));
END $$;

COMMIT;

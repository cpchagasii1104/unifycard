-- Tabela `services` (domínio de ofertas de serviço) — pré-requisito de service_discovery e do repositório TS.
-- Idempotente; alinhada a `services.repository` / `services.types` (sem depender do archive 0565).

BEGIN;

CREATE TABLE IF NOT EXISTS services (
  service_id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  service_type TEXT NOT NULL DEFAULT 'service'
    CHECK (service_type IN ('service', 'rental', 'event', 'job')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused')),
  category_id UUID,
  price_cents INTEGER,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  pricing_type VARCHAR(50),
  country_id UUID,
  state_id UUID,
  city_id UUID,
  neighborhood VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  CONSTRAINT services_unique_slug_per_actor UNIQUE (tenant_id, actor_id, slug),
  CONSTRAINT services_price_positive CHECK (price_cents IS NULL OR price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_services_actor_id ON services (actor_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services (tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services (category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_city_id ON services (city_id) WHERE city_id IS NOT NULL;

COMMENT ON TABLE services IS
  'Oferta de serviço por actor (MVP CORE); usada por descoberta e por service_discovery_requests.service_id.';

-- FK opcional para categories (só se a tabela existir neste perfil de migração).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'categories'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_category_id_fkey'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories (category_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

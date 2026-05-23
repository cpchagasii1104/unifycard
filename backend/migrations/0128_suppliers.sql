-- 0128: suppliers (fornecedores — tenant-scoped, RLS)

BEGIN;

CREATE TABLE suppliers (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  name                   TEXT        NOT NULL,
  code                   VARCHAR(100),
  email                  TEXT,
  phone                  TEXT,
  contact_name           TEXT,
  address                TEXT,
  city                   TEXT,
  state                  TEXT,
  zip_code               VARCHAR(20),
  country                VARCHAR(10),
  tax_id                 VARCHAR(50),
  registration_number    VARCHAR(100),
  status                 TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_by_actor_id    UUID        NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  created_by_user_id     UUID,
  metadata               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uidx_suppliers_code UNIQUE (tenant_id, code)
);

CREATE INDEX idx_suppliers_tenant ON suppliers (tenant_id);
CREATE INDEX idx_suppliers_status ON suppliers (tenant_id, status);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_rls ON suppliers
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION suppliers_bump_updated_at()
RETURNS TRIGGER SET search_path = pg_catalog, pg_temp LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION suppliers_bump_updated_at();

COMMIT;

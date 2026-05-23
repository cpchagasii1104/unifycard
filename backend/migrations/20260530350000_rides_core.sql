BEGIN;

CREATE TABLE IF NOT EXISTS rides_drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','inactive')),
  level TEXT NOT NULL DEFAULT 'standard'
    CHECK (level IN ('standard','silver','gold','platinum')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rides_drivers UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rides_drivers_tenant ON rides_drivers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rides_drivers_user ON rides_drivers(user_id);

CREATE TABLE IF NOT EXISTS rides_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  driver_id UUID NOT NULL REFERENCES rides_drivers(id),
  plate TEXT NOT NULL,
  brand TEXT,
  model TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  category TEXT NOT NULL DEFAULT 'standard'
    CHECK (category IN ('standard','comfort','executive','moto','cargo')),
  service_type_id UUID,
  concept_id UUID,
  renavam TEXT,
  crlv_number TEXT,
  crlv_expires_at TIMESTAMPTZ,
  capacity INTEGER NOT NULL DEFAULT 4,
  photos JSONB NOT NULL DEFAULT '[]',
  features JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by_partner_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_vehicles_driver ON rides_vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_vehicles_tenant ON rides_vehicles(tenant_id);

COMMIT;

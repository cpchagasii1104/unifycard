-- Migration: create unified availability core tables

CREATE TABLE IF NOT EXISTS availability (
  availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  owner_type VARCHAR(30) NOT NULL,
  owner_id UUID NOT NULL,
  availability_type VARCHAR(30) NOT NULL DEFAULT 'fixed',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  capacity INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_tenant_owner
  ON availability (tenant_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_availability_tenant_window
  ON availability (tenant_id, start_datetime, end_datetime);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  availability_id UUID NOT NULL REFERENCES availability(availability_id) ON DELETE CASCADE,
  requester_actor_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'requested',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  requestedat TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  confirmedat TIMESTAMPTZ,
  cancelledat TIMESTAMPTZ,
  expiredat TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant_availability
  ON bookings (tenant_id, availability_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_requester
  ON bookings (tenant_id, requester_actor_id);

CREATE TABLE IF NOT EXISTS availability_participants (
  participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  availability_id UUID NOT NULL REFERENCES availability(availability_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  role VARCHAR(30) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_participants_tenant
  ON availability_participants (tenant_id, availability_id);

CREATE OR REPLACE FUNCTION detect_availability_conflicts(
  p_tenant_id UUID,
  p_availability_id UUID,
  p_actor_id UUID
)
RETURNS TABLE (
  conflict_availability_id UUID,
  conflict_start_datetime TIMESTAMPTZ,
  conflict_end_datetime TIMESTAMPTZ,
  conflict_owner_type TEXT,
  conflict_owner_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN;
END;
$$;

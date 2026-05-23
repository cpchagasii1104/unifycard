-- Migration: create service booking decision and payment request tables

CREATE TABLE IF NOT EXISTS service_booking_decisions (
  decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  decided_by_actor_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_service_booking_decisions_tenant_booking
  ON service_booking_decisions (tenant_id, booking_id);

CREATE TABLE IF NOT EXISTS service_payment_requests (
  payment_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  service_id UUID NOT NULL,
  payer_actor_id UUID NOT NULL,
  receiver_actor_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  amount BIGINT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'FIC',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_service_payment_requests_tenant_booking
  ON service_payment_requests (tenant_id, booking_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_requests_tenant_service
  ON service_payment_requests (tenant_id, service_id);

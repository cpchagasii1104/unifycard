BEGIN;

CREATE TABLE IF NOT EXISTS event_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_type TEXT NOT NULL,
  price_cents BIGINT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  quantity_total INTEGER NOT NULL CHECK (quantity_total > 0),
  quantity_available INTEGER NOT NULL,
  created_by_actor_id UUID REFERENCES actors(id),
  created_by_user_id UUID REFERENCES users(user_id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

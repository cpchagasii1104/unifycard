BEGIN;

CREATE TABLE IF NOT EXISTS event_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES events(id),
  attendee_actor_id UUID NOT NULL REFERENCES actors(id),
  checked_in_by_actor_id UUID REFERENCES actors(id),
  ticket_id UUID REFERENCES event_tickets(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_event_checkins_event ON event_checkins(event_id);
CREATE INDEX IF NOT EXISTS idx_event_checkins_attendee ON event_checkins(attendee_actor_id);

CREATE TABLE IF NOT EXISTS event_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES events(id),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON event_sessions(event_id);

CREATE TABLE IF NOT EXISTS event_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES events(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  session_id UUID REFERENCES event_sessions(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','cancelled','expired')),
  expires_at TIMESTAMPTZ,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_reservations_event ON event_reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reservations_actor ON event_reservations(actor_id);

CREATE TABLE IF NOT EXISTS event_consumptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES events(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  item_type TEXT NOT NULL,
  item_id UUID,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_event_consumptions_event ON event_consumptions(event_id);

CREATE TABLE IF NOT EXISTS event_occupancy_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES events(id),
  total_capacity INTEGER NOT NULL DEFAULT 0,
  sold_count INTEGER NOT NULL DEFAULT 0,
  reserved_count INTEGER NOT NULL DEFAULT 0,
  checked_in_count INTEGER NOT NULL DEFAULT 0,
  is_sold_out BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_occupancy UNIQUE (tenant_id, event_id)
);

CREATE TABLE IF NOT EXISTS event_organizer_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  organizer_id UUID NOT NULL REFERENCES event_organizers(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','member','viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_organizer_member UNIQUE (organizer_id, actor_id)
);

CREATE TABLE IF NOT EXISTS group_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  group_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_event UNIQUE (group_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_group_events_group ON group_events(group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_event ON group_events(event_id);

CREATE TABLE IF NOT EXISTS ticket_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES events(id),
  ticket_id UUID NOT NULL REFERENCES event_tickets(id),
  buyer_actor_id UUID NOT NULL REFERENCES actors(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents BIGINT NOT NULL,
  total_price_cents BIGINT NOT NULL,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','refunded','failed')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ticket_sales_event ON ticket_sales(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sales_buyer ON ticket_sales(buyer_actor_id);

CREATE TABLE IF NOT EXISTS organizer_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  organizer_id UUID NOT NULL REFERENCES event_organizers(id),
  plan_id UUID,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','cancelled','expired','trial')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_organizer_subs_organizer ON organizer_subscriptions(organizer_id);

COMMIT;

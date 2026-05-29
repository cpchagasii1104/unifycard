-- F-MIGRATION-REBUILD-PACKAGES Pacote 1
-- Backdated CREATE do bloco availability (availability + bookings + availability_participants)
-- para que o REVOKE/RENAME de 20260428xxxxxx (timestamps históricos anteriores) rodem
-- contra tabelas existentes no rebuild do zero.
--
-- Idempotência: todos os statements usam IF NOT EXISTS. No banco vivo (já tem essas tabelas
-- com colunas MODERNAS) é no-op total. No rebuild zero cria a base mínima; original
-- 20260530491000 fica no-op via IF NOT EXISTS; CHECKs vêm de 20260530535000 sem conflito.
--
-- bookings nasce com NOMES MODERNOS (requested_at, confirmed_at, cancelled_at, expired_at,
-- checked_in_at, checked_out_at) — reflete o estado real do banco vivo. RENAMEs guarded
-- em 20260428260000 viram no-op seguro (IF EXISTS column 'requestedat' = FALSE).

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
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  checked_out_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
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

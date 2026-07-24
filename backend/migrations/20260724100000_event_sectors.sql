-- 20260724100000_event_sectors.sql
-- SLICE S3 (SETORES) do arco "evento em si" — SETOR SELF-CONTAINED de bilheteria estádio-style.
--
-- Um evento estilo-estádio tem SETORES enumerados 1..N. Cada setor = uma subdivisão de pool COMPARTILHADO
-- com um preço INTEIRA (cheio) e um preço MEIA legalmente pisado. O setor é SELF-CONTAINED — NÃO é uma
-- linha extra em event_tickets (o eixo event_tickets.ticket_type é ZONA GENERAL/VIP/BACKSTAGE, ORTOGONAL a
-- inteira/meia; sobrecarregá-lo conflataria dois eixos). Por isso event_tickets fica INTOCADO.
--
-- Bank-free: inteira_price_cents/meia_price_cents são valores DECLARADOS de catálogo (Δbank=0). A VENDA, o
-- check de elegibilidade da meia (estudante/PCD/idoso/CadÚnico) e o decremento do pool = PORTA-01 (Fatia 2),
-- FORA — ZERO token bank/porta-01/ledger/sale nesta DDL.
--
-- O piso legal da MEIA (meia_quota_bps BETWEEN 4000 AND 10000 = 40%–100%) é HARD-LOCKED por lei
-- (Lei 12.933/2013 + Decreto 8.537/2015): a meia-entrada tem que cobrir NO MÍNIMO 40% da capacidade do setor.
-- Idempotente, aditiva, LF.

BEGIN;

CREATE TABLE IF NOT EXISTS event_sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_id UUID NOT NULL REFERENCES events(id),
  sector_number INTEGER NOT NULL CHECK (sector_number > 0),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  -- pool COMPARTILHADO do setor. Nome canônico `capacity` (gêmeo de event_sessions.capacity),
  -- NUNCA total_capacity/sector_capacity.
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  -- piso legal da MEIA: 40%–100% da capacidade do setor. HARD-LOCKED (Lei 12.933/2013 + Decreto 8.537/2015).
  -- convenção _bps (gêmeo de trust_score_bps). O floor 4000 é a LEI e NUNCA pode descer.
  meia_quota_bps INTEGER NOT NULL DEFAULT 4000 CHECK (meia_quota_bps BETWEEN 4000 AND 10000),
  -- preço INTEIRA (cheio) DECLARADO. convenção <qualifier>_price_cents (gêmeo de ticket_price_cents).
  inteira_price_cents BIGINT NOT NULL CHECK (inteira_price_cents >= 0),
  -- preço MEIA DECLARADO. nunca maior que a inteira (chk abaixo).
  meia_price_cents BIGINT NOT NULL CHECK (meia_price_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- a meia nunca custa mais que a inteira.
  CONSTRAINT chk_event_sectors_meia_le_inteira CHECK (meia_price_cents <= inteira_price_cents),
  -- setores enumerados 1..N sem repetição por evento.
  CONSTRAINT uq_event_sectors_event_number UNIQUE (event_id, sector_number)
);

CREATE INDEX IF NOT EXISTS idx_event_sectors_tenant_event
  ON event_sectors (tenant_id, event_id);

COMMIT;

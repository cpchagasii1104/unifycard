-- 20260613160000_service_offering_canonical_binding.sql
-- F-SERVICE-OFFERING-CANONICAL-BINDING (DECISION-0122) — vínculo material NÃO-FINANCEIRO da OFERTA
-- comercial/agendável canônica (service_offerings) na cadeia decision/order. Quando a availability é
-- owner_type='service_offering', a oferta é o recurso canônico; service_id permanece legado/projeção
-- (NOT NULL preservado — Lei 4). NÃO toca Bank (LEI §4.6–4.7): tabelas operacionais sem saldo.
--
-- Provado seguro antes de aplicar: service_orders=0, service_booking_decisions=0 (dev) — zero backfill,
-- colunas NULLABLE aditivas. Forward-only (Lei 2). ADD COLUMN/CONSTRAINT sem IF NOT EXISTS (Lei 3 —
-- falha-deve-falhar): se já existir, a migration FALHA explicitamente.
--
-- 1) Oferta canônica na DECISÃO (audit trail decision -> offering).
ALTER TABLE service_booking_decisions
  ADD COLUMN service_offering_id uuid;
ALTER TABLE service_booking_decisions
  ADD CONSTRAINT service_booking_decisions_service_offering_id_fkey
  FOREIGN KEY (service_offering_id) REFERENCES service_offerings(id) ON DELETE SET NULL;
CREATE INDEX idx_service_booking_decisions_service_offering_id
  ON service_booking_decisions (tenant_id, service_offering_id)
  WHERE service_offering_id IS NOT NULL;

-- 2) Oferta canônica na ORDER (recurso comercial soberano quando offering-owned).
ALTER TABLE service_orders
  ADD COLUMN service_offering_id uuid;
ALTER TABLE service_orders
  ADD CONSTRAINT service_orders_service_offering_id_fkey
  FOREIGN KEY (service_offering_id) REFERENCES service_offerings(id) ON DELETE SET NULL;
CREATE INDEX idx_service_orders_service_offering_id
  ON service_orders (tenant_id, service_offering_id)
  WHERE service_offering_id IS NOT NULL;

-- 20260613150000_booking_order_canonical_binding_integrity.sql
-- F-BOOKING-ORDER-BINDING-CANONICAL — integridade estrutural NÃO-FINANCEIRA da cadeia
-- booking -> decision -> service_order. Materializa, no data-layer, a jurisdição já declarada
-- (DECISION-0021 / AUTHORITY_ENFORCEMENT_MODEL §8: availability é SSOT soberano; booking é
-- evento derivado). NÃO toca Bank / ledger / splits / dinheiro (LEI §4.6–4.7 respeitada):
-- service_orders/bookings são tabelas operacionais (sem coluna de saldo).
--
-- Provado seguro antes de aplicar: service_orders rows=0, bookings rows=0 (dev) — zero backfill,
-- zero linha inválida. Forward-only (Lei 2). Falha-deve-falhar: ADD CONSTRAINT sem IF NOT EXISTS
-- (Lei 3) — se houver dado incompatível, a migration FALHA explicitamente.
--
-- 1) Elo material order -> booking (antes: coluna solta sem FK).
ALTER TABLE service_orders
  ADD CONSTRAINT service_orders_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL;

-- 2) Anti-duplicidade: no máximo 1 service_order por booking (impede confused/duplicate order
--    em corrida — garantia estrutural que o check de aplicação sozinho não dá). Parcial porque
--    orders avulsas (createOrder sem booking) têm booking_id NULL e podem coexistir.
CREATE UNIQUE INDEX uidx_service_orders_booking_id
  ON service_orders (booking_id)
  WHERE booking_id IS NOT NULL;

-- 3) Elo material order -> decision (antes: coluna solta sem FK).
ALTER TABLE service_orders
  ADD CONSTRAINT service_orders_decision_id_fkey
  FOREIGN KEY (decision_id) REFERENCES service_booking_decisions(decision_id) ON DELETE SET NULL;

-- 4) Elo material booking -> actor solicitante (antes: requester_actor_id NOT NULL sem FK).
--    CASCADE alinhado às demais FKs de actor em service_orders (customer/worker/created_by).
ALTER TABLE bookings
  ADD CONSTRAINT bookings_requester_actor_id_fkey
  FOREIGN KEY (requester_actor_id) REFERENCES actors(id) ON DELETE CASCADE;

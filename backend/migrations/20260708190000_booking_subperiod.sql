-- 20260708190000: RESERVA CONSOME SUBPERÍODO (correção conceitual Clayton 2026-07-08).
-- "Disponibilidade macro é oferta de tempo; reserva confirmada é consumo de um subperíodo;
--  disponibilidade projetada é calculada pelo backend."
-- Hoje o booking HERDA a janela inteira (availability.start/end) → reservar um carro de uma janela de
-- 30 dias reservava os 30 dias. Estas colunas dão à reserva um subintervalo PRÓPRIO dentro da janela.
-- Nullable: bookings de outros domínios (serviço/evento) que não usam subperíodo caem no COALESCE com a
-- janela (comportamento preservado). Forward-only. Δbank=0 (nada financeiro).
BEGIN;
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booked_start_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booked_end_datetime TIMESTAMPTZ,
  ADD CONSTRAINT chk_booking_subperiod_order
    CHECK (booked_start_datetime IS NULL OR booked_end_datetime IS NULL OR booked_end_datetime > booked_start_datetime);
COMMIT;

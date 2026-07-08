-- 20260708180000: política de ENTREGA/DEVOLUÇÃO da locação (handoff). Decisão Clayton 2026-07-08.
-- Separa LOCAL BASE (addresses/address_assignments — inalterado) da LOGÍSTICA (atributo da OFERTA).
-- Duas pernas governadas: como o recurso SAI (para o cliente) e como VOLTA (para o dono).
--   start_handoff_method: renter_pickup (cliente retira) | owner_delivery (dono entrega) | to_be_arranged
--   end_handoff_method:   renter_return (cliente devolve) | owner_collection (dono busca) | to_be_arranged
-- Taxas ANUNCIADAS em cents/BIGINT (NUNCA reais/float). PRÉ-DINHEIRO: é anúncio/termo — cobrança real,
-- caução, contrato = PORTA-1 (Δbank=0). delivery_radius_km limita a área de entrega (elegibilidade
-- calculada no backend por haversine). Forward-only.
BEGIN;
ALTER TABLE rentable_resources
  ADD COLUMN IF NOT EXISTS start_handoff_method TEXT NOT NULL DEFAULT 'renter_pickup'
    CHECK (start_handoff_method IN ('renter_pickup', 'owner_delivery', 'to_be_arranged')),
  ADD COLUMN IF NOT EXISTS end_handoff_method TEXT NOT NULL DEFAULT 'renter_return'
    CHECK (end_handoff_method IN ('renter_return', 'owner_collection', 'to_be_arranged')),
  ADD COLUMN IF NOT EXISTS delivery_radius_km INTEGER
    CHECK (delivery_radius_km IS NULL OR delivery_radius_km > 0),
  ADD COLUMN IF NOT EXISTS delivery_fee_cents BIGINT
    CHECK (delivery_fee_cents IS NULL OR delivery_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS collection_fee_cents BIGINT
    CHECK (collection_fee_cents IS NULL OR collection_fee_cents >= 0);
COMMIT;

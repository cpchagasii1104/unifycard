-- 20260708220000: POLÍTICA DE QUILOMETRAGEM de veículo em locação (F-RENTAL-VEHICLE-MILEAGE-POLICY,
-- GO Clayton 2026-07-08). Quilometragem é atributo da OFERTA de locação do VEÍCULO (preço/disponibilidade/
-- handoff/km), NÃO do catálogo (marca/modelo/ano/ficha). Só vehicle. Δbank=0 — taxa ANUNCIADA, não
-- cobrança real (extra_km_fee_cents é vitrine; nada financeiro executa). Forward-only.
--
-- mileage_policy: unlimited | limited | to_be_arranged.
--   · limited exige included_km_per_day (km/dia incluído); included_km_total opcional; extra_km_fee_cents opcional (excedente anunciado).
--   · unlimited/to_be_arranged: sem km incluído nem taxa.
-- Banco é a ÚLTIMA linha (o service valida antes com mensagem amigável).
BEGIN;

ALTER TABLE rentable_resources
  ADD COLUMN IF NOT EXISTS mileage_policy TEXT,
  ADD COLUMN IF NOT EXISTS included_km_per_day INTEGER,
  ADD COLUMN IF NOT EXISTS included_km_total INTEGER,
  ADD COLUMN IF NOT EXISTS extra_km_fee_cents BIGINT;

-- valor governado da política
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_mileage_policy_value
  CHECK (mileage_policy IS NULL OR mileage_policy IN ('unlimited', 'limited', 'to_be_arranged'));

-- (A) quilometragem SÓ para veículo — não-veículo não pode ter policy nem campos de km/taxa.
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_mileage_vehicle_only
  CHECK (
    resource_type = 'vehicle'
    OR (mileage_policy IS NULL AND included_km_per_day IS NULL AND included_km_total IS NULL AND extra_km_fee_cents IS NULL)
  );

-- (B) km incluído / taxa de excedente SÓ fazem sentido em 'limited'.
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_mileage_limited_fields_only
  CHECK (
    mileage_policy = 'limited'
    OR (included_km_per_day IS NULL AND included_km_total IS NULL AND extra_km_fee_cents IS NULL)
  );

-- (C) 'limited' EXIGE km/dia incluído (sem ele a política é vazia).
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_mileage_limited_requires_km
  CHECK (mileage_policy IS DISTINCT FROM 'limited' OR included_km_per_day IS NOT NULL);

-- (D) valores não-negativos (dinheiro em cents; km em unidades inteiras).
ALTER TABLE rentable_resources
  ADD CONSTRAINT chk_mileage_nonnegative
  CHECK (
    (included_km_per_day IS NULL OR included_km_per_day >= 0)
    AND (included_km_total IS NULL OR included_km_total >= 0)
    AND (extra_km_fee_cents IS NULL OR extra_km_fee_cents >= 0)
  );

COMMIT;

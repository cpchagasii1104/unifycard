-- 20260708240000: remove a constraint LEGADA uq_vehicle_model_spec UNIQUE(model_id, year, version).
-- Motivo: no catálogo consolidado (rico), a MESMA versão comercial ("Drive", "Volcano"...) tem
-- legitimamente múltiplas variantes distintas por motor/câmbio (ex.: Drive Manual vs Drive CVT). A
-- identidade real da variante é o vehicle_variant_id (ux_vehicle_model_specs_variant_id, já criado).
-- A unicidade por (model_id,year,version) rejeitava variantes válidas no import. variant_id passa a ser
-- a única chave de unicidade da variante. Forward-only. Δbank=0.
BEGIN;
ALTER TABLE vehicle_model_specs DROP CONSTRAINT IF EXISTS uq_vehicle_model_spec;
COMMIT;

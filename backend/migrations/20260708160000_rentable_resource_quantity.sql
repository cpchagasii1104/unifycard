-- 20260708160000: F-RENTAL-PRICING-QUANTITY-GEO-MVP Fase 3 — QUANTIDADE (único vs fungível).
-- quantity = unidades da OFERTA (carro=1; 100 cadeiras=100). Default 1. Veículo/imóvel/espaço travados
-- em 1 no backend (identidade única); equipamento pode >1. NÃO implementa reserva que consome estoque
-- (isso é PORTA-1). Forward-only.
BEGIN;
ALTER TABLE rentable_resources ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1
  CHECK (quantity >= 1);
COMMIT;

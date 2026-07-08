-- 20260707240000: F-VEHICLE-MODEL-YEAR-GOVERNED-RANGE. Governa ANOS VÁLIDOS por modelo de veículo.
-- A VERDADE do ano válido = existir linha aqui para o model_id. O CHECK global só impede absurdo
-- (não é a verdade). Sem country_code (catálogo atual não tem esse recorte). Forward-only.
-- Seed CONSERVADOR e revisável: ranges de alta confiança do mercado BR — pequeno e correto >
-- grande e falso. Modelo sem ano seguro NÃO é semeado (create aceita sem ano; rejeita ano inválido).
BEGIN;
CREATE TABLE IF NOT EXISTS vehicle_model_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND (EXTRACT(YEAR FROM now())::int + 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vehicle_model_year UNIQUE (model_id, year)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_model_years_model ON vehicle_model_years (model_id);

-- Seed: (slug do modelo, ano início, ano fim) — ranges defensáveis, reportados para revisão.
INSERT INTO vehicle_model_years (model_id, year)
SELECT m.id, gs.y
FROM (VALUES
  ('fusca', 1970, 1986), ('gol', 2015, 2023), ('fox', 2010, 2021), ('voyage', 2010, 2022),
  ('uno', 2015, 2021), ('palio', 2010, 2017), ('mobi', 2016, 2026), ('strada', 2015, 2026),
  ('onix', 2015, 2026), ('celta', 2005, 2015), ('prisma', 2010, 2019),
  ('civic', 2015, 2026), ('fit', 2015, 2021), ('corolla', 2015, 2026), ('hilux', 2015, 2026),
  ('ka', 2015, 2021), ('fiesta', 2010, 2019), ('hb20', 2015, 2026), ('creta', 2016, 2026),
  ('sandero', 2015, 2026), ('kwid', 2017, 2026),
  ('cg-160', 2015, 2026), ('factor', 2015, 2026), ('fazer', 2015, 2026)
) AS v(slug, y0, y1)
JOIN vehicle_models m ON m.slug = v.slug
CROSS JOIN LATERAL generate_series(v.y0, v.y1) AS gs(y)
ON CONFLICT (model_id, year) DO NOTHING;
COMMIT;

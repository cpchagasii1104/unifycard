-- 20260707190000: Catálogo de VEÍCULO (marca/modelo) — CAPACIDADE TRANSVERSAL (ARVORE.png:
-- "Catálogo" na copa, reutilizado por N setores), não SSOT semântico novo. CONCEPT ('carro',
-- 'motocicleta', 'van', 'caminhonete') continua sendo a identidade; marca/modelo são ATRIBUTOS
-- GOVERNADOS (materialização operacional, análoga a canonical_products — doc 18 §5.1.1) que
-- impedem texto livre duplicado entre rides/locação/venda/peças automotivas (achado Clayton).
-- Referência GLOBAL (sem tenant_id) — mesmo padrão de domains/n1_nodes.
BEGIN;
CREATE TABLE IF NOT EXISTS vehicle_makes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id UUID NOT NULL REFERENCES vehicle_makes(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vehicle_model_per_make UNIQUE (make_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_make ON vehicle_models(make_id);

INSERT INTO vehicle_makes (slug, name) VALUES
  ('volkswagen','Volkswagen'), ('fiat','Fiat'), ('chevrolet','Chevrolet'),
  ('honda','Honda'), ('toyota','Toyota'), ('yamaha','Yamaha'),
  ('ford','Ford'), ('renault','Renault'), ('hyundai','Hyundai')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO vehicle_models (make_id, slug, name)
SELECT m.id, v.slug, v.name FROM (VALUES
  ('volkswagen','fusca','Fusca'), ('volkswagen','gol','Gol'), ('volkswagen','fox','Fox'), ('volkswagen','voyage','Voyage'),
  ('fiat','uno','Uno'), ('fiat','palio','Palio'), ('fiat','mobi','Mobi'), ('fiat','strada','Strada'),
  ('chevrolet','onix','Onix'), ('chevrolet','celta','Celta'), ('chevrolet','prisma','Prisma'),
  ('honda','civic','Civic'), ('honda','cg-160','CG 160'), ('honda','fit','Fit'),
  ('toyota','corolla','Corolla'), ('toyota','hilux','Hilux'),
  ('yamaha','factor','Factor'), ('yamaha','fazer','Fazer'),
  ('ford','ka','Ka'), ('ford','fiesta','Fiesta'),
  ('renault','sandero','Sandero'), ('renault','kwid','Kwid'),
  ('hyundai','hb20','HB20'), ('hyundai','creta','Creta')
) AS v(make_slug, slug, name)
JOIN vehicle_makes m ON m.slug = v.make_slug
ON CONFLICT (make_id, slug) DO NOTHING;
COMMIT;

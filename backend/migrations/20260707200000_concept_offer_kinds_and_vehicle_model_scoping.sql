-- 20260707200000: fix Clayton+2ª IA — "lista curada" vira GOVERNANÇA real, não array hardcoded.
-- concept_offer_kinds: dimensão pequena e NOVA (não confundir com Authority/Capability §4.9 nem
-- CONTEXT formal) — responde "este concept pode ser OFERTADO de que modo comercial?" (hoje só
-- 'rentable'). Mata o vazamento motoboy/guincho/mudança dentro de 'Veículo' (eles são concepts de
-- mobilidade-e-logistica, mas NUNCA foram tagueados como alugáveis).
BEGIN;
CREATE TABLE IF NOT EXISTS concept_offer_kinds (
  concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
  offer_kind TEXT NOT NULL CHECK (offer_kind IN ('rentable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (concept_id, offer_kind)
);
INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT c.concept_id, 'rentable' FROM concepts c
WHERE c.slug IN ('carro','motocicleta','van','caminhonete',
                 'furadeira','betoneira','andaime','gerador','rocadeira','compressor-de-ar')
ON CONFLICT DO NOTHING;

-- vehicle_models ganha concept_id: modelo pertence a MARCA + TIPO (CG160 é moto, não carro,
-- mesmo sendo Honda) — fix do segundo achado real da 2ª IA.
ALTER TABLE vehicle_models ADD COLUMN IF NOT EXISTS concept_id UUID REFERENCES concepts(concept_id);
UPDATE vehicle_models SET concept_id = (SELECT concept_id FROM concepts WHERE slug = 'motocicleta')
 WHERE slug IN ('cg-160','factor','fazer') AND concept_id IS NULL;
UPDATE vehicle_models SET concept_id = (SELECT concept_id FROM concepts WHERE slug = 'carro')
 WHERE concept_id IS NULL;
ALTER TABLE vehicle_models ALTER COLUMN concept_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_models_concept ON vehicle_models(concept_id);
ALTER TABLE vehicle_models DROP CONSTRAINT IF EXISTS uq_vehicle_model_per_make;
ALTER TABLE vehicle_models ADD CONSTRAINT uq_vehicle_model_per_make_concept UNIQUE (make_id, concept_id, slug);

-- Ano: fato escalar, NÃO CONCEPT (sem ambiguidade semântica) — SSOT DE REFERÊNCIA = coluna
-- tipada com CHECK, nunca texto livre em jsonb (fix Clayton "90 vs 1990 vs 90'").
ALTER TABLE rentable_resources ADD COLUMN IF NOT EXISTS resource_year SMALLINT NULL
  CHECK (resource_year IS NULL OR resource_year BETWEEN 1900 AND (EXTRACT(YEAR FROM now())::int + 1));
COMMIT;

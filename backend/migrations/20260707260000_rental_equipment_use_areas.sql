-- 20260707260000: RFC-RENTAL-EQUIPMENT-USE-AREAS-MVP (Clayton 2026-07-07). Faceta GOVERNADA de USO
-- para descoberta de equipamentos alugáveis. NÃO toca N1/N2/CONTEXT, NÃO muda N0/identidade do concept.
-- Um equipamento mapeia para N áreas (many-to-many), sem duplicar CONCEPT. Forward-only, idempotente.
BEGIN;

CREATE TABLE IF NOT EXISTS rental_equipment_use_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rental_equipment_use_area_concepts (
  use_area_id UUID NOT NULL REFERENCES rental_equipment_use_areas(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER,
  PRIMARY KEY (use_area_id, concept_id)
);
CREATE INDEX IF NOT EXISTS idx_reuac_concept ON rental_equipment_use_area_concepts(concept_id);

-- 6 áreas iniciais (vocabulário governado).
INSERT INTO rental_equipment_use_areas (code, label, sort_order)
SELECT v.code, v.label, v.ord FROM (VALUES
  ('construction_reform','Construção e reforma',1),
  ('cleaning_conservation','Limpeza e conservação',2),
  ('gardening_land','Jardinagem e terreno',3),
  ('events_parties','Eventos e festas',4),
  ('audio_video_lighting','Áudio, vídeo e iluminação',5),
  ('energy_support','Energia e apoio',6)
) AS v(code, label, ord)
WHERE NOT EXISTS (SELECT 1 FROM rental_equipment_use_areas a WHERE a.code = v.code);

-- Mapeamento área↔concept (many-to-many, conservador). Um equipamento pode estar em várias áreas.
INSERT INTO rental_equipment_use_area_concepts (use_area_id, concept_id)
SELECT a.id, c.concept_id
FROM (VALUES
  -- Construção e reforma
  ('construction_reform','furadeira'), ('construction_reform','betoneira'), ('construction_reform','andaime'),
  ('construction_reform','martelete'), ('construction_reform','serra-marmore'), ('construction_reform','serra-circular'),
  ('construction_reform','compactador-de-solo'), ('construction_reform','compressor-de-ar'), ('construction_reform','escada-extensivel'),
  ('construction_reform','lavadora-alta-pressao'),
  -- Limpeza e conservação
  ('cleaning_conservation','lavadora-alta-pressao'), ('cleaning_conservation','aspirador-industrial'),
  ('cleaning_conservation','extratora'), ('cleaning_conservation','lavadora-de-piso'), ('cleaning_conservation','soprador'),
  -- Jardinagem e terreno
  ('gardening_land','rocadeira'), ('gardening_land','motosserra'), ('gardening_land','soprador'),
  ('gardening_land','cortador-de-grama'), ('gardening_land','lavadora-alta-pressao'),
  -- Eventos e festas
  ('events_parties','tenda'), ('events_parties','mesa-dobravel'), ('events_parties','cadeira-dobravel'),
  ('events_parties','caixa-de-som'), ('events_parties','microfone'), ('events_parties','projetor'),
  ('events_parties','torre-de-iluminacao'),
  -- Áudio, vídeo e iluminação
  ('audio_video_lighting','caixa-de-som'), ('audio_video_lighting','microfone'),
  ('audio_video_lighting','projetor'), ('audio_video_lighting','torre-de-iluminacao'),
  -- Energia e apoio
  ('energy_support','gerador'), ('energy_support','compressor-de-ar'), ('energy_support','torre-de-iluminacao'),
  ('energy_support','escada-extensivel')
) AS v(area_code, concept_slug)
JOIN rental_equipment_use_areas a ON a.code = v.area_code
JOIN concepts c ON c.slug = v.concept_slug
ON CONFLICT DO NOTHING;

COMMIT;

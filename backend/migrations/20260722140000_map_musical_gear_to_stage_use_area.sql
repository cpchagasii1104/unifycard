-- 20260722140000: EVENT-ENGINE-COMPLETION · C1c-a ADDENDUM — mapeia o GEAR MUSICAL semeado (20260722120000)
-- à use-area governada `audio_video_lighting` em rental_equipment_use_area_concepts. Estreita a governança do
-- facet de equipamento do performer: "equipamento do performer" = concept EM use-area de palco/áudio/evento
-- (audio_video_lighting ∪ events_parties), NÃO todo bem alugável (motosserra/lavadora ficam de fora). Espelha
-- o INSERT de 20260707260000 (JOIN slug→concept_id). O gear de áudio já mapeado (caixa-de-som/microfone/…)
-- NÃO é re-inserido. Aditiva/idempotente/forward-only. Δbank=0.
BEGIN;

INSERT INTO rental_equipment_use_area_concepts (use_area_id, concept_id)
SELECT a.id, c.concept_id
FROM (VALUES
  ('audio_video_lighting','guitarra'),
  ('audio_video_lighting','baixo'),
  ('audio_video_lighting','bateria'),
  ('audio_video_lighting','mesa-de-som'),
  ('audio_video_lighting','monitor-de-palco')
) AS v(area_code, concept_slug)
JOIN rental_equipment_use_areas a ON a.code = v.area_code
JOIN concepts c ON c.slug = v.concept_slug
ON CONFLICT DO NOTHING;

COMMIT;

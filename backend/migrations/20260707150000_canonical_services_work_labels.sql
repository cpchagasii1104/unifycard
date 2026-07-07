-- 20260707150000: tríade dos conceitos de TRABALHO (DECISION-0164 item 3 — labels PT no
-- catálogo, método BELEZA): canonical_services global (tenant NULL, scope global, active)
-- por concept. Extensão só por migration; dropdown projeta name, nunca slug cru.
BEGIN;
INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status)
SELECT NULL, 'global', c.concept_id, v.name, v.slug, 'active'
FROM (VALUES
  ('garcom',              'Garçom',                'garcom'),
  ('pedreiro',            'Pedreiro',              'pedreiro'),
  ('servente-demolicao',  'Servente de demolição', 'servente-de-demolicao'),
  ('encarregado-de-obra', 'Encarregado de obra',   'encarregado-de-obra'),
  ('seguranca-eventos',   'Segurança de eventos',  'seguranca-de-eventos'),
  ('cozinheiro',          'Cozinheiro',            'cozinheiro'),
  ('eletricista',         'Eletricista',           'eletricista'),
  ('encanador',           'Encanador',             'encanador'),
  ('motoboy',             'Motoboy',               'motoboy'),
  ('manicure',            'Manicure',              'manicure-profissional'),
  ('faxina-residencial',  'Faxina residencial',    'faxina-residencial-trabalho'),
  ('jardinagem',          'Jardinagem',            'jardinagem-trabalho')
) AS v(cslug, name, slug)
JOIN concepts c ON c.slug = v.cslug
WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.slug = v.slug AND cs.tenant_id IS NULL);
COMMIT;

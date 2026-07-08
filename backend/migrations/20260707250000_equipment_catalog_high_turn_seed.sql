-- 20260707250000: F-EQUIPMENT-CATALOG-HIGH-TURN-SEED (Clayton 2026-07-07). Popula o catálogo de
-- equipamentos de ALTO GIRO dentro do N0 JÁ CONGELADO 'produtos-e-comercio' + offer_kind='rentable'
-- — mesmo trilho governado dos 6 existentes (concepts + canonical_services + concept_offer_kinds).
-- NÃO cria N1/N2/CONTEXT nem "área de uso" (isso é navegação = RFC próprio, HOLD). CONCEPT = identidade:
-- cada equipamento é UMA verdade; o uso (construção/limpeza/eventos) é projeção futura, não vem aqui.
-- Itens de evento (tenda/mesa/cadeira/som/microfone/projetor/torre) são BENS alugáveis do comércio —
-- N0 produtos-e-comercio acolhe a IDENTIDADE; o uso "eventos" será faceta de navegação, não o N0.
-- Forward-only, idempotente (WHERE NOT EXISTS / ON CONFLICT). Auditoria: os 19 FALTAVAM (catálogo=6).
BEGIN;
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain)
SELECT v.slug, 'produtos-e-comercio' FROM (VALUES
  ('lavadora-alta-pressao'), ('aspirador-industrial'), ('extratora'), ('lavadora-de-piso'),
  ('motosserra'), ('soprador'), ('cortador-de-grama'), ('compactador-de-solo'),
  ('martelete'), ('serra-marmore'), ('serra-circular'), ('escada-extensivel'),
  ('tenda'), ('mesa-dobravel'), ('cadeira-dobravel'), ('caixa-de-som'),
  ('microfone'), ('projetor'), ('torre-de-iluminacao')
) AS v(slug)
WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status)
SELECT NULL, 'global', c.concept_id, v.name, v.cslug, 'active'
FROM (VALUES
  ('lavadora-alta-pressao','Lavadora de alta pressão','lavadora-alta-pressao-locacao'),
  ('aspirador-industrial','Aspirador industrial','aspirador-industrial-locacao'),
  ('extratora','Extratora','extratora-locacao'),
  ('lavadora-de-piso','Lavadora de piso','lavadora-de-piso-locacao'),
  ('motosserra','Motosserra','motosserra-locacao'),
  ('soprador','Soprador','soprador-locacao'),
  ('cortador-de-grama','Cortador de grama','cortador-de-grama-locacao'),
  ('compactador-de-solo','Compactador de solo','compactador-de-solo-locacao'),
  ('martelete','Martelete','martelete-locacao'),
  ('serra-marmore','Serra mármore','serra-marmore-locacao'),
  ('serra-circular','Serra circular','serra-circular-locacao'),
  ('escada-extensivel','Escada extensível','escada-extensivel-locacao'),
  ('tenda','Tenda','tenda-locacao'),
  ('mesa-dobravel','Mesa dobrável','mesa-dobravel-locacao'),
  ('cadeira-dobravel','Cadeira dobrável','cadeira-dobravel-locacao'),
  ('caixa-de-som','Caixa de som','caixa-de-som-locacao'),
  ('microfone','Microfone','microfone-locacao'),
  ('projetor','Projetor','projetor-locacao'),
  ('torre-de-iluminacao','Torre de iluminação','torre-de-iluminacao-locacao')
) AS v(cslug, name, slug)
JOIN concepts c ON c.slug = v.cslug
WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.slug = v.slug AND cs.tenant_id IS NULL);

INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT c.concept_id, 'rentable' FROM concepts c
WHERE c.slug IN (
  'lavadora-alta-pressao','aspirador-industrial','extratora','lavadora-de-piso','motosserra',
  'soprador','cortador-de-grama','compactador-de-solo','martelete','serra-marmore','serra-circular',
  'escada-extensivel','tenda','mesa-dobravel','cadeira-dobravel','caixa-de-som','microfone',
  'projetor','torre-de-iluminacao'
) ON CONFLICT DO NOTHING;
COMMIT;

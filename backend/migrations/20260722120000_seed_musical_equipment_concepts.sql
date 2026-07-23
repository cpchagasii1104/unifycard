-- 20260722120000: EVENT-ENGINE-COMPLETION · C1c-a — semeia o GEAR MUSICAL faltante no MESMO pool governado
-- de equipamento (padrão C1a / F-EQUIPMENT-CATALOG-HIGH-TURN-SEED 20260707250000): concepts em
-- domain='produtos-e-comercio' + canonical_services global + concept_offer_kinds='rentable'. É o pool que
-- identifica "equipamento governado" (domain='produtos-e-comercio' ∧ offer_kind='rentable'). NÃO cria
-- vocabulário paralelo; reusa os que já existem (caixa-de-som/microfone/projetor/torre-de-iluminacao já
-- estão no catálogo — NÃO re-semeados). Só o faltante. Sob app.concept_governance (Lei 7 / trigger 0075).
-- Forward-only, idempotente (NOT EXISTS / ON CONFLICT). Δbank=0.
BEGIN;
SELECT set_config('app.concept_governance', 'true', true);

-- (1) CONCEPTs (domain=produtos-e-comercio). Dedup por slug.
INSERT INTO concepts (slug, domain)
SELECT v.slug, 'produtos-e-comercio' FROM (VALUES
  ('guitarra'), ('baixo'), ('bateria'), ('mesa-de-som'), ('monitor-de-palco')
) AS v(slug)
WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

-- (2) canonical_service global (rótulo pt-BR) — statement SEPARADO (enxerga os concepts recém-criados).
INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status)
SELECT NULL, 'global', c.concept_id, v.name, v.cslug, 'active'
FROM (VALUES
  ('guitarra','Guitarra','guitarra-locacao'),
  ('baixo','Baixo','baixo-locacao'),
  ('bateria','Bateria','bateria-locacao'),
  ('mesa-de-som','Mesa de som','mesa-de-som-locacao'),
  ('monitor-de-palco','Monitor de palco','monitor-de-palco-locacao')
) AS v(cslug, name, slug)
JOIN concepts c ON c.slug = v.cslug
WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.slug = v.slug AND cs.tenant_id IS NULL);

-- (3) aplicabilidade offer_kind='rentable' — marcador do pool de equipamento (igual aos existentes).
INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT c.concept_id, 'rentable' FROM concepts c
WHERE c.slug IN ('guitarra','baixo','bateria','mesa-de-som','monitor-de-palco')
ON CONFLICT DO NOTHING;

COMMIT;

-- 20260707210000: N0 bens-imoveis RATIFICADO por Clayton (RFC_N0_IMOVEIS_E_PROPRIEDADES.md v2,
-- revisão externa + carimbo). Ordem exata da ratificação: N0 → N1 → Context → Concepts (tríade) →
-- Facets → Projection. NADA de N1/N2/Context substitui CONCEPT; eventos = context sobre
-- imoveis-comerciais, NÃO 4º N1 (doc 20 §2, mesma mecânica de alimentacao/supermercado-delivery).
BEGIN;

-- 1) N0
INSERT INTO domains (domain_key) VALUES ('bens-imoveis') ON CONFLICT (domain_key) DO NOTHING;

-- 2) N1 (governado)
SELECT set_config('app.n1_governance', 'true', true);
INSERT INTO n1_nodes (slug, domain_key, sort_order) VALUES
  ('imoveis-residenciais', 'bens-imoveis', 1),
  ('imoveis-comerciais', 'bens-imoveis', 2),
  ('terrenos-e-lotes', 'bens-imoveis', 3)
ON CONFLICT (slug, domain_key) DO NOTHING;

-- 3) Context 'eventos' (governado) — USO sobre imoveis-comerciais, não identidade nova
SELECT set_config('app.n2_governance', 'true', true);
INSERT INTO context_nodes (context_slug, domain_key) VALUES ('eventos', 'bens-imoveis')
ON CONFLICT (context_slug) DO NOTHING;

-- 4) N2 por N1 (navegação) — default (comercial tradicional) + eventos (mesmo N1, context diferente)
INSERT INTO n2_nodes (slug, n1_id, sort_order)
SELECT v.slug, n.n1_id, v.sort_order FROM (VALUES
  ('apartamento', 1), ('casa', 2), ('kitnet', 3), ('studio', 4), ('sobrado', 5)
) AS v(slug, sort_order)
JOIN n1_nodes n ON n.slug = 'imoveis-residenciais'
ON CONFLICT (slug, n1_id) DO NOTHING;

INSERT INTO n2_nodes (slug, n1_id, sort_order)
SELECT v.slug, n.n1_id, v.sort_order FROM (VALUES
  ('sala-comercial', 1), ('loja', 2), ('galpao', 3), ('escritorio', 4), ('consultorio', 5),
  ('salao-de-festas', 6), ('chacara', 7), ('sitio-eventos', 8)
) AS v(slug, sort_order)
JOIN n1_nodes n ON n.slug = 'imoveis-comerciais'
ON CONFLICT (slug, n1_id) DO NOTHING;

INSERT INTO n2_nodes (slug, n1_id, sort_order)
SELECT v.slug, n.n1_id, v.sort_order FROM (VALUES
  ('terreno-urbano', 1), ('terreno-rural', 2), ('lote', 3)
) AS v(slug, sort_order)
JOIN n1_nodes n ON n.slug = 'terrenos-e-lotes'
ON CONFLICT (slug, n1_id) DO NOTHING;

-- context_n2_mapping: 'eventos' ativa SÓ os 3 N2 de evento sobre imoveis-comerciais
INSERT INTO context_n2_mapping (context_id, n2_id, is_default, sort_order)
SELECT (SELECT context_id FROM context_nodes WHERE context_slug = 'eventos'), n2.n2_id, true, n2.sort_order
FROM n2_nodes n2 JOIN n1_nodes n1 ON n1.n1_id = n2.n1_id
WHERE n1.slug = 'imoveis-comerciais' AND n2.slug IN ('salao-de-festas', 'chacara', 'sitio-eventos')
ON CONFLICT (context_id, n2_id) DO NOTHING;

-- 5) Concepts (tríade) — identidade semântica (a régua: "o que É", não "como É")
SELECT set_config('app.concept_governance', 'true', true);
INSERT INTO concepts (slug, domain)
SELECT v.slug, 'bens-imoveis' FROM (VALUES
  ('apartamento'), ('casa'), ('kitnet'), ('studio'), ('sobrado'),
  ('sala-comercial'), ('loja'), ('galpao'), ('escritorio'), ('consultorio'),
  ('terreno-urbano'), ('terreno-rural'), ('lote')
) AS v(slug)
WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status)
SELECT NULL, 'global', c.concept_id, v.name, v.cslug, 'active'
FROM (VALUES
  ('apartamento','Apartamento','apartamento-locacao'), ('casa','Casa','casa-locacao'),
  ('kitnet','Kitnet','kitnet-locacao'), ('studio','Studio','studio-locacao'), ('sobrado','Sobrado','sobrado-locacao'),
  ('sala-comercial','Sala comercial','sala-comercial-locacao'), ('loja','Loja','loja-locacao'),
  ('galpao','Galpão','galpao-locacao'), ('escritorio','Escritório','escritorio-locacao'),
  ('consultorio','Consultório','consultorio-locacao'),
  ('terreno-urbano','Terreno urbano','terreno-urbano-locacao'), ('terreno-rural','Terreno rural','terreno-rural-locacao'),
  ('lote','Lote','lote-locacao')
) AS v(cslug, name, slug)
JOIN concepts c ON c.slug = v.cslug
WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.slug = v.slug AND cs.tenant_id IS NULL);

-- concept_offer_kinds: os 13 concepts de bens-imoveis são 'rentable' (mesma governança de veículo/equipamento)
INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT concept_id, 'rentable' FROM concepts
WHERE slug IN ('apartamento','casa','kitnet','studio','sobrado','sala-comercial','loja','galpao',
               'escritorio','consultorio','terreno-urbano','terreno-rural','lote')
ON CONFLICT DO NOTHING;
COMMIT;

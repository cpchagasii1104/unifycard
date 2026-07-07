-- 20260707180000: DECISION-0151 ADENDO B — método tríade p/ locação (equipamento+veículo, N0 já
-- congelados na norma); metadata JSONB = LAYER 5 ATTRIBUTES (facets, não semântica) sobre o recurso.
-- Imóvel FICA DE FORA (sem N0 — ver RFC_N0_IMOVEIS_E_PROPRIEDADES.md, aguarda ratificação).
BEGIN;
SELECT set_config('app.concept_governance', 'true', true);
INSERT INTO concepts (slug, domain)
SELECT v.slug, v.domain FROM (VALUES
  ('furadeira','produtos-e-comercio'), ('betoneira','produtos-e-comercio'),
  ('andaime','produtos-e-comercio'), ('gerador','produtos-e-comercio'),
  ('rocadeira','produtos-e-comercio'), ('compressor-de-ar','produtos-e-comercio'),
  ('motocicleta','mobilidade-e-logistica'), ('van','mobilidade-e-logistica'),
  ('caminhonete','mobilidade-e-logistica')
) AS v(slug, domain)
WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = v.slug);

INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status)
SELECT NULL, 'global', c.concept_id, v.name, v.cslug, 'active'
FROM (VALUES
  ('furadeira','Furadeira','furadeira-locacao'), ('betoneira','Betoneira','betoneira-locacao'),
  ('andaime','Andaime','andaime-locacao'), ('gerador','Gerador','gerador-locacao'),
  ('rocadeira','Roçadeira','rocadeira-locacao'), ('compressor-de-ar','Compressor de ar','compressor-de-ar-locacao'),
  ('carro','Carro','carro-locacao'), ('motocicleta','Motocicleta','motocicleta-locacao'),
  ('van','Van','van-locacao'), ('caminhonete','Caminhonete','caminhonete-locacao')
) AS v(cslug, name, slug)
JOIN concepts c ON c.slug = v.cslug
WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.slug = v.slug AND cs.tenant_id IS NULL);

-- Atributos do recurso (LAYER 5 — facets: metragem, marca, ano...) NÃO redefinem CONCEPT.
ALTER TABLE rentable_resources ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;

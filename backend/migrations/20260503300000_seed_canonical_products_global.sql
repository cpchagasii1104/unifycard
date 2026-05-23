-- Fase 3C: canonical_products globais READY (1 concept item-comercial → 1 linha global por concept_id).
-- Regras: tenant_id NULL, scope = 'global', concept_resolution_status = 'confirmed', concept_id obrigatório;
-- não definir fingerprint_v1 nem gtin (trigger + índices parciais). Idempotente: NOT EXISTS por concept_id global.
--
-- Trigger: search_path deve incluir public (função canonical_product_fingerprint_v1 + canonical_json_attrs).
-- Cast TEXT nas colunas evita ambiguidade VARCHAR vs TEXT no resolve da função.

BEGIN;

CREATE OR REPLACE FUNCTION trg_canonical_products_set_fingerprint_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.gtin := NULLIF(btrim(NEW.gtin::text), '');
  NEW.fingerprint_v1 := canonical_product_fingerprint_v1(
    NEW.gtin::text,
    NEW.name::text,
    NEW.brand::text,
    COALESCE(NEW.attributes, '{}'::jsonb)
  );
  RETURN NEW;
END;
$$;

INSERT INTO canonical_products (
  tenant_id,
  scope,
  type,
  name,
  brand,
  images,
  attributes,
  category_id,
  concept_id,
  concept_resolution_status,
  gtin
)
SELECT
  NULL,
  'global',
  'INDUSTRIAL',
  v.display_name,
  NULL,
  '[]'::jsonb,
  '{}'::jsonb,
  cat.category_id,
  con.concept_id,
  'confirmed',
  NULL
FROM (
  VALUES
    -- mercearia
    ('arroz-branco-tipo-1', 'marketplace-mercearia', 'Arroz branco tipo 1'),
    ('feijao-carioca-tipo-1', 'marketplace-mercearia', 'Feijão carioca tipo 1'),
    ('acucar-cristal-1kg', 'marketplace-mercearia', 'Açúcar cristal 1 kg'),
    ('oleo-soja-900ml', 'marketplace-mercearia', 'Óleo de soja 900 ml'),
    ('farinha-trigo-1kg', 'marketplace-mercearia', 'Farinha de trigo 1 kg'),
    ('macarrao-espaguete-500g', 'marketplace-mercearia', 'Macarrão espaguete 500 g'),
    -- hortifruti
    ('tomate-comum', 'marketplace-hortifruti', 'Tomate comum'),
    ('batata-inglesa', 'marketplace-hortifruti', 'Batata inglesa'),
    ('cebola-branca', 'marketplace-hortifruti', 'Cebola branca'),
    ('alface-crespa', 'marketplace-hortifruti', 'Alface crespa'),
    ('banana-prata', 'marketplace-hortifruti', 'Banana-prata'),
    -- carnes
    ('frango-inteiro-resfriado', 'marketplace-carnes-aves', 'Frango inteiro resfriado'),
    ('carne-bovina-acem', 'marketplace-carnes-aves', 'Carne bovina acém'),
    ('carne-suina-pernil', 'marketplace-carnes-aves', 'Carne suína pernil'),
    -- padaria
    ('pao-frances-unidade', 'marketplace-padaria-confeitaria', 'Pão francês (unidade)'),
    ('pao-forma-tradicional', 'marketplace-padaria-confeitaria', 'Pão de forma tradicional'),
    -- bebidas
    ('agua-mineral-500ml', 'marketplace-bebidas', 'Água mineral 500 ml'),
    ('refrigerante-cola-2l', 'marketplace-bebidas', 'Refrigerante cola 2 L'),
    ('cerveja-lager-350ml', 'marketplace-bebidas', 'Cerveja lager 350 ml'),
    -- limpeza
    ('detergente-liquido-500ml', 'marketplace-limpeza', 'Detergente líquido 500 ml'),
    ('sabao-po-1kg', 'marketplace-limpeza', 'Sabão em pó 1 kg'),
    ('desinfetante-1l', 'marketplace-limpeza', 'Desinfetante 1 L'),
    -- higiene
    ('sabonete-barra-90g', 'marketplace-higiene-pessoal', 'Sabonete em barra 90 g'),
    ('shampoo-350ml', 'marketplace-higiene-pessoal', 'Shampoo 350 ml'),
    ('pasta-dental-90g', 'marketplace-higiene-pessoal', 'Pasta dental 90 g'),
    -- suplementos
    ('vitamina-c-1g', 'marketplace-medicamentos-suplementos', 'Vitamina C 1 g'),
    ('analgesico-comum', 'marketplace-medicamentos-suplementos', 'Analgésico comum'),
    -- beleza
    ('hidratante-corporal-200ml', 'marketplace-cosmeticos-beleza', 'Hidratante corporal 200 ml'),
    ('protetor-solar-fps30', 'marketplace-cosmeticos-beleza', 'Proteção solar FPS 30')
) AS v(concept_slug, category_slug, display_name)
JOIN concepts con
  ON con.slug = v.concept_slug
 AND con.domain = 'item-comercial'
JOIN categories cat
  ON cat.slug = v.category_slug
 AND cat.metadata->>'domain' = 'marketplace'
WHERE NOT EXISTS (
  SELECT 1
  FROM canonical_products cp
  WHERE cp.scope = 'global'
    AND cp.concept_id = con.concept_id
);

COMMIT;

-- Fase 3B: seed semântico item-comercial (SSOT em `concepts`; sem `canonical_products`).
-- Idempotente: ON CONFLICT (domain, slug) DO NOTHING.
-- Obrigatório: set_config app.concept_governance (trigger trg_concept_governance / 0075).

BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO domains (domain_key)
SELECT 'item-comercial'
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'domains'
  )
  AND NOT EXISTS (
    SELECT 1 FROM domains WHERE domain_key = 'item-comercial'
  );

INSERT INTO concepts (slug, domain)
VALUES
  -- mercearia
  ('arroz-branco-tipo-1', 'item-comercial'),
  ('feijao-carioca-tipo-1', 'item-comercial'),
  ('acucar-cristal-1kg', 'item-comercial'),
  ('oleo-soja-900ml', 'item-comercial'),
  ('farinha-trigo-1kg', 'item-comercial'),
  ('macarrao-espaguete-500g', 'item-comercial'),

  -- hortifruti
  ('tomate-comum', 'item-comercial'),
  ('batata-inglesa', 'item-comercial'),
  ('cebola-branca', 'item-comercial'),
  ('alface-crespa', 'item-comercial'),
  ('banana-prata', 'item-comercial'),

  -- carnes
  ('frango-inteiro-resfriado', 'item-comercial'),
  ('carne-bovina-acem', 'item-comercial'),
  ('carne-suina-pernil', 'item-comercial'),

  -- padaria
  ('pao-frances-unidade', 'item-comercial'),
  ('pao-forma-tradicional', 'item-comercial'),

  -- bebidas
  ('agua-mineral-500ml', 'item-comercial'),
  ('refrigerante-cola-2l', 'item-comercial'),
  ('cerveja-lager-350ml', 'item-comercial'),

  -- limpeza
  ('detergente-liquido-500ml', 'item-comercial'),
  ('sabao-po-1kg', 'item-comercial'),
  ('desinfetante-1l', 'item-comercial'),

  -- higiene
  ('sabonete-barra-90g', 'item-comercial'),
  ('shampoo-350ml', 'item-comercial'),
  ('pasta-dental-90g', 'item-comercial'),

  -- suplementos
  ('vitamina-c-1g', 'item-comercial'),
  ('analgesico-comum', 'item-comercial'),

  -- beleza
  ('hidratante-corporal-200ml', 'item-comercial'),
  ('protetor-solar-fps30', 'item-comercial')

ON CONFLICT (domain, slug) DO NOTHING;

COMMIT;

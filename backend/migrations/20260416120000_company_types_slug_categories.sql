-- ============================================================
-- 20260416120000: company_types — slug + slugs padrão de categorias marketplace
-- Pré-requisito: 20260416110000 (categorias com slugs marketplace-*).
-- Vínculo por slug (sem FK) — categorias globais.
-- ============================================================

BEGIN;

ALTER TABLE company_types ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE company_types SET slug = CASE name
  WHEN 'hortifruti' THEN 'hortifruti'
  WHEN 'açougue'    THEN 'acougue'
  WHEN 'padaria'    THEN 'padaria'
  WHEN 'salão'      THEN 'salao'
  ELSE LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'))
END
WHERE slug IS NULL;

UPDATE company_types SET slug = TRIM(BOTH '-' FROM slug) WHERE slug IS NOT NULL;

ALTER TABLE company_types ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE company_types ADD CONSTRAINT company_types_slug_key UNIQUE (slug);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE company_types ADD COLUMN IF NOT EXISTS default_department_slugs TEXT[]
  NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE company_types ADD COLUMN IF NOT EXISTS default_branch_slugs TEXT[]
  NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE company_types SET
  default_department_slugs = ARRAY['marketplace-alimentacao']::text[],
  default_branch_slugs     = ARRAY['marketplace-hortifruti']::text[]
WHERE slug = 'hortifruti';

UPDATE company_types SET
  default_department_slugs = ARRAY['marketplace-alimentacao']::text[],
  default_branch_slugs     = ARRAY['marketplace-carnes-aves']::text[]
WHERE slug = 'acougue';

UPDATE company_types SET
  default_department_slugs = ARRAY['marketplace-alimentacao']::text[],
  default_branch_slugs     = ARRAY['marketplace-padaria-confeitaria', 'marketplace-bebidas']::text[]
WHERE slug = 'padaria';

UPDATE company_types SET
  default_department_slugs = ARRAY['marketplace-servicos-pessoais']::text[],
  default_branch_slugs     = ARRAY['marketplace-cabelo', 'marketplace-estetica-spa', 'marketplace-barbearia']::text[]
WHERE slug = 'salao';

INSERT INTO company_types (name, slug, default_department_slugs, default_branch_slugs)
VALUES
  (
    'supermercado', 'supermercado',
    ARRAY['marketplace-alimentacao']::text[],
    ARRAY['marketplace-hortifruti','marketplace-carnes-aves','marketplace-mercearia',
          'marketplace-bebidas','marketplace-limpeza','marketplace-padaria-confeitaria']::text[]
  ),
  (
    'farmácia', 'farmacia',
    ARRAY['marketplace-saude-beleza']::text[],
    ARRAY['marketplace-medicamentos-suplementos','marketplace-higiene-pessoal',
          'marketplace-cosmeticos-beleza']::text[]
  ),
  (
    'restaurante', 'restaurante',
    ARRAY['marketplace-alimentacao']::text[],
    ARRAY['marketplace-padaria-confeitaria','marketplace-bebidas']::text[]
  )
ON CONFLICT (name) DO UPDATE SET
  slug                     = EXCLUDED.slug,
  default_department_slugs = EXCLUDED.default_department_slugs,
  default_branch_slugs     = EXCLUDED.default_branch_slugs;

COMMENT ON COLUMN company_types.slug IS
  'Chave programática (§4.5 Nomenclatura Canônica).';
COMMENT ON COLUMN company_types.default_department_slugs IS
  'Slugs department marketplace padrão para o tipo de empresa.';
COMMENT ON COLUMN company_types.default_branch_slugs IS
  'Slugs branch marketplace padrão para o tipo de empresa.';

COMMIT;

-- 20260611170000_business_templates_versioned.sql
-- DECISION-0117 E — templates empresariais CANÔNICOS, VERSIONADOS, por REFERÊNCIA.
--
-- business_templates + versions (composition = REFERÊNCIAS a slugs governados de
-- categorias/serviços/módulos — NUNCA cópia de produtos) + company_template_
-- applications (aplicação manual-assistida AUDITÁVEL: template, versão, empresa,
-- actor aplicador, timestamp, módulos/recortes). Versões são IMUTÁVEIS: mudar o
-- template = nova versão; aplicações antigas NÃO são reescritas.
-- Aplicar template NÃO cria oferta/estoque/preço/agenda e NÃO concede autoridade.
--
-- Seeds determinísticos fail-closed: company_type 'distribuidora-de-bebidas'
-- (+ concept e par allowed_concepts para a ativação 0097/0098) e os 3 templates
-- iniciais (supermercado amplo · distribuidora recorte bebidas · salão serviços).

BEGIN;

CREATE TABLE IF NOT EXISTS business_templates (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_template_versions (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  uuid NOT NULL REFERENCES business_templates(id) ON DELETE CASCADE,
  version      integer NOT NULL CHECK (version >= 1),
  -- Composição por REFERÊNCIA (slugs governados): companyTypeSlug,
  -- departmentCategorySlugs[], branchCategorySlugs[], serviceCategorySlugs[], modules[].
  composition  jsonb NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS company_template_applications (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id           uuid NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  template_id          uuid NOT NULL REFERENCES business_templates(id) ON DELETE RESTRICT,
  template_version_id  uuid NOT NULL REFERENCES business_template_versions(id) ON DELETE RESTRICT,
  applied_by_actor_id  uuid NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  applied_at           timestamptz NOT NULL DEFAULT now(),
  modules_applied      jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Personalização da EMPRESA (ex.: módulos opcionais desativados) — nunca altera o template.
  customizations       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status               text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','superseded')),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, template_version_id)
);

CREATE INDEX IF NOT EXISTS idx_company_template_applications_company
  ON company_template_applications (tenant_id, company_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Seed: company_type 'distribuidora-de-bebidas' + concept + par allowed_concepts
-- (necessário para a ativação operacional 0097/0098 da vertical do GO).
-- ────────────────────────────────────────────────────────────────────────────
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain)
VALUES ('comercio-distribuicao-bebidas', 'produtos-e-comercio')
ON CONFLICT (domain, slug) DO NOTHING;

INSERT INTO company_types (name, slug, default_department_slugs, default_branch_slugs)
SELECT 'distribuidora de bebidas', 'distribuidora-de-bebidas',
       ARRAY['marketplace-alimentacao'], ARRAY['marketplace-bebidas']
WHERE NOT EXISTS (SELECT 1 FROM company_types WHERE slug = 'distribuidora-de-bebidas');

DO $$
DECLARE
  v_ct uuid;
  v_concept uuid;
BEGIN
  SELECT id INTO v_ct FROM company_types WHERE slug = 'distribuidora-de-bebidas' LIMIT 1;
  SELECT concept_id INTO v_concept FROM concepts WHERE domain = 'produtos-e-comercio' AND slug = 'comercio-distribuicao-bebidas' LIMIT 1;
  IF v_ct IS NULL OR v_concept IS NULL THEN
    RAISE EXCEPTION 'seed distribuidora-de-bebidas incompleto (company_type=% concept=%) — fail-closed', v_ct, v_concept;
  END IF;
  INSERT INTO company_type_allowed_concepts (company_type_id, concept_id)
  VALUES (v_ct, v_concept)
  ON CONFLICT DO NOTHING;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- Seed: templates iniciais (composição por REFERÊNCIA a slugs vivos; fail-closed).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_missing integer;
  v_tpl uuid;
BEGIN
  -- Pré-condição: todos os slugs referenciados existem em categories.
  SELECT count(*) INTO v_missing FROM unnest(ARRAY[
    'marketplace-alimentacao','marketplace-hortifruti','marketplace-carnes-aves',
    'marketplace-mercearia','marketplace-bebidas','marketplace-limpeza',
    'marketplace-padaria-confeitaria','servicos-estetica-bem-estar','servicos-cabeleireiro',
    'servicos-barbearia','servicos-manicure','servicos-estetica-facial'
  ]) AS s(slug)
  WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = s.slug);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'seed de templates: % slugs de categoria ausentes — fail-closed', v_missing;
  END IF;

  -- SUPERMERCADO (composição ampla)
  INSERT INTO business_templates (slug, name, description)
  VALUES ('supermercado-completo', 'Supermercado completo',
          'Composição ampla de varejo alimentar: hortifruti, açougue, mercearia, bebidas, limpeza e panificação.')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_tpl FROM business_templates WHERE slug = 'supermercado-completo';
  INSERT INTO business_template_versions (template_id, version, composition, notes)
  SELECT v_tpl, 1, jsonb_build_object(
    'companyTypeSlug', 'supermercado',
    'departmentCategorySlugs', jsonb_build_array('marketplace-alimentacao'),
    'branchCategorySlugs', jsonb_build_array('marketplace-hortifruti','marketplace-carnes-aves','marketplace-mercearia','marketplace-bebidas','marketplace-limpeza','marketplace-padaria-confeitaria'),
    'serviceCategorySlugs', jsonb_build_array(),
    'modules', jsonb_build_array('marketplace','inventory')
  ), 'v1 seed DECISION-0117 E'
  WHERE NOT EXISTS (SELECT 1 FROM business_template_versions WHERE template_id = v_tpl AND version = 1);

  -- DISTRIBUIDORA DE BEBIDAS (recorte)
  INSERT INTO business_templates (slug, name, description)
  VALUES ('distribuidora-de-bebidas', 'Distribuidora de bebidas',
          'Recorte de bebidas: águas, refrigerantes e retornáveis, sem o restante do supermercado.')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_tpl FROM business_templates WHERE slug = 'distribuidora-de-bebidas';
  INSERT INTO business_template_versions (template_id, version, composition, notes)
  SELECT v_tpl, 1, jsonb_build_object(
    'companyTypeSlug', 'distribuidora-de-bebidas',
    'departmentCategorySlugs', jsonb_build_array('marketplace-alimentacao'),
    'branchCategorySlugs', jsonb_build_array('marketplace-bebidas'),
    'serviceCategorySlugs', jsonb_build_array(),
    'modules', jsonb_build_array('marketplace','inventory')
  ), 'v1 seed DECISION-0117 E'
  WHERE NOT EXISTS (SELECT 1 FROM business_template_versions WHERE template_id = v_tpl AND version = 1);

  -- SALÃO (serviços + agenda)
  INSERT INTO business_templates (slug, name, description)
  VALUES ('salao-servicos', 'Salão de beleza',
          'Serviços de beleza com agenda: cabeleireiro, barbearia, manicure e estética.')
  ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO v_tpl FROM business_templates WHERE slug = 'salao-servicos';
  INSERT INTO business_template_versions (template_id, version, composition, notes)
  SELECT v_tpl, 1, jsonb_build_object(
    'companyTypeSlug', 'salao',
    'departmentCategorySlugs', jsonb_build_array(),
    'branchCategorySlugs', jsonb_build_array(),
    'serviceCategorySlugs', jsonb_build_array('servicos-estetica-bem-estar','servicos-cabeleireiro','servicos-barbearia','servicos-manicure','servicos-estetica-facial'),
    'modules', jsonb_build_array('services','agenda')
  ), 'v1 seed DECISION-0117 E'
  WHERE NOT EXISTS (SELECT 1 FROM business_template_versions WHERE template_id = v_tpl AND version = 1);
END $$;

COMMIT;

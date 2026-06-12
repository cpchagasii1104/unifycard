-- 20260611150000_canonical_variants_services_units_foundation.sql
-- DECISION-0117 (A/D/G/H) — fundação canônica da macrofrente
-- F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE.
--
-- Cria: canonical_units (registry H), canonical_variants (identidade material da
-- configuração vendável — eixos discriminadores participam do fingerprint, A),
-- canonical_services (identidade compartilhada de serviço, concept obrigatório, D),
-- canonical_catalog_events (trilha append-only de variantes/serviços/curadoria/merge),
-- substrato de merge (duplicate_of, G) e vínculo services.canonical_service_id.
--
-- Aditiva, forward-only, idempotente (IF NOT EXISTS / ON CONFLICT / DO-guards).
-- NÃO altera canonical_products existentes (35 seeds preservados), NÃO toca Bank,
-- NÃO cria preço/estoque em entidade canônica (preço = oferta; estoque = actor).

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Registry canônico mínimo de unidades (DECISION-0117 H)
--    Compatibilidade = mesma dimension; SEM conversão automática (fora da frente).
--    Inclui todo o vocabulário vivo de product_variants.sale_unit (un,kg,g,l,ml,
--    hour,service) para não órfanizar o CHECK existente.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canonical_units (
  unit_code        text PRIMARY KEY,
  dimension        text NOT NULL CHECK (dimension IN ('count','mass','volume','package','time')),
  symbol           text NOT NULL,
  display_name     text NOT NULL,
  precision_scale  integer NOT NULL DEFAULT 0 CHECK (precision_scale >= 0),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO canonical_units (unit_code, dimension, symbol, display_name, precision_scale) VALUES
  ('un',      'count',   'un',   'Unidade',    0),
  ('kg',      'mass',    'kg',   'Quilograma', 3),
  ('g',       'mass',    'g',    'Grama',      0),
  ('l',       'volume',  'L',    'Litro',      3),
  ('ml',      'volume',  'mL',   'Mililitro',  0),
  ('pacote',  'package', 'pct',  'Pacote',     0),
  ('caixa',   'package', 'cx',   'Caixa',      0),
  ('lote',    'package', 'lt',   'Lote',       0),
  ('garrafa', 'package', 'grf',  'Garrafa',    0),
  ('hour',    'time',    'h',    'Hora',       2),
  ('service', 'count',   'serv', 'Serviço',    0)
ON CONFLICT (unit_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. canonical_variants — configuração material exata que distingue o item
--    vendável (DECISION-0117 A). Eixos discriminadores tipados (net_content,
--    package_type, is_returnable, GTIN) + discriminator_attributes governados
--    por categoria no código; TODOS participam do fingerprint_v1 (computado no
--    pipeline de criação — única porta de escrita). GTIN distinto ⇒ variante
--    distinta (uidx global). Sem preço, sem estoque (pertencem à oferta/actor).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canonical_variants (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_product_id      uuid NOT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
  variant_name              text NOT NULL,
  gtin                      varchar(14),
  net_content_value         numeric(12,4) CHECK (net_content_value IS NULL OR net_content_value > 0),
  net_content_unit          text REFERENCES canonical_units(unit_code),
  package_type              text,
  is_returnable             boolean,
  discriminator_attributes  jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint_v1            text NOT NULL,
  status                    text NOT NULL DEFAULT 'active' CHECK (status IN ('pending_curation','active','retired')),
  duplicate_of_variant_id   uuid REFERENCES canonical_variants(id) ON DELETE SET NULL,
  version                   integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by_actor_id       uuid REFERENCES actors(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_canonical_variants_no_self_duplicate
    CHECK (duplicate_of_variant_id IS NULL OR duplicate_of_variant_id <> id),
  CONSTRAINT chk_canonical_variants_gtin_shape
    CHECK (gtin IS NULL OR gtin ~ '^[0-9]{8,14}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_variants_gtin
  ON canonical_variants (gtin) WHERE gtin IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_variants_fingerprint
  ON canonical_variants (canonical_product_id, fingerprint_v1);
CREATE INDEX IF NOT EXISTS idx_canonical_variants_product
  ON canonical_variants (canonical_product_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Substrato de merge no produto canônico (DECISION-0117 G) — duplicate_of
--    com redirect resolvido em leitura; histórico preservado; sem rewrite.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS duplicate_of_canonical_product_id uuid
    REFERENCES canonical_products(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'canonical_products'::regclass
       AND conname = 'chk_canonical_products_no_self_duplicate'
  ) THEN
    ALTER TABLE canonical_products
      ADD CONSTRAINT chk_canonical_products_no_self_duplicate
      CHECK (duplicate_of_canonical_product_id IS NULL OR duplicate_of_canonical_product_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_canonical_products_duplicate_of
  ON canonical_products (duplicate_of_canonical_product_id)
  WHERE duplicate_of_canonical_product_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. canonical_services — identidade material compartilhada de serviço
--    (DECISION-0117 D). concept_id OBRIGATÓRIO (Lei 7); atributos-base
--    governados; sem preço empresarial; sem agenda empresarial.
--    global ∪ scoped (mesmo contrato 2B do produto canônico).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canonical_services (
  id                                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                          uuid REFERENCES tenants(id) ON DELETE CASCADE,
  scope                              text NOT NULL DEFAULT 'scoped' CHECK (scope IN ('global','scoped')),
  concept_id                         uuid NOT NULL REFERENCES concepts(concept_id) ON DELETE RESTRICT,
  name                               text NOT NULL,
  slug                               text NOT NULL,
  description                        text,
  base_duration_minutes              integer CHECK (base_duration_minutes IS NULL OR base_duration_minutes > 0),
  attributes                         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                             text NOT NULL DEFAULT 'pending_curation' CHECK (status IN ('pending_curation','active','retired')),
  duplicate_of_canonical_service_id  uuid REFERENCES canonical_services(id) ON DELETE SET NULL,
  created_by_actor_id                uuid REFERENCES actors(id) ON DELETE SET NULL,
  created_at                         timestamptz NOT NULL DEFAULT now(),
  updated_at                         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_canonical_services_scope_tenant
    CHECK ((scope = 'global' AND tenant_id IS NULL) OR (scope = 'scoped' AND tenant_id IS NOT NULL)),
  CONSTRAINT chk_canonical_services_no_self_duplicate
    CHECK (duplicate_of_canonical_service_id IS NULL OR duplicate_of_canonical_service_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_services_slug_global
  ON canonical_services (slug) WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_services_slug_scoped
  ON canonical_services (tenant_id, slug) WHERE scope = 'scoped';
CREATE INDEX IF NOT EXISTS idx_canonical_services_concept
  ON canonical_services (concept_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Trilha append-only de eventos do catálogo canônico (variantes, serviços,
--    curadoria, merge). Imutável por trigger (auditoria — DECISION-0117 B/G).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canonical_catalog_events (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type  text NOT NULL CHECK (entity_type IN ('canonical_product','canonical_variant','canonical_service','media_asset')),
  entity_id    uuid NOT NULL,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id     uuid,
  tenant_id    uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canonical_catalog_events_entity
  ON canonical_catalog_events (entity_type, entity_id);

CREATE OR REPLACE FUNCTION canonical_catalog_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'canonical_catalog_events é append-only (auditoria imutável — DECISION-0117)';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_canonical_catalog_events_immutable'
  ) THEN
    CREATE TRIGGER trg_canonical_catalog_events_immutable
      BEFORE UPDATE OR DELETE ON canonical_catalog_events
      FOR EACH ROW EXECUTE FUNCTION canonical_catalog_events_immutable();
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. services → canonical_services (DECISION-0117 D): coluna aditiva NULLable
--    (legado preservado); o writer passa a EXIGIR para service_type='service'.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS canonical_service_id uuid
    REFERENCES canonical_services(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_services_canonical_service
  ON services (canonical_service_id) WHERE canonical_service_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Concepts mínimos da vertical (seed governado — concepts nascem por
--    migration determinística, como os 137 existentes; Lei 7 preservada).
--    Autorização transaction-local exigida pelo trigger 0075 (mesmo padrão de
--    20260416125000_concepts_estabelecimento.sql).
-- ────────────────────────────────────────────────────────────────────────────
SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain) VALUES
  ('refrigerante-de-cola',       'item-comercial'),
  ('corte-de-cabelo-masculino',  'servicos')
ON CONFLICT (domain, slug) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Serviço canônico GLOBAL seed: "Corte de cabelo masculino" (curado por
--    seed governado — análogo aos 35 canonical_products do seed global).
--    Fail-closed se o concept não existir.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_concept uuid;
BEGIN
  SELECT concept_id INTO v_concept
    FROM concepts WHERE domain = 'servicos' AND slug = 'corte-de-cabelo-masculino' LIMIT 1;
  IF v_concept IS NULL THEN
    RAISE EXCEPTION 'concept servicos/corte-de-cabelo-masculino ausente — seed abortado (fail-closed)';
  END IF;

  INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, base_duration_minutes, status)
  SELECT NULL, 'global', v_concept, 'Corte de cabelo masculino', 'corte-de-cabelo-masculino', 30, 'active'
  WHERE NOT EXISTS (
    SELECT 1 FROM canonical_services WHERE scope = 'global' AND slug = 'corte-de-cabelo-masculino'
  );
END $$;

COMMIT;

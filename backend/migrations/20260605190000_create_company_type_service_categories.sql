-- ============================================================
-- F-SERVICE-TAXONOMY-BRIDGE-SCHEMA-MIGRATION (DECISION-0109 D3 / ratificação Opção A)
-- Ponte EXPLÍCITA e GOVERNADA entre `company_type` e categorias de SERVIÇO (`domain='servicos'`).
-- ------------------------------------------------------------
-- POR QUÊ: o `company_type` pré-molda ramos, mas hoje `default_department_slugs`/`default_branch_slugs`
-- apontam categorias `domain='marketplace'` (produto) — inclusive para `salao` (serviço). Misturar
-- dicionário de produto com o de serviço é o fork registrado em DT-SERVICE-RAMO-TAXONOMY-FORK. Esta
-- tabela dá ao serviço a sua própria pré-moldagem, sem repontar os slugs de produto e sem reusar
-- `company_type_allowed_concepts` (que é camada de ATUAÇÃO/concept, NÃO categoria operacional).
--
-- ESCOPO DESTA FATIA: schema-only. SEM seed (vem em F-SERVICE-TAXONOMY-BRIDGE-SEED-SALON), SEM runtime,
-- SEM criação de serviço/availability/booking, SEM Bank, SEM frontend. NÃO altera `services.category_id`,
-- `company_type_allowed_concepts`, nem `company_types.default_*_slugs`.
--
-- DOMÍNIO: `service_category_id` DEVE apontar para categorias `domain='servicos'`. Esse invariante NÃO é
-- cravado por CHECK SQL (exigiria subquery em `categories.metadata` e congelaria evolução — ver
-- feedback_enforcement_vs_decision). A validação de domínio fica para o SEED curado + guard/teste de fatia
-- posterior (`services.category_id ∈ servicos + ramos permitidos`). A norma está documentada aqui (COMMENT).
--
-- PK vivo confirmado: `company_types.id`, `categories.category_id`. Forward-only / transacional / idempotente.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS company_type_service_categories (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_type_id      UUID NOT NULL REFERENCES company_types(id),
  service_category_id  UUID NOT NULL REFERENCES categories(category_id),
  is_department        BOOLEAN NOT NULL DEFAULT false,
  source               TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_ctsc_source CHECK (length(btrim(source)) > 0),
  CONSTRAINT uq_ctsc_type_category UNIQUE (company_type_id, service_category_id)
);

CREATE INDEX IF NOT EXISTS idx_ctsc_company_type
  ON company_type_service_categories (company_type_id);

CREATE INDEX IF NOT EXISTS idx_ctsc_service_category
  ON company_type_service_categories (service_category_id);

COMMENT ON TABLE company_type_service_categories IS
  'Ponte governada company_type -> categoria de SERVIÇO (DECISION-0109 D3, Opção A). Pré-moldagem de '
  'ramos de serviço SEPARADA da de produto (company_types.default_*_slugs = marketplace). service_category_id '
  'DEVE apontar para categorias domain=''servicos'' (invariante por seed/guard, NÃO por CHECK SQL). NÃO reusar '
  'company_type_allowed_concepts (atuação/concept, não categoria). Schema-only nesta fatia: sem seed/runtime/Bank.';
COMMENT ON COLUMN company_type_service_categories.is_department IS
  'true = categoria-raiz/departamento do ramo de serviço do tipo; false = ramo/sub-categoria.';
COMMENT ON COLUMN company_type_service_categories.source IS
  'Origem do vínculo (ex.: curadoria/seed). Obrigatório (auditabilidade).';

COMMIT;

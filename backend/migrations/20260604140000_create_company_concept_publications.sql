-- ============================================================
-- F-PJ-PUBLICATION-OFFERING-SCHEMA-MIGRATION (DECISION-0099 + DECISION-0100)
-- Cria a tabela soberana de PUBLICAÇÃO/OFERTA da empresa PJ.
-- ------------------------------------------------------------
-- SSOT de publicação/oferta = company/page-actor×concept. Publicar ≠ ativar (DECISION-0099 D1):
-- ativar grava o que a empresa É (companies.primary_*); publicar decide se o mundo a encontra/
-- consome por um conceito. Esta tabela é o "poste" da placa pública; o writer (publish/unpublish)
-- gated por KYB approved + autoridade contextual (company_users) + page-actor vem em frente própria
-- (DECISION-0100 D5/D6/D12) — esta migration NÃO instala writer, rota, trigger nem dados.
--
-- NÃO altera tenant_concept_offerings (permanece read-model/compat de discovery — DECISION-0100 D10).
-- NÃO faz backfill nem auto-publicação (DECISION-0099 D2 / DECISION-0100 D11). NÃO toca companies,
-- fiscal_identities, KYB, Bank, marketplace. Forward-only / transacional / idempotente.
--
-- FKs (PKs reais do schema vivo): tenant_id→tenants(id) · company_id→companies(company_id) ·
-- page_actor_id/created_by_actor_id/retired_by_actor_id→actors(id) · concept_id→concepts(concept_id).
-- ON DELETE default (NO ACTION): publicação soberana não é apagada em cascata silenciosa — o
-- lifecycle é retirement (status='retired'), não DELETE.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS company_concept_publications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  company_id           UUID NOT NULL REFERENCES companies(company_id),
  page_actor_id        UUID NOT NULL REFERENCES actors(id),
  concept_id           UUID NOT NULL REFERENCES concepts(concept_id),
  status               TEXT NOT NULL DEFAULT 'active',
  published_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at           TIMESTAMPTZ NULL,
  created_by_actor_id  UUID NOT NULL REFERENCES actors(id),
  retired_by_actor_id  UUID NULL REFERENCES actors(id),
  source               TEXT NOT NULL DEFAULT 'manual',
  intent               TEXT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- DECISION-0100 D7: lifecycle simples active|retired.
  CONSTRAINT chk_ccp_status CHECK (status IN ('active', 'retired')),
  -- DECISION-0100 D7: coerência active/retired vs retired_at/retired_by.
  CONSTRAINT chk_ccp_lifecycle CHECK (
    (status = 'active'  AND retired_at IS NULL AND retired_by_actor_id IS NULL)
    OR
    (status = 'retired' AND retired_at IS NOT NULL)
  ),
  -- DECISION-0100 D7/D9: published_at sempre presente (audit inline).
  CONSTRAINT chk_ccp_published_at CHECK (published_at IS NOT NULL)
);

-- DECISION-0100 D8: anti-duplicidade — no máximo UMA publicação ATIVA por empresa×concept
-- (histórico de aposentadas permitido).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ccp_active_company_concept
  ON company_concept_publications (company_id, concept_id)
  WHERE status = 'active';

-- DECISION-0100 D10: índice para a projeção futura tenant×concept (derivada de publicações ativas).
CREATE INDEX IF NOT EXISTS idx_ccp_active_tenant_concept
  ON company_concept_publications (tenant_id, concept_id)
  WHERE status = 'active';

-- Discovery futura por page-actor (eixo operacional, DECISION-0097 D7).
CREATE INDEX IF NOT EXISTS idx_ccp_active_page_actor
  ON company_concept_publications (page_actor_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ccp_company
  ON company_concept_publications (company_id);

CREATE INDEX IF NOT EXISTS idx_ccp_concept
  ON company_concept_publications (concept_id);

COMMENT ON TABLE company_concept_publications IS
  'SSOT de publicação/oferta da empresa PJ (company/page-actor×concept). Publicar != ativar '
  '(DECISION-0099/0100). NÃO substitui tenant_concept_offerings nesta fatia (read-model/compat). '
  'Writer gated (KYB approved + company_users + page-actor) é frente própria.';
COMMENT ON COLUMN company_concept_publications.page_actor_id IS
  'actors(id) do page-actor da empresa (eixo operacional, DECISION-0097 D7).';
COMMENT ON COLUMN company_concept_publications.concept_id IS
  'CONCEPT publicado. MVP: deve ser companies.primary_concept_id (DECISION-0100 D4).';
COMMENT ON COLUMN company_concept_publications.status IS
  'Lifecycle: active | retired (DECISION-0100 D7).';

COMMIT;

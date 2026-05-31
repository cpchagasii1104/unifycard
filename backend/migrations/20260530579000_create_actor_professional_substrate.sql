-- ============================================================
-- C1 — Substrato profissional declarativo actor-first (DECISION-0063)
-- Desenho: docs/02_decisions/DESENHO_MVP_C1_PERFIL_PROFISSIONAL.md
--
-- Cria o SSOT da DECLARAÇÃO profissional do actor. Duas tabelas:
--   1. actor_professional_profiles  — bio profissional, 1:1 por actor.
--   2. actor_professional_concepts  — competências declaradas, 1:N por actor.
--
-- Identidade: actor_id (operacional, D2) · concept_id (semântica, Lei 7).
-- source_category_id = breadcrumb/rastreio, NUNCA identidade.
-- skill_level/years_experience = DECLARAÇÕES do actor, não credenciais (cert. fora do MVP).
-- Ciclo de vida binário: is_active + retired_at (sem status enum). Remoção = desativação lógica.
--
-- Tipos fechados por Clayton (2026-05-31):
--   skill_level SMALLINT NOT NULL CHECK 1..5 · years_experience SMALLINT NULL CHECK NULL|0..80
--   CHECK de ciclo: (is_active AND retired_at IS NULL) OR (NOT is_active AND retired_at IS NOT NULL)
--
-- NÃO toca: preço/oferta/workers (C2) · availability (C3) · capability/authority (C4) ·
--   bank_*/split/payout · actor_type · archive. SCHEMA-ONLY: sem DML, sem seed, sem trigger.
-- Pré-requisitos (PKs verificadas no banco vivo): tenants(id), actors(id),
--   concepts(concept_id), categories(category_id). Extensão uuid-ossp ativa.
-- Reversibilidade: DROP TABLE das duas — additive only. Blast: BAIXO (tabelas novas, 0 rows).
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. actor_professional_profiles — bio profissional (1:1 por actor)
-- ---------------------------------------------------------------------------
CREATE TABLE actor_professional_profiles (
  id                UUID NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  actor_id          UUID NOT NULL,
  professional_bio  TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT actor_professional_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT actor_professional_profiles_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  CONSTRAINT actor_professional_profiles_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES actors (id),
  CONSTRAINT uq_actor_professional_profiles_actor
    UNIQUE (tenant_id, actor_id)
);

COMMENT ON TABLE actor_professional_profiles IS
  'C1 (DECISION-0063): bio profissional declarada do actor, 1:1 por actor. SSOT da declaração '
  'de bio profissional; distinta de public_profiles.bio. Não carrega preço/oferta/availability/capability.';

-- ---------------------------------------------------------------------------
-- 2. actor_professional_concepts — competências declaradas (1:N por actor)
-- ---------------------------------------------------------------------------
CREATE TABLE actor_professional_concepts (
  id                  UUID NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL,
  actor_id            UUID NOT NULL,
  concept_id          UUID NOT NULL,
  source_category_id  UUID NULL,
  skill_level         SMALLINT NOT NULL,
  years_experience    SMALLINT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  declared_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at          TIMESTAMPTZ NULL,
  CONSTRAINT actor_professional_concepts_pkey PRIMARY KEY (id),
  CONSTRAINT actor_professional_concepts_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  CONSTRAINT actor_professional_concepts_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES actors (id),
  CONSTRAINT actor_professional_concepts_concept_id_fkey
    FOREIGN KEY (concept_id) REFERENCES concepts (concept_id),
  CONSTRAINT actor_professional_concepts_source_category_id_fkey
    FOREIGN KEY (source_category_id) REFERENCES categories (category_id),
  CONSTRAINT uq_actor_professional_concepts_actor_concept
    UNIQUE (tenant_id, actor_id, concept_id),
  CONSTRAINT chk_actor_professional_concepts_skill_level
    CHECK (skill_level BETWEEN 1 AND 5),
  CONSTRAINT chk_actor_professional_concepts_years_experience
    CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 80),
  CONSTRAINT chk_actor_professional_concepts_lifecycle
    CHECK (
      (is_active = true  AND retired_at IS NULL)
      OR
      (is_active = false AND retired_at IS NOT NULL)
    )
);

-- Reverse lookup "quais actors declaram o concept X" (busca/matching futuro).
-- A UNIQUE (tenant_id, actor_id, concept_id) já cobre o lookup por actor; (tenant_id, concept_id) não.
CREATE INDEX idx_actor_professional_concepts_concept
  ON actor_professional_concepts (tenant_id, concept_id);

COMMENT ON TABLE actor_professional_concepts IS
  'C1 (DECISION-0063): competências/profissões DECLARADAS pelo actor, 1:N por actor. '
  'concept_id = identidade semântica (Lei 7); source_category_id = breadcrumb. '
  'skill_level/years_experience = declarações, não credenciais. Ciclo binário is_active+retired_at; '
  'remoção = desativação lógica (nunca DELETE). Sem preço/oferta/availability/capability.';

COMMIT;

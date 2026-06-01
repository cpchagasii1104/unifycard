-- ============================================================
-- C1 — Substrato declarativo actor-first de Learning/Interest (DECISION-0067, Fatia 1)
-- ============================================================
-- Cria o SSOT da DECLARAÇÃO de aprendizado e de interesse do actor, espelhando o C1 profissional
-- (DECISION-0063 / actor_professional_concepts). Duas tabelas de ESCRITA + uma view read-only:
--   1. actor_learning_concepts    — declarações de aprendizado, 1:N por actor (atributo: progress 1..3).
--   2. actor_interest_concepts     — declarações de interesse, 1:N por actor (binário, sem atributo).
--   3. actor_concept_declarations_v — view read-only UNION (professional + learning + interest).
--
-- Identidade: actor_id (operacional, FK actors.id; writer §4.8.1 no service futuro) ·
--   concept_id (semântica, Lei 7, FK concepts). source_category_id = breadcrumb (FK categories), NUNCA
--   identidade. progress = estágio de EXPLORAÇÃO (1..3), NÃO competência (Learning ≠ Professional;
--   sem skill_level/years_experience). Ciclo binário: is_active + retired_at (XOR).
--
-- NÃO toca: actor_professional_* (selado) · global_users.metadata (blob) · categories/concepts ·
--   lifestyle · bank_*/split/payout · agenda. SCHEMA-ONLY additive: sem DML, sem seed, sem trigger.
-- Pré-requisitos (PKs vivas): tenants(id), actors(id), concepts(concept_id), categories(category_id).
-- uuid_generate_v4 disponível (uuid-ossp). Reversibilidade: DROP VIEW + DROP TABLE das duas.
-- Propriedades: forward-only (Lei 2), idempotente (guard to_regclass), transacional, fail-closed.
-- ============================================================

BEGIN;

-- GUARD 0: pré-requisitos devem existir (fail-closed).
DO $$
BEGIN
  IF to_regclass('public.tenants')                     IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: tenants ausente'; END IF;
  IF to_regclass('public.actors')                      IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actors ausente'; END IF;
  IF to_regclass('public.concepts')                    IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: concepts ausente'; END IF;
  IF to_regclass('public.categories')                  IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: categories ausente'; END IF;
  IF to_regclass('public.actor_professional_concepts') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_professional_concepts (template C1) ausente'; END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. actor_learning_concepts — declarações de aprendizado (1:N por actor)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.actor_learning_concepts') IS NULL THEN
    CREATE TABLE actor_learning_concepts (
      id                  UUID NOT NULL DEFAULT uuid_generate_v4(),
      tenant_id           UUID NOT NULL,
      actor_id            UUID NOT NULL,
      concept_id          UUID NOT NULL,
      source_category_id  UUID NULL,
      progress            SMALLINT NULL,
      is_active           BOOLEAN NOT NULL DEFAULT true,
      declared_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      retired_at          TIMESTAMPTZ NULL,
      CONSTRAINT actor_learning_concepts_pkey PRIMARY KEY (id),
      CONSTRAINT actor_learning_concepts_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants (id),
      CONSTRAINT actor_learning_concepts_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES actors (id),
      CONSTRAINT actor_learning_concepts_concept_id_fkey
        FOREIGN KEY (concept_id) REFERENCES concepts (concept_id),
      CONSTRAINT actor_learning_concepts_source_category_id_fkey
        FOREIGN KEY (source_category_id) REFERENCES categories (category_id),
      CONSTRAINT uq_actor_learning_concepts_actor_concept
        UNIQUE (tenant_id, actor_id, concept_id),
      CONSTRAINT chk_actor_learning_concepts_progress
        CHECK (progress IS NULL OR progress BETWEEN 1 AND 3),
      CONSTRAINT chk_actor_learning_concepts_lifecycle
        CHECK (
          (is_active = true  AND retired_at IS NULL)
          OR
          (is_active = false AND retired_at IS NOT NULL)
        )
    );

    CREATE INDEX idx_actor_learning_concepts_concept
      ON actor_learning_concepts (tenant_id, concept_id);

    COMMENT ON TABLE actor_learning_concepts IS
      'C1 (DECISION-0067): aprendizados DECLARADOS pelo actor, 1:N. concept_id = identidade semântica '
      '(Lei 7); source_category_id = breadcrumb; progress 1..3 = estágio de exploração, NÃO competência '
      '(Learning != Professional). Ciclo is_active+retired_at; remoção = desativação lógica. Sem blob.';
  ELSE
    -- Já existe: validar shape mínimo compatível (fail-closed).
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='actor_learning_concepts' AND column_name='concept_id')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='actor_learning_concepts' AND column_name='progress')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid='public.actor_learning_concepts'::regclass
                     AND conname='uq_actor_learning_concepts_actor_concept') THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: actor_learning_concepts existe com shape incompativel';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. actor_interest_concepts — declarações de interesse (1:N por actor, binário)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.actor_interest_concepts') IS NULL THEN
    CREATE TABLE actor_interest_concepts (
      id                  UUID NOT NULL DEFAULT uuid_generate_v4(),
      tenant_id           UUID NOT NULL,
      actor_id            UUID NOT NULL,
      concept_id          UUID NOT NULL,
      source_category_id  UUID NULL,
      is_active           BOOLEAN NOT NULL DEFAULT true,
      declared_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      retired_at          TIMESTAMPTZ NULL,
      CONSTRAINT actor_interest_concepts_pkey PRIMARY KEY (id),
      CONSTRAINT actor_interest_concepts_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants (id),
      CONSTRAINT actor_interest_concepts_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES actors (id),
      CONSTRAINT actor_interest_concepts_concept_id_fkey
        FOREIGN KEY (concept_id) REFERENCES concepts (concept_id),
      CONSTRAINT actor_interest_concepts_source_category_id_fkey
        FOREIGN KEY (source_category_id) REFERENCES categories (category_id),
      CONSTRAINT uq_actor_interest_concepts_actor_concept
        UNIQUE (tenant_id, actor_id, concept_id),
      CONSTRAINT chk_actor_interest_concepts_lifecycle
        CHECK (
          (is_active = true  AND retired_at IS NULL)
          OR
          (is_active = false AND retired_at IS NOT NULL)
        )
    );

    CREATE INDEX idx_actor_interest_concepts_concept
      ON actor_interest_concepts (tenant_id, concept_id);

    COMMENT ON TABLE actor_interest_concepts IS
      'C1 (DECISION-0067): interesses DECLARADOS pelo actor, 1:N (binário, sem atributo). concept_id = '
      'identidade semântica (Lei 7); source_category_id = breadcrumb. Declarado != inferido (inferência = '
      'GRAPH, substrato separado). Ciclo is_active+retired_at; remoção = desativação lógica. Sem blob, '
      'sem lifestyle.';
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='actor_interest_concepts' AND column_name='concept_id')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid='public.actor_interest_concepts'::regclass
                     AND conname='uq_actor_interest_concepts_actor_concept') THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: actor_interest_concepts existe com shape incompativel';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. actor_concept_declarations_v — view read-only unificada (UNION dos 3 substratos)
-- ---------------------------------------------------------------------------
-- Colunas type-specific como colunas nullable explícitas (NUNCA attrs jsonb).
CREATE OR REPLACE VIEW actor_concept_declarations_v AS
  SELECT
    'professional'::text AS declaration_kind,
    tenant_id, actor_id, concept_id, source_category_id, is_active,
    declared_at, updated_at, retired_at,
    skill_level       AS professional_skill_level,
    years_experience  AS professional_years_experience,
    NULL::smallint    AS learning_progress
  FROM actor_professional_concepts
  UNION ALL
  SELECT
    'learning'::text,
    tenant_id, actor_id, concept_id, source_category_id, is_active,
    declared_at, updated_at, retired_at,
    NULL::smallint, NULL::smallint, progress
  FROM actor_learning_concepts
  UNION ALL
  SELECT
    'interest'::text,
    tenant_id, actor_id, concept_id, source_category_id, is_active,
    declared_at, updated_at, retired_at,
    NULL::smallint, NULL::smallint, NULL::smallint
  FROM actor_interest_concepts;

COMMENT ON VIEW actor_concept_declarations_v IS
  'C1 (DECISION-0067): leitura read-only unificada das declarações de concept por actor '
  '(professional + learning + interest). Conveniência p/ matching/feed/grafo; NÃO é SSOT — '
  'as 3 tabelas de escrita são as fontes. Atributos type-specific em colunas nullable, sem jsonb.';

-- GUARDS DE VALIDAÇÃO FINAL (fail-closed).
DO $$
BEGIN
  IF to_regclass('public.actor_learning_concepts')    IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_learning_concepts nao criada'; END IF;
  IF to_regclass('public.actor_interest_concepts')    IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_interest_concepts nao criada'; END IF;
  IF to_regclass('public.actor_concept_declarations_v') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: view actor_concept_declarations_v nao criada'; END IF;

  -- FKs (4 por tabela: tenant, actor, concept, source_category)
  IF (SELECT count(*) FROM pg_constraint
        WHERE conrelid='public.actor_learning_concepts'::regclass AND contype='f') <> 4
  THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_learning_concepts sem as 4 FKs'; END IF;
  IF (SELECT count(*) FROM pg_constraint
        WHERE conrelid='public.actor_interest_concepts'::regclass AND contype='f') <> 4
  THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_interest_concepts sem as 4 FKs'; END IF;

  -- UNIQUE + CHECK lifecycle + CHECK progress (learning) + índices
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.actor_learning_concepts'::regclass AND conname='chk_actor_learning_concepts_progress')
  THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk progress ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.actor_learning_concepts'::regclass AND conname='chk_actor_learning_concepts_lifecycle')
  THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk lifecycle learning ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.actor_interest_concepts'::regclass AND conname='chk_actor_interest_concepts_lifecycle')
  THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk lifecycle interest ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_actor_learning_concepts_concept')
  THEN RAISE EXCEPTION 'MIGRATION_ABORT: idx learning concept ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_actor_interest_concepts_concept')
  THEN RAISE EXCEPTION 'MIGRATION_ABORT: idx interest concept ausente'; END IF;

  -- Estado inicial: 0 rows nas duas tabelas (SCHEMA-ONLY, sem DML).
  IF (SELECT count(*) FROM actor_learning_concepts) <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_learning_concepts deveria ter 0 rows'; END IF;
  IF (SELECT count(*) FROM actor_interest_concepts) <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_interest_concepts deveria ter 0 rows'; END IF;
END $$;

COMMIT;

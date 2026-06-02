-- ============================================================
-- SSOT Lifestyle actor-first (F1b, DECISION-0071 / desenho F1a ratificado)
-- ============================================================
-- Cria o substrato material para atributos de LIFESTYLE DECLARADOS pelo actor (NÃO clínico, NÃO saúde,
-- NÃO Interest/Learning/Professional, NÃO targeting). Lifestyle é ATRIBUTO ENUMERADO (sem concept_id,
-- sem JSONB de valor). Modelo LINHA-POR-ATRIBUTO porque consent/visibility/delete são POR CAMPO.
--
-- MVP (DECISION-0071): relationship_status, drinks, smokes. `sexual_orientation` é ESTRUTURALMENTE
-- IMPOSSÍVEL (CHECK de key). Sem coluna de texto livre / notes / declaration_text / height / weight /
-- shared_health_data → trava contra captura indireta de Saúde (eixo 10). visibility 'private' obrigatória.
-- Consent explícito obrigatório para linha ativa. Remoção: linha inativa NÃO mantém attribute_value
-- (anonymize). Audit registra evento SEM valor sensível em claro (sem attribute_value/old_value/new_value).
--
-- Forward-only, idempotente (IF NOT EXISTS via to_regclass), transacional. SEM DML/backfill (o blob
-- `global_users.metadata.lifestyle` NÃO é tocado aqui). Identidade actor-first: FK actor_id→actors(id)
-- (padrão dos substratos C1); NUNCA global_user_id como identidade. Espelha conventions de
-- 20260601140000 (C1). NÃO aplica a migration arquivada 0382 (Saúde segue 501). Sem RLS (igual aos
-- substratos C1 actor-first; isolamento por tenant_id é feito na camada de query/service — registrado).
-- ============================================================

BEGIN;

-- GUARD: dependências base devem existir.
DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: tenants ausente'; END IF;
  IF to_regclass('public.actors')  IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actors ausente';  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. actor_lifestyle_attributes — atributos de lifestyle declarados (1:N por actor, por campo)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.actor_lifestyle_attributes') IS NULL THEN
    CREATE TABLE actor_lifestyle_attributes (
      id               UUID NOT NULL DEFAULT uuid_generate_v4(),
      tenant_id        UUID NOT NULL,
      actor_id         UUID NOT NULL,
      attribute_key    TEXT NOT NULL,
      attribute_value  TEXT NULL,
      visibility       TEXT NOT NULL DEFAULT 'private',
      consented_at     TIMESTAMPTZ NULL,
      consent_source   TEXT NULL,
      consent_version  TEXT NULL,
      is_active        BOOLEAN NOT NULL DEFAULT true,
      declared_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      retired_at       TIMESTAMPTZ NULL,
      CONSTRAINT actor_lifestyle_attributes_pkey PRIMARY KEY (id),
      CONSTRAINT actor_lifestyle_attributes_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants (id),
      CONSTRAINT actor_lifestyle_attributes_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES actors (id),
      CONSTRAINT uq_actor_lifestyle_attributes_actor_key
        UNIQUE (tenant_id, actor_id, attribute_key),
      -- key governada: relationship_status/drinks/smokes. sexual_orientation IMPOSSÍVEL.
      CONSTRAINT chk_actor_lifestyle_attributes_key
        CHECK (attribute_key IN ('relationship_status', 'drinks', 'smokes')),
      -- visibility private obrigatória no MVP (public vetado; followers_only/match = decisão futura).
      CONSTRAINT chk_actor_lifestyle_attributes_visibility
        CHECK (visibility = 'private'),
      -- lifecycle XOR + valor só quando ativo (anonymize ao remover: inativo ⇒ attribute_value NULL).
      CONSTRAINT chk_actor_lifestyle_attributes_lifecycle
        CHECK (
          (is_active = true  AND retired_at IS NULL     AND attribute_value IS NOT NULL)
          OR
          (is_active = false AND retired_at IS NOT NULL AND attribute_value IS NULL)
        ),
      -- linha ativa exige consentimento explícito (todo atributo do MVP é sensível).
      CONSTRAINT chk_actor_lifestyle_attributes_active_requires_consent
        CHECK (is_active = false OR consented_at IS NOT NULL),
      -- valor governado por key (sem texto livre). NULL passa (linha retirada/anonimizada).
      CONSTRAINT chk_actor_lifestyle_attributes_value_per_key
        CHECK (
          attribute_value IS NULL
          OR (attribute_key = 'relationship_status'
              AND attribute_value IN ('single', 'dating', 'in_relationship', 'married', 'prefer_not_to_say'))
          OR (attribute_key = 'drinks'
              AND attribute_value IN ('never', 'socially', 'regularly', 'prefer_not_to_say'))
          OR (attribute_key = 'smokes'
              AND attribute_value IN ('never', 'occasionally', 'regularly', 'prefer_not_to_say'))
        )
    );

    CREATE INDEX idx_actor_lifestyle_attributes_actor
      ON actor_lifestyle_attributes (tenant_id, actor_id);
    CREATE INDEX idx_actor_lifestyle_attributes_active
      ON actor_lifestyle_attributes (tenant_id, actor_id)
      WHERE is_active = true;

    COMMENT ON TABLE actor_lifestyle_attributes IS
      'SSOT Lifestyle actor-first (DECISION-0071 / F1b). Atributos DECLARADOS não-clínicos, 1:N por campo: '
      'relationship_status/drinks/smokes (sexual_orientation IMPOSSÍVEL; sem texto livre/saúde). '
      'consent explícito obrigatório p/ ativo; visibility private; remoção anonimiza (attribute_value NULL). '
      'NÃO é Saúde/Interest/Learning/Professional/targeting. actor_id=identidade operacional; sem blob.';
    COMMENT ON COLUMN actor_lifestyle_attributes.consent_source IS
      'Proveniência do consentimento (recomendada; preenchida pelo service). consented_at é o sinal vinculante.';
  ELSE
    -- Já existe: validar shape mínimo compatível (fail-closed).
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='actor_lifestyle_attributes' AND column_name='attribute_key')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='actor_lifestyle_attributes' AND column_name='consented_at')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conrelid='public.actor_lifestyle_attributes'::regclass
                     AND conname='uq_actor_lifestyle_attributes_actor_key') THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: actor_lifestyle_attributes existe com shape incompativel';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. actor_lifestyle_attribute_audit — trilha append-only SEM valor sensível em claro
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.actor_lifestyle_attribute_audit') IS NULL THEN
    CREATE TABLE actor_lifestyle_attribute_audit (
      id                    UUID NOT NULL DEFAULT uuid_generate_v4(),
      tenant_id             UUID NOT NULL,
      actor_id              UUID NOT NULL,
      attribute_key         TEXT NOT NULL,
      action                TEXT NOT NULL,
      occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      performed_by_actor_id UUID NULL,
      source                TEXT NOT NULL,
      reason                TEXT NULL,
      CONSTRAINT actor_lifestyle_attribute_audit_pkey PRIMARY KEY (id),
      CONSTRAINT actor_lifestyle_attribute_audit_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants (id),
      CONSTRAINT actor_lifestyle_attribute_audit_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES actors (id),
      CONSTRAINT actor_lifestyle_attribute_audit_performed_by_fkey
        FOREIGN KEY (performed_by_actor_id) REFERENCES actors (id),
      CONSTRAINT chk_actor_lifestyle_attribute_audit_key
        CHECK (attribute_key IN ('relationship_status', 'drinks', 'smokes')),
      CONSTRAINT chk_actor_lifestyle_attribute_audit_action
        CHECK (action IN ('declare', 'update', 'consent_grant', 'consent_revoke', 'retire', 'anonymize', 'purge'))
      -- INTENCIONALMENTE SEM: attribute_value, old_value, new_value, payload/metadata JSONB.
      -- O audit registra QUE e QUANDO (key + action + actor), NUNCA o valor sensível em claro.
    );

    CREATE INDEX idx_actor_lifestyle_attribute_audit_actor
      ON actor_lifestyle_attribute_audit (tenant_id, actor_id, occurred_at DESC);

    COMMENT ON TABLE actor_lifestyle_attribute_audit IS
      'Audit append-only do SSOT Lifestyle (DECISION-0071 / F1b). Registra evento (key+action+actor+source) '
      'SEM valor sensível em claro: NÃO há attribute_value/old_value/new_value/JSONB. Cumpre "audit sem '
      'valor". Escrita virá no service (F2); nenhuma escrita antes do audit existir.';
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='actor_lifestyle_attribute_audit' AND column_name='action') THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: actor_lifestyle_attribute_audit existe com shape incompativel';
    END IF;
    -- Trava anti-vazamento: a tabela de audit NÃO pode ter colunas de valor.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='actor_lifestyle_attribute_audit'
                 AND column_name IN ('attribute_value', 'old_value', 'new_value')) THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: actor_lifestyle_attribute_audit nao pode ter coluna de valor sensivel';
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO PÓS (fail-closed)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.actor_lifestyle_attributes') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_lifestyle_attributes nao criada';
  END IF;
  IF to_regclass('public.actor_lifestyle_attribute_audit') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_lifestyle_attribute_audit nao criada';
  END IF;
  -- audit NÃO pode ter coluna de valor sensível.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='actor_lifestyle_attribute_audit'
               AND column_name IN ('attribute_value', 'old_value', 'new_value')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: audit com coluna de valor sensivel';
  END IF;
  -- CHECKs essenciais presentes.
  IF (SELECT count(*) FROM pg_constraint
        WHERE conrelid='public.actor_lifestyle_attributes'::regclass AND contype='c'
          AND conname IN ('chk_actor_lifestyle_attributes_key',
                          'chk_actor_lifestyle_attributes_visibility',
                          'chk_actor_lifestyle_attributes_lifecycle',
                          'chk_actor_lifestyle_attributes_active_requires_consent',
                          'chk_actor_lifestyle_attributes_value_per_key')) <> 5 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_lifestyle_attributes sem os 5 CHECKs esperados';
  END IF;
END $$;

COMMIT;

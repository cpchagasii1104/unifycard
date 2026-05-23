-- Fase 1B: tabela GUARDA (tutela económica) — elimina 42P01 em evaluateEconomicGuardianship.
-- Tabela vazia: sem linha ativa = NO_ACTIVE_GUARDIANSHIP (não bloqueia).

BEGIN;

CREATE TABLE IF NOT EXISTS economic_guardianship (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_actor_id  UUID        NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  guardian_actor_id UUID        NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  scope             TEXT        NOT NULL DEFAULT 'full',
  limit_amount      NUMERIC     NOT NULL CHECK (limit_amount > 0),
  effective_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT economic_guardianship_dates_chk
    CHECK (expires_at > effective_at),

  CONSTRAINT economic_guardianship_actors_chk
    CHECK (subject_actor_id <> guardian_actor_id)
);

CREATE INDEX IF NOT EXISTS idx_economic_guardianship_subject
  ON economic_guardianship (tenant_id, subject_actor_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_economic_guardianship_guardian
  ON economic_guardianship (tenant_id, guardian_actor_id);

COMMENT ON TABLE economic_guardianship IS
  'SSOT de responsabilidade econômica (GUARDA). Alinhado a docs/01_normative/SSOT_REGISTRY_UNIFICARD.md §Guarda. '
  'Sem linha ativa = NO_ACTIVE_GUARDIANSHIP (não bloqueia). '
  'Com linha = aplica teto limit_amount por transação.';

COMMIT;

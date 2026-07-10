-- 20260710130000_create_actor_fiscal_profiles.sql
-- DECISION-0166 D9 (Lei do Contador) — Fase 4 / fatia 4b da frente F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION.
--
-- CASA CANÔNICA ÚNICA do PERFIL FISCAL (enquadramento/regime tributário), ANCORADA em
-- fiscal_identities (a identidade fiscal CNPJ+KYB que JÁ EXISTE — âncora, não concorrente).
-- Substitui as DUAS casas fantasmas de regime descobertas no GATE 4b (company_profiles e
-- tax_profiles — tabelas INEXISTENTES no banco com código vivo apontando para elas) e os DOIS
-- vocabulários TaxRegime conflitantes. D9.4: criar paralelo do que já existe = REPROVA.
--
--   - tax_regime GOVERNADO (D9.5): MEI · SIMPLES_NACIONAL · LUCRO_PRESUMIDO · LUCRO_REAL · OTHER.
--   - VERSIONADA + IMUTÁVEL QUANDO ATIVA (mesma doutrina da policy/F1-a): mudar de regime =
--     NOVA VERSÃO; ativa só aceita encerramento (status→deprecated, effective_until);
--     deprecated é terminal; DELETE bloqueado em active/deprecated (draft deletável).
--   - Configuração é RESPONSABILIDADE do contribuinte/contador (configured_by_actor_id +
--     source/nota); o sistema NÃO inventa regime — ausência de perfil = fiscal_config_missing.
--   - SEM alíquota, SEM cálculo, SEM regra fiscal aqui (tax_types/tax_rules = fatia 4c).
-- Forward-only, aditiva, idempotente; não toca dados nem dinheiro.

BEGIN;

CREATE TABLE IF NOT EXISTS actor_fiscal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- ÂNCORA CANÔNICA: a identidade fiscal existente (CNPJ + KYB). Nunca texto solto.
  fiscal_identity_id UUID NOT NULL REFERENCES fiscal_identities(fiscal_identity_id),

  -- Contexto de actor opcional (PF/futuro); a empresa chega via fiscal_identity ← companies.
  actor_id UUID NULL REFERENCES actors(id),

  tax_regime TEXT NOT NULL
    CHECK (tax_regime IN ('MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'OTHER')),

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'deprecated')),

  version INTEGER NOT NULL DEFAULT 1,

  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  CHECK (effective_until IS NULL OR effective_until > effective_from),

  -- Quem configurou (empresa/contador/admin autorizado) + proveniência (nota do contador etc.).
  configured_by_actor_id UUID REFERENCES actors(id) ON DELETE SET NULL,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, fiscal_identity_id, version)
);

COMMENT ON TABLE actor_fiscal_profiles IS
  'DECISION-0166 D9 (Fase 4b). CASA CANÔNICA ÚNICA do enquadramento fiscal, ancorada em fiscal_identities. Versionada/imutável quando ativa (mudança = nova versão). O sistema NÃO inventa regime: sem perfil ativo = fiscal_config_missing. Provisão fiscal (tax_rules/tax_reserve) = fatias 4c/4e. company_profiles/tax_profiles (fantasmas) NÃO são fonte fiscal.';

CREATE INDEX IF NOT EXISTS idx_afp_tenant_active
  ON actor_fiscal_profiles(tenant_id, status)
  WHERE status = 'active';

-- Imutabilidade (mesma doutrina de economic_policies/F1-a): a versão que orientou provisão
-- não é reescrita.
CREATE OR REPLACE FUNCTION enforce_actor_fiscal_profiles_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'actor_fiscal_profiles is append-only for % profiles: DELETE not allowed (profile %). Supersede with a new version.',
        OLD.status, OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'deprecated' THEN
    RAISE EXCEPTION
      'actor_fiscal_profiles: deprecated profile % is terminal and frozen — no UPDATE allowed. Create a new version instead.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD.status = 'active' THEN
    IF NEW.status NOT IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'actor_fiscal_profiles: active profile % cannot return to status % — only active→deprecated is allowed.',
        OLD.id, NEW.status
        USING ERRCODE = 'raise_exception';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.fiscal_identity_id IS DISTINCT FROM OLD.fiscal_identity_id
      OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
      OR NEW.tax_regime IS DISTINCT FROM OLD.tax_regime
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.configured_by_actor_id IS DISTINCT FROM OLD.configured_by_actor_id
      OR NEW.source IS DISTINCT FROM OLD.source
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION
        'actor_fiscal_profiles: active profile % is immutable — material fields cannot change. Allowed: status→deprecated and effective_until. Create a new version for regime changes.',
        OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS actor_fiscal_profiles_immutability ON actor_fiscal_profiles;
CREATE TRIGGER actor_fiscal_profiles_immutability
  BEFORE UPDATE OR DELETE ON actor_fiscal_profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_actor_fiscal_profiles_immutability();

ALTER TABLE actor_fiscal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_fiscal_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS actor_fiscal_profiles_tenant_isolation ON actor_fiscal_profiles;
CREATE POLICY actor_fiscal_profiles_tenant_isolation ON actor_fiscal_profiles
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;

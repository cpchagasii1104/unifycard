-- 20260710140000_create_tax_types_and_tax_rules.sql
-- DECISION-0166 D9 (Lei do Contador) — Fase 4 / fatia 4c-1 da frente F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION.
--
-- CATÁLOGO FISCAL GOVERNADO, VERSIONADO e VAZIO (D9.6). O UnifiCard NÃO é autoridade fiscal
-- e NÃO substitui contador (D9.1): quem configura tributos/regras é o contribuinte/contador/
-- admin autorizado. O catálogo NASCE VAZIO — catálogo vazio + regra fiscal exigida = bloqueio
-- fail-closed POR DESIGN, não bug (D9.6.18). ZERO seed de tributo real (ISS/ICMS/PIS/CBS/IBS).
--
--   - tax_types  = IDENTIDADE do tributo (o quê): code + esfera territorial (scope_level).
--                  SEM alíquota (alíquota pertence à REGRA, não ao tipo).
--   - tax_rules  = REGRA VERSIONADA (quanto/onde/para quem): rate_bps INTEIRO como DADO
--                  versionado (nunca literal em código — D9.6.16), vigência + fonte
--                  OBRIGATÓRIA + regime (vocabulário canônico D9.5, o MESMO de
--                  actor_fiscal_profiles) + território por FK Location Core (molde
--                  regional_fund_accounts/2a) + contribuinte actor|platform (D9.3).
--
--   - scope_level = subconjunto FISCAL do vocabulário territorial já governado em
--     regional_fund_accounts.scope_level (country/state/city ≙ federal/estadual/municipal).
--     'planet' não é jurisdição fiscal; 'neighborhood' não tributa (e segue HOLD — D4).
--     Não é vocabulário paralelo: é composição por subconjunto, documentada aqui.
--   - tax_regime NULL = regra vale para QUALQUER regime (explícito, não default mágico).
--   - taxpayer_kind separa fiscalidade do actor/empresa da fiscalidade da PRÓPRIA UnifiCard
--     (D9.3 — mesmas tabelas, contribuintes distintos); platform_revenue_stream (D9.5) só
--     existe em regra de plataforma (NULL = todos os streams).
--   - concept_id opcional referencia concepts (SSOT semântico) — NUNCA category_id
--     (categoria é TREE/navegação, não identidade — 00_AGENT_PROTOCOL §12/§2.3.5).
--   - Imutabilidade espelho de actor_fiscal_profiles/economic_policies (F1-a/4b): regra
--     ativa é IMUTÁVEL (só active→deprecated + effective_until); deprecated é TERMINAL;
--     DELETE bloqueado em active/deprecated (draft deletável). RLS ENABLE+FORCE (tenant-scoped
--     por decisão de Clayton no GO da 4c-1: infraestrutura configurável por tenant, não
--     catálogo global que faça o sistema parecer autoridade fiscal).
--   - SEM cálculo, SEM tax_reserve, SEM applies_to, SEM motor (4d exige GO próprio — D9.7).
--   - SEM toque em Bank/ledger/split/orders/checkout/payment_intents/invoicing (Δbank=0).
-- Forward-only, aditiva, idempotente; não toca dados nem dinheiro.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) tax_types — identidade do tributo (catálogo por tenant; nasce VAZIO)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  code TEXT NOT NULL
    CONSTRAINT chk_tax_types_code_nonempty CHECK (btrim(code) <> ''),
  name TEXT NOT NULL
    CONSTRAINT chk_tax_types_name_nonempty CHECK (btrim(name) <> ''),
  description TEXT NULL,

  -- Esfera territorial do tributo (subconjunto fiscal do vocabulário da 2a — ver cabeçalho).
  scope_level TEXT NOT NULL
    CONSTRAINT chk_tax_types_scope_level CHECK (scope_level IN ('country', 'state', 'city')),

  -- Proveniência do TIPO (norma/lei/contador/URL) — recomendada; obrigatória é a da REGRA.
  source TEXT NULL,

  status TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT chk_tax_types_status CHECK (status IN ('active', 'retired')),

  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ NULL,
  CONSTRAINT chk_tax_types_vigencia
    CHECK (effective_until IS NULL OR effective_until > effective_from),

  created_by_actor_id UUID NULL REFERENCES actors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_tax_types_tenant_code UNIQUE (tenant_id, code),
  -- Apoio à FK composta de tax_rules: trava MATERIAL "regra no mesmo nível do tributo".
  CONSTRAINT uq_tax_types_id_scope UNIQUE (id, scope_level)
);

COMMENT ON TABLE tax_types IS
  'DECISION-0166 D9 (Fase 4c-1). IDENTIDADE do tributo, por tenant (infraestrutura fiscal CONFIGURÁVEL — o UnifiCard não é autoridade fiscal). NASCE VAZIA por design (D9.6.18): nenhum tributo real semeado. Alíquota NÃO mora aqui (pertence a tax_rules). Cálculo/provisão = 4d (GO próprio, D9.7).';
COMMENT ON COLUMN tax_types.scope_level IS
  'Esfera do tributo: country/state/city (federal/estadual/municipal). Subconjunto FISCAL do vocabulário territorial governado de regional_fund_accounts.scope_level — planet não é jurisdição fiscal; neighborhood não tributa (D4 HOLD). Composição, não vocabulário paralelo.';

CREATE INDEX IF NOT EXISTS idx_tax_types_tenant_active
  ON tax_types(tenant_id, status)
  WHERE status = 'active';

-- Identidade do tipo é congelada; retired é terminal; DELETE só de tipo nunca-referenciado
-- (FK RESTRICT de tax_rules) e não-retired (histórico não some).
CREATE OR REPLACE FUNCTION enforce_tax_types_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'retired' THEN
      RAISE EXCEPTION
        'tax_types: retired tax type % is historical — DELETE not allowed.',
        OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION
      'tax_types: retired tax type % is terminal and frozen — no UPDATE allowed.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.code IS DISTINCT FROM OLD.code
    OR NEW.scope_level IS DISTINCT FROM OLD.scope_level
    OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
    OR NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION
      'tax_types: identity fields of tax type % are immutable (code/scope_level/tenant). Retire it and create a new type.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (OLD.status = 'active' AND NEW.status = 'retired')
  THEN
    RAISE EXCEPTION
      'tax_types: only active→retired transition is allowed for tax type %.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tax_types_immutability ON tax_types;
CREATE TRIGGER tax_types_immutability
  BEFORE UPDATE OR DELETE ON tax_types
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tax_types_immutability();

ALTER TABLE tax_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_types FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_types_tenant_isolation ON tax_types;
CREATE POLICY tax_types_tenant_isolation ON tax_types
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) tax_rules — regra versionada (alíquota como DADO; nasce VAZIA)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  tax_type_id UUID NOT NULL REFERENCES tax_types(id) ON DELETE RESTRICT,
  -- Nível da regra = nível do tributo, imposto pelo BANCO (FK composta), não por convenção.
  scope_level TEXT NOT NULL,
  CONSTRAINT fk_tax_rules_tax_type_scope
    FOREIGN KEY (tax_type_id, scope_level) REFERENCES tax_types(id, scope_level),

  -- D9.3: fiscalidade do actor/empresa ≠ fiscalidade da PRÓPRIA UnifiCard (mesma infraestrutura).
  taxpayer_kind TEXT NOT NULL
    CONSTRAINT chk_tax_rules_taxpayer_kind CHECK (taxpayer_kind IN ('actor', 'platform')),

  -- D9.5 platform revenue streams — SÓ para regra da plataforma; NULL = todos os streams.
  platform_revenue_stream TEXT NULL
    CONSTRAINT chk_tax_rules_platform_stream_vocab CHECK (
      platform_revenue_stream IS NULL OR platform_revenue_stream IN (
        'marketplace_commission', 'advertising', 'own_tickets',
        'acquiring_fees', 'physical_structures', 'other'
      )
    ),
  CONSTRAINT chk_tax_rules_stream_only_platform
    CHECK (taxpayer_kind = 'platform' OR platform_revenue_stream IS NULL),

  -- Vocabulário canônico D9.5 — o MESMO de actor_fiscal_profiles.tax_regime (TAX_REGIMES).
  -- NULL = regra vale para qualquer regime (explícito). Grafias curtas NÃO são regime.
  tax_regime TEXT NULL
    CONSTRAINT chk_tax_rules_regime CHECK (
      tax_regime IS NULL OR tax_regime IN (
        'MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'OTHER'
      )
    ),

  -- Escopo semântico opcional: CONCEPT é o SSOT (§12) — NUNCA category_id (TREE/navegação).
  concept_id UUID NULL REFERENCES concepts(concept_id),

  -- Território por FK Location Core, FKs COMPOSTAS hierárquicas (molde 2a):
  -- city de outro estado / estado de outro país são REJEITADOS pelo banco.
  country_id UUID NULL REFERENCES countries(country_id),
  state_id UUID NULL,
  city_id UUID NULL,
  CONSTRAINT fk_tax_rules_state
    FOREIGN KEY (country_id, state_id) REFERENCES states(country_id, state_id),
  CONSTRAINT fk_tax_rules_city
    FOREIGN KEY (state_id, city_id) REFERENCES cities(state_id, city_id),
  CONSTRAINT chk_tax_rules_territory_shape CHECK (
    (scope_level = 'country' AND country_id IS NOT NULL AND state_id IS NULL AND city_id IS NULL)
    OR (scope_level = 'state' AND country_id IS NOT NULL AND state_id IS NOT NULL AND city_id IS NULL)
    OR (scope_level = 'city' AND country_id IS NOT NULL AND state_id IS NOT NULL AND city_id IS NOT NULL)
  ),

  -- A ALÍQUOTA é DADO versionado (BPS inteiro, padrão do sistema) — nunca literal em código
  -- (D9.6.16; guard 4c-3). Sem teto artificial: tributos podem exceder 100% (rate_bps > 10000).
  rate_bps INTEGER NOT NULL
    CONSTRAINT chk_tax_rules_rate_bps CHECK (rate_bps >= 0),

  -- D9.6.17: vigência + fonte + versão obrigatórias.
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ NULL,
  CONSTRAINT chk_tax_rules_vigencia
    CHECK (effective_until IS NULL OR effective_until > effective_from),

  source TEXT NOT NULL
    CONSTRAINT chk_tax_rules_source_nonempty CHECK (btrim(source) <> ''),

  configured_by_actor_id UUID NULL REFERENCES actors(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT chk_tax_rules_status CHECK (status IN ('draft', 'active', 'deprecated')),
  version INTEGER NOT NULL DEFAULT 1
    CONSTRAINT chk_tax_rules_version CHECK (version >= 1),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Duplicata idêntica do MESMO escopo/versão barrada (NULLS NOT DISTINCT — PG17, molde 2a).
  CONSTRAINT uq_tax_rules_scope_version UNIQUE NULLS NOT DISTINCT (
    tenant_id, tax_type_id, taxpayer_kind, platform_revenue_stream,
    tax_regime, concept_id, country_id, state_id, city_id, version
  )
);

COMMENT ON TABLE tax_rules IS
  'DECISION-0166 D9 (Fase 4c-1). REGRA fiscal versionada: alíquota (rate_bps) como DADO governado — NUNCA hardcoded em código (D9.6.16). Vigência + fonte + regime (vocabulário D9.5) + território por FK Location Core + contribuinte actor|platform (D9.3). NASCE VAZIA (D9.6.18): vazio + regra exigida = fail-closed por design. Imutável quando ativa; deprecated terminal. NENHUM cálculo aqui — motor/provisão = 4d (GO próprio, D9.7); tax_reserve/applies_to = 4e.';
COMMENT ON COLUMN tax_rules.rate_bps IS
  'Alíquota em basis points INTEIROS (D9.6.16 — dado versionado, nunca literal em código). Sem teto: tributo pode exceder 100%.';
COMMENT ON COLUMN tax_rules.tax_regime IS
  'Vocabulário canônico D9.5 (mesmo TAX_REGIMES de actor_fiscal_profiles). NULL = qualquer regime (explícito, documentado — não é default mágico).';
COMMENT ON COLUMN tax_rules.concept_id IS
  'Escopo semântico opcional por CONCEPT (SSOT — 00_AGENT_PROTOCOL §12). category_id é PROIBIDO aqui (TREE/navegação não é identidade).';

CREATE INDEX IF NOT EXISTS idx_tax_rules_tenant_active
  ON tax_rules(tenant_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tax_rules_tax_type
  ON tax_rules(tax_type_id);

-- Imutabilidade espelho de actor_fiscal_profiles/F1-a: a regra que orientar provisão futura
-- não é reescrita por cima.
CREATE OR REPLACE FUNCTION enforce_tax_rules_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'tax_rules is append-only for % rules: DELETE not allowed (rule %). Supersede with a new version.',
        OLD.status, OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'deprecated' THEN
    RAISE EXCEPTION
      'tax_rules: deprecated rule % is terminal and frozen — no UPDATE allowed. Create a new version instead.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD.status = 'active' THEN
    IF NEW.status NOT IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'tax_rules: active rule % cannot return to status % — only active→deprecated is allowed.',
        OLD.id, NEW.status
        USING ERRCODE = 'raise_exception';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.tax_type_id IS DISTINCT FROM OLD.tax_type_id
      OR NEW.scope_level IS DISTINCT FROM OLD.scope_level
      OR NEW.taxpayer_kind IS DISTINCT FROM OLD.taxpayer_kind
      OR NEW.platform_revenue_stream IS DISTINCT FROM OLD.platform_revenue_stream
      OR NEW.tax_regime IS DISTINCT FROM OLD.tax_regime
      OR NEW.concept_id IS DISTINCT FROM OLD.concept_id
      OR NEW.country_id IS DISTINCT FROM OLD.country_id
      OR NEW.state_id IS DISTINCT FROM OLD.state_id
      OR NEW.city_id IS DISTINCT FROM OLD.city_id
      OR NEW.rate_bps IS DISTINCT FROM OLD.rate_bps
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.source IS DISTINCT FROM OLD.source
      OR NEW.configured_by_actor_id IS DISTINCT FROM OLD.configured_by_actor_id
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION
        'tax_rules: active rule % is immutable — material fields cannot change. Allowed: status→deprecated and effective_until. Create a new version for changes.',
        OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tax_rules_immutability ON tax_rules;
CREATE TRIGGER tax_rules_immutability
  BEFORE UPDATE OR DELETE ON tax_rules
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tax_rules_immutability();

ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_rules_tenant_isolation ON tax_rules;
CREATE POLICY tax_rules_tenant_isolation ON tax_rules
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) VERIFICAÇÃO PÓS (fail-closed) — sem seed: o catálogo DEVE terminar vazio.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.tax_types') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tax_types nao foi criada';
  END IF;
  IF to_regclass('public.tax_rules') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tax_rules nao foi criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tax_rules_tax_type_scope') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fk_tax_rules_tax_type_scope ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tax_rules_source_nonempty') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: chk_tax_rules_source_nonempty ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'tax_rules' AND c.relrowsecurity AND c.relforcerowsecurity) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS ENABLE+FORCE ausente em tax_rules';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = 'tax_types' AND c.relrowsecurity AND c.relforcerowsecurity) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS ENABLE+FORCE ausente em tax_types';
  END IF;
END $$;

COMMIT;

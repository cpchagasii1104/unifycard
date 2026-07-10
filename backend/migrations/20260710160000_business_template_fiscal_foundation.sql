-- 20260710160000_business_template_fiscal_foundation.sql
-- F-SEGMENT-TEMPLATE-FISCAL-FOUNDATION Fase A (DECISION-0168; compõe DECISION-0117 E + DECISION-0167).
--
-- A MENOR fundação material da faceta FISCAL dos business_templates:
--   (1) ENDURECE business_template_versions (dívida R1 do GATE): versão de template é IMUTÁVEL
--       depois de criada — UPDATE/DELETE falham no BANCO; mudar template = NOVA versão; aplicações
--       (company_template_applications) seguem apontando para história intacta. Recon prévio provou
--       ZERO UPDATE/DELETE vivo em versions (runtime e migrations) → quebra zero.
--   (2) business_template_fiscal_profiles — faceta fiscal de UMA versão de template, com TERRITÓRIO
--       DE VALIDADE (FKs compostas Location Core, molde 2a/4c-1), status draft/published/deprecated
--       (published IMUTÁVEL; deprecated TERMINAL — espelho 4b/4c), fonte obrigatória.
--   (3) business_template_fiscal_items — linhas de SUGESTÃO/checklist (tax_suggestion/checklist/
--       document/classification_hint), referenciando concepts (SSOT semântico) e vocabulários
--       governados (taxpayer_kind, TaxRegime D9.5, base_type da DECISION-0167 §5).
--
-- O QUE ESTA CASA NÃO É (DECISION-0168 §3): template NÃO é verdade fiscal — é SUGESTÃO/molde.
--   - SEM coluna de alíquota (rate_bps/percent/tax_rate NÃO existem aqui — template não inventa
--     alíquota; sugere QUE tributo existe, nunca QUANTO).
--   - SEM FK para tax_types/tax_rules (impossível por design: catálogo fiscal é TENANT-scoped,
--     template é referência GLOBAL; a ativação — Fase C — cria as regras DO TENANT pela via
--     canônica createDraftRule→activateRule, com validação do contador).
--   - SEM category_id (concept é a identidade — N2/§3.2 proíbe "slug açougue → assumir carne").
--   - Tabelas GLOBAIS de referência SEM tenant_id e SEM RLS — mesmo padrão das irmãs de referência
--     global (concepts, concept_asset_eligibilities, concept_offer_kinds, business_templates):
--     quem é por-tenant é a CONFIGURAÇÃO ativa (tax_rules), nunca o modelo.
--   - NASCE VAZIA: zero seed, zero template fiscal real, zero ISS/ICMS (nomes reais só entrarão
--     como texto de referência CURADO em fatia futura com GO próprio).
-- Forward-only, aditiva, idempotente; não toca dados, dinheiro, tax_rules, motor, Bank.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) FREEZE de business_template_versions (R1): versão criada é história.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_business_template_versions_freeze()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'business_template_versions is append-only: DELETE not allowed (version % of template %). Create a new version instead.',
      OLD.version, OLD.template_id
      USING ERRCODE = 'raise_exception';
  END IF;
  RAISE EXCEPTION
    'business_template_versions is immutable: UPDATE not allowed (version % of template %). Applied history cannot be rewritten — create a new version.',
    OLD.version, OLD.template_id
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS business_template_versions_freeze ON business_template_versions;
CREATE TRIGGER business_template_versions_freeze
  BEFORE UPDATE OR DELETE ON business_template_versions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_business_template_versions_freeze();

-- ────────────────────────────────────────────────────────────────────────────
-- 2) business_template_fiscal_profiles — faceta fiscal (GLOBAL, vazia)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_template_fiscal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Âncora ÚNICA: a versão do template comercial (DECISION-0117 E). Nunca solta,
  -- nunca em company_types/business_segments (anti-4ª-noção de segmento).
  template_version_id UUID NOT NULL REFERENCES business_template_versions(id) ON DELETE RESTRICT,

  status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT chk_btfp_status CHECK (status IN ('draft', 'published', 'deprecated')),

  -- Território de validade (um modelo fiscal de Curitiba NÃO é o de Manaus).
  -- Mesmo subconjunto fiscal do vocabulário territorial (4c-1) + FKs compostas (molde 2a).
  scope_level TEXT NOT NULL
    CONSTRAINT chk_btfp_scope_level CHECK (scope_level IN ('country', 'state', 'city')),
  country_id UUID NULL REFERENCES countries(country_id),
  state_id UUID NULL,
  city_id UUID NULL,
  CONSTRAINT fk_btfp_state
    FOREIGN KEY (country_id, state_id) REFERENCES states(country_id, state_id),
  CONSTRAINT fk_btfp_city
    FOREIGN KEY (state_id, city_id) REFERENCES cities(state_id, city_id),
  CONSTRAINT chk_btfp_territory_shape CHECK (
    (scope_level = 'country' AND country_id IS NOT NULL AND state_id IS NULL AND city_id IS NULL)
    OR (scope_level = 'state' AND country_id IS NOT NULL AND state_id IS NOT NULL AND city_id IS NULL)
    OR (scope_level = 'city' AND country_id IS NOT NULL AND state_id IS NOT NULL AND city_id IS NOT NULL)
  ),

  -- Curadoria (DECISION-0168 §9): fonte e autoria obrigatórias; "modelo de referência,
  -- requer validação" é aviso fixo do read-model, não coluna.
  source TEXT NOT NULL
    CONSTRAINT chk_btfp_source_nonempty CHECK (btrim(source) <> ''),
  created_by_actor_id UUID NULL REFERENCES actors(id) ON DELETE SET NULL,
  notes TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UMA publicação viva por (versão de template × território); drafts são livres.
CREATE UNIQUE INDEX IF NOT EXISTS uq_btfp_published_per_territory
  ON business_template_fiscal_profiles (template_version_id, country_id, state_id, city_id)
  NULLS NOT DISTINCT
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_btfp_template_version
  ON business_template_fiscal_profiles (template_version_id);

COMMENT ON TABLE business_template_fiscal_profiles IS
  'DECISION-0168 (Fase A). Faceta FISCAL de uma versão de business_template: SUGESTÃO/molde por território, com curadoria (fonte/autor/versão via FK). NÃO é verdade fiscal: sem alíquota, sem FK a tax_types/tax_rules (catálogo é tenant-scoped; ativação = Fase C via rito canônico do contador). published imutável; deprecated terminal. NASCE VAZIA (zero template real).';

-- Imutabilidade: draft ajustável e deletável; published CONGELADO (só published→deprecated);
-- deprecated TERMINAL; DELETE de published/deprecated bloqueado (espelho 4b/4c).
CREATE OR REPLACE FUNCTION enforce_btfp_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('published', 'deprecated') THEN
      RAISE EXCEPTION
        'business_template_fiscal_profiles is append-only for % profiles: DELETE not allowed (profile %). Supersede with a new profile.',
        OLD.status, OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'deprecated' THEN
    RAISE EXCEPTION
      'business_template_fiscal_profiles: deprecated profile % is terminal and frozen — no UPDATE allowed.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status NOT IN ('published', 'deprecated') THEN
      RAISE EXCEPTION
        'business_template_fiscal_profiles: published profile % cannot return to status % — only published→deprecated is allowed.',
        OLD.id, NEW.status
        USING ERRCODE = 'raise_exception';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.template_version_id IS DISTINCT FROM OLD.template_version_id
      OR NEW.scope_level IS DISTINCT FROM OLD.scope_level
      OR NEW.country_id IS DISTINCT FROM OLD.country_id
      OR NEW.state_id IS DISTINCT FROM OLD.state_id
      OR NEW.city_id IS DISTINCT FROM OLD.city_id
      OR NEW.source IS DISTINCT FROM OLD.source
      OR NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION
        'business_template_fiscal_profiles: published profile % is immutable — a publication cannot be silently altered. Allowed: status→deprecated. Create a new profile for changes.',
        OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS btfp_immutability ON business_template_fiscal_profiles;
CREATE TRIGGER btfp_immutability
  BEFORE UPDATE OR DELETE ON business_template_fiscal_profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_btfp_immutability();

-- ────────────────────────────────────────────────────────────────────────────
-- 3) business_template_fiscal_items — linhas de sugestão/checklist (GLOBAL, vazia)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_template_fiscal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_profile_id UUID NOT NULL REFERENCES business_template_fiscal_profiles(id) ON DELETE CASCADE,

  item_kind TEXT NOT NULL
    CONSTRAINT chk_btfi_item_kind CHECK (item_kind IN ('tax_suggestion', 'checklist', 'document', 'classification_hint')),

  -- Dimensões fiscais da SUGESTÃO (vocabulários governados; nunca segunda verdade):
  scope_level TEXT NULL
    CONSTRAINT chk_btfi_scope_level CHECK (scope_level IS NULL OR scope_level IN ('country', 'state', 'city')),
  taxpayer_kind TEXT NULL
    CONSTRAINT chk_btfi_taxpayer_kind CHECK (taxpayer_kind IS NULL OR taxpayer_kind IN ('actor', 'platform')),
  tax_regime TEXT NULL
    CONSTRAINT chk_btfi_regime CHECK (
      tax_regime IS NULL OR tax_regime IN ('MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'OTHER')
    ),
  -- Referência TEXTUAL ao tributo (nomes reais como ISS/ICMS entram como REFERÊNCIA CURADA em
  -- fatia futura; NÃO é tax_types — sem FK por design, catálogo é tenant-scoped).
  suggested_tax_code TEXT NULL,
  suggested_tax_name TEXT NULL,
  -- Hint de base (vocabulário DECISION-0167 §5) — orienta a configuração; não calcula nada.
  base_type TEXT NULL
    CONSTRAINT chk_btfi_base_type CHECK (
      base_type IS NULL OR base_type IN ('gross_transaction', 'commission_gross', 'commission_distributable')
    ),
  -- tax_suggestion exige o mínimo para orientar o contador (coerência material):
  CONSTRAINT chk_btfi_tax_suggestion_shape CHECK (
    item_kind <> 'tax_suggestion'
    OR (scope_level IS NOT NULL AND taxpayer_kind IS NOT NULL AND suggested_tax_name IS NOT NULL)
  ),

  -- Escopo semântico opcional: CONCEPT é o SSOT (§12) — category NÃO entra nesta casa.
  concept_id UUID NULL REFERENCES concepts(concept_id),

  rationale TEXT NOT NULL
    CONSTRAINT chk_btfi_rationale_nonempty CHECK (btrim(rationale) <> ''),
  source TEXT NOT NULL
    CONSTRAINT chk_btfi_source_nonempty CHECK (btrim(source) <> ''),

  display_order INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_btfi_profile
  ON business_template_fiscal_items (fiscal_profile_id);

COMMENT ON TABLE business_template_fiscal_items IS
  'DECISION-0168 (Fase A). Linhas de SUGESTÃO/checklist da faceta fiscal do template. SEM alíquota (template sugere QUE tributo existe, nunca QUANTO — rate mora em tax_rules do TENANT após validação do contador); SEM FK a tax_types/tax_rules; concept_id→concepts quando aplicável (category proibida). Congeladas quando o profile pai é published/deprecated (espelho F1-b). NASCE VAZIA.';

-- Freeze espelho F1-b: itens de profile published/deprecated são história congelada.
CREATE OR REPLACE FUNCTION enforce_btfi_freeze_when_published()
RETURNS trigger AS $$
DECLARE
  v_status TEXT;
  v_profile UUID;
BEGIN
  v_profile := COALESCE(NEW.fiscal_profile_id, OLD.fiscal_profile_id);
  SELECT status INTO v_status FROM business_template_fiscal_profiles WHERE id = v_profile;

  IF v_status IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD; -- cascade de profile draft deletado
    END IF;
    RAISE EXCEPTION
      'business_template_fiscal_items: fiscal profile % not visible/found — fail-closed.',
      v_profile
      USING ERRCODE = 'raise_exception';
  END IF;

  IF v_status IN ('published', 'deprecated') THEN
    RAISE EXCEPTION
      'business_template_fiscal_items: profile % is % — items are frozen history (no INSERT/UPDATE/DELETE). Create a new profile version.',
      v_profile, v_status
      USING ERRCODE = 'raise_exception';
  END IF;

  -- anti-repoint: item não migra de profile para escapar do freeze
  IF TG_OP = 'UPDATE' AND NEW.fiscal_profile_id IS DISTINCT FROM OLD.fiscal_profile_id THEN
    RAISE EXCEPTION
      'business_template_fiscal_items: repointing item % to another profile is not allowed.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS btfi_freeze_when_published ON business_template_fiscal_items;
CREATE TRIGGER btfi_freeze_when_published
  BEFORE INSERT OR UPDATE OR DELETE ON business_template_fiscal_items
  FOR EACH ROW
  EXECUTE FUNCTION enforce_btfi_freeze_when_published();

-- ────────────────────────────────────────────────────────────────────────────
-- 4) VERIFICAÇÃO PÓS (fail-closed) — casa criada, travada e VAZIA.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.business_template_fiscal_profiles') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: business_template_fiscal_profiles nao foi criada';
  END IF;
  IF to_regclass('public.business_template_fiscal_items') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: business_template_fiscal_items nao foi criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'business_template_versions_freeze') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: freeze de business_template_versions ausente (R1)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'btfp_immutability') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: imutabilidade de fiscal_profiles ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'btfi_freeze_when_published') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: freeze de fiscal_items ausente';
  END IF;
  IF EXISTS (SELECT 1 FROM business_template_fiscal_profiles) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fiscal_profiles NAO nasceu vazia';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name IN ('business_template_fiscal_profiles', 'business_template_fiscal_items')
       AND column_name IN ('rate_bps', 'percent', 'tax_rate', 'category_id', 'tenant_id')
  ) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: coluna proibida na casa de templates fiscais';
  END IF;
END $$;

COMMIT;

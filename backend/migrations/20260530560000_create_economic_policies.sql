-- ============================================================
-- PE-1: Economic Policy Engine substrate — economic_policies
-- ============================================================
-- Sessão: 2026-05-26 (Policy Engine FASE 1)
--
-- Tabela principal de POLICY ECONÔMICA configurável. Substitui o
-- registry genérico bank_policies (que continua legado/compat) para
-- governar split de comissões, access pass, hybrid e promo, com
-- seletores ricos (geo + módulo + actor + categoria + vigência).
--
-- Para o motor de cálculo financeiro:
--   - lines associadas vivem em economic_policy_lines.
--   - access_pass override vive em access_pass_products + actor_access_passes.
--   - log de resolução vive em economic_policy_resolution_logs.
--
-- Decisões Clayton/ChatGPT (DECISION-0047, próxima):
--   - tabela tipada (NÃO usar bank_policies.value_json).
--   - seletores completos: country/region/city/module/vertical/categoria/
--     actor_type/service_type/pricing_model/settlement_flow/channel/campaign.
--   - category_id entra como seletor (decisão K_pe_4).
--   - BPS inteiro nas LINHAS — esta tabela só carrega seletores + tipo.
--   - vigência effective_from/effective_until + status + version.
--
-- NÃO mexe em código financeiro. NÃO altera bank_policies. NÃO liga
-- service_execution ainda — esta é apenas a base de configuração.
--
-- Reversibilidade: ALTA (DROP TABLE). Blast: ZERO (tabela nova).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS economic_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identificação humana legível
  policy_code TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,

  -- Tipo de política (discriminated union)
  policy_type TEXT NOT NULL
    CHECK (policy_type IN (
      'COMMISSION_SPLIT',
      'ACCESS_PASS',
      'HYBRID',
      'ZERO_FEE',
      'CONTRACTUAL'
    )),

  -- Contexto/módulo (obrigatório — ancora resolução)
  module_context TEXT NOT NULL,

  -- Seletores opcionais (NULL = any). Maior número de campos NOT NULL
  -- = maior specificity na resolução.
  vertical TEXT,
  actor_type TEXT,
  service_type TEXT,
  pricing_model TEXT,
  settlement_flow TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  category_id UUID,  -- FK opcional (categories.category_id); sem ON DELETE
                     -- restritivo por enquanto — limpeza manual se categoria
                     -- for removida.
  channel TEXT,
  campaign_id UUID,

  -- Prioridade (maior vence em empate de specificity).
  priority INTEGER NOT NULL DEFAULT 0,

  -- Status (active = elegível na resolução).
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'deprecated')),

  -- Vigência temporal.
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  CHECK (effective_until IS NULL OR effective_until > effective_from),

  -- Metadata livre (descrição, autor, contexto regulatório etc.).
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by_actor_id UUID REFERENCES actors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, policy_code, version)
);

-- FK opcional para categories — não bloqueia DELETE em categories
-- nem força integridade ON DELETE (Camada nominalmente desacoplada).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='categories'
       AND column_name='category_id'
  ) THEN
    BEGIN
      ALTER TABLE economic_policies
        ADD CONSTRAINT fk_economic_policies_category
        FOREIGN KEY (category_id)
        REFERENCES categories(category_id)
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  ELSE
    RAISE WARNING 'categories.category_id não encontrado — FK de categoria não criada';
  END IF;
END$$;

-- Índice principal — fast path do resolutor (filtro por tenant +
-- module_context + status + vigência + priority).
CREATE INDEX IF NOT EXISTS idx_economic_policies_lookup
  ON economic_policies(tenant_id, module_context, status, priority DESC, effective_from DESC)
  WHERE status = 'active';

-- Índice complementar para auditoria/operação por code.
CREATE INDEX IF NOT EXISTS idx_economic_policies_code
  ON economic_policies(tenant_id, policy_code);

-- Trigger updated_at.
CREATE OR REPLACE FUNCTION update_economic_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_economic_policies_updated_at ON economic_policies;
CREATE TRIGGER trigger_update_economic_policies_updated_at
  BEFORE UPDATE ON economic_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_economic_policies_updated_at();

-- RLS — pattern alinhado com bank_policies (app.current_tenant).
ALTER TABLE economic_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_policies FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY economic_policies_tenant_isolation ON economic_policies
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

COMMENT ON TABLE economic_policies IS
  'Policy Engine Econômico — registry de políticas tipadas com seletores
   ricos (geo + módulo + actor + categoria + canal + campanha) e vigência
   temporal. Substitui bank_policies para fluxos novos (DECISION-0047).
   Linhas de split em economic_policy_lines; access pass em
   access_pass_products + actor_access_passes; log de resolução em
   economic_policy_resolution_logs.';

COMMENT ON COLUMN economic_policies.policy_type IS
  'Discriminated union: COMMISSION_SPLIT (split percentual via lines);
   ACCESS_PASS (referência a produto; override por actor com pass ativo);
   HYBRID (split + override por pass); ZERO_FEE (100% revenue_share);
   CONTRACTUAL (manual/contrato específico — payload em metadata).';

COMMENT ON COLUMN economic_policies.category_id IS
  'FK opcional para categories.category_id. Categoria entra como seletor
   por decisão Clayton K_pe_4 (2026-05-26). Documento Category_System_
   Contract pode precisar atualização se vetar uso explícito — verificar
   antes de seedar policies com categoria.';

COMMIT;

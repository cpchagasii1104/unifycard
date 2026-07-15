-- FISCAL 4D-1 (DECISION-0167 §4/§7.3/§12; GO material D9.7 2026-07-14) — trilha append-only da
-- decisão fiscal do motor read-only de provisão.
--
-- CLASSE: LOG (taxonomia SSOT_REGISTRY §V) — trilha IMUTÁVEL do cálculo realizado. NÃO é catálogo,
-- NÃO é policy, NÃO é apuração oficial, NÃO é SSOT financeiro, NÃO decide saldo/estado. Nenhuma FK
-- para bank_*. Molde: economic_policy_resolution_logs (append-only, auditável).
--
-- Cardinalidade (0167 §4 + §7.3): UMA linha por TaxProvisionResult (por regra aplicada, status
-- 'found'/'not_applicable') e UMA linha por resolução ausente (status 'fiscal_config_missing',
-- tax_rule_id NULL, missing_reason discriminado). "Toda resolução (achou ou não) registra."
--
-- IDEMPOTÊNCIA (0167 §2): identidade do evento = (source_module, source_reference_id) do
-- TaxableEvent + passada do contribuinte. UNIQUE NULLS NOT DISTINCT impede duplicação silenciosa
-- da mesma decisão para o mesmo evento/passada/regra. Retry = ON CONFLICT (verificado pelo motor
-- contra contradição), nunca segunda decisão divergente.
--
-- SEM PII (0167 §4): só IDs canônicos, enums governados e centavos inteiros. PROIBIDO: CPF/CNPJ,
-- endereço, CEP, nome civil, dados bancários, account_id, texto livre substituindo enum.

BEGIN;

CREATE TABLE fiscal_provision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  -- identidade do evento econômico (0167 §2)
  source_module TEXT NOT NULL CHECK (btrim(source_module) <> ''),
  source_reference_id TEXT NOT NULL CHECK (btrim(source_reference_id) <> ''),
  occurred_at TIMESTAMPTZ NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,

  -- contribuinte (passada) por IDs canônicos
  taxpayer_kind TEXT NOT NULL CHECK (taxpayer_kind IN ('actor', 'platform')),
  contributor_actor_id UUID NULL REFERENCES actors (id),
  fiscal_identity_id UUID NULL REFERENCES fiscal_identities (fiscal_identity_id),
  actor_fiscal_profile_id UUID NULL REFERENCES actor_fiscal_profiles (id),
  actor_fiscal_profile_version INTEGER NULL,
  tax_regime TEXT NULL CHECK (tax_regime IS NULL OR tax_regime IN ('MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'OTHER')),
  platform_revenue_stream TEXT NULL CHECK (platform_revenue_stream IS NULL OR platform_revenue_stream IN ('marketplace_commission', 'advertising', 'own_tickets', 'acquiring_fees', 'physical_structures', 'other')),
  concept_id UUID NULL REFERENCES concepts (concept_id),

  -- jurisdição fiscal cadastral do contribuinte (IDs canônicos Location Core)
  country_id UUID NULL REFERENCES countries (country_id),
  state_id UUID NULL,
  city_id UUID NULL,
  CONSTRAINT fk_fpl_state FOREIGN KEY (country_id, state_id) REFERENCES states (country_id, state_id),
  CONSTRAINT fk_fpl_city FOREIGN KEY (state_id, city_id) REFERENCES cities (state_id, city_id),

  -- decisão por regra (0167 §4); NULL quando status='fiscal_config_missing'
  base_type TEXT NULL CHECK (base_type IS NULL OR base_type IN ('gross_transaction', 'commission_gross', 'commission_distributable')),
  base_cents BIGINT NULL CHECK (base_cents IS NULL OR base_cents >= 0),
  tax_rule_id UUID NULL REFERENCES tax_rules (id),
  tax_rule_version INTEGER NULL,
  tax_type_id UUID NULL REFERENCES tax_types (id),
  rate_bps INTEGER NULL CHECK (rate_bps IS NULL OR rate_bps >= 0),
  rounding_mode TEXT NULL CHECK (rounding_mode IS NULL OR rounding_mode IN ('half_up', 'half_even', 'floor', 'ceil')),
  provision_cents BIGINT NULL,

  -- agregados da passada (ecoados em toda linha do mesmo evento/passada; auditáveis)
  tax_reserve_cents BIGINT NULL,
  commission_distributable_cents BIGINT NULL,

  -- status honesto e discriminado (0167 §4/§7; D9.2)
  status TEXT NOT NULL CHECK (status IN ('found', 'fiscal_config_missing', 'not_applicable')),
  missing_reason TEXT NULL CHECK (missing_reason IS NULL OR missing_reason IN (
    'active_platform_fiscal_profile_missing',
    'fiscal_identity_missing',
    'tax_type_missing',
    'tax_rule_missing',
    'tax_rule_out_of_effectivity',
    'fiscal_territory_missing',
    'revenue_stream_invalid',
    'concept_invalid',
    'rounding_mode_missing',
    'fiscal_config_ambiguous'
  )),
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- reprodutibilidade
  calculation_version INTEGER NOT NULL CHECK (calculation_version >= 1),
  fiscal_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- coerência: found exige a decisão completa; missing exige a razão
  CONSTRAINT chk_fpl_found_shape CHECK (
    status <> 'found' OR (
      tax_rule_id IS NOT NULL AND tax_rule_version IS NOT NULL AND tax_type_id IS NOT NULL
      AND base_type IS NOT NULL AND base_cents IS NOT NULL AND rate_bps IS NOT NULL
      AND rounding_mode IS NOT NULL AND provision_cents IS NOT NULL
    )
  ),
  CONSTRAINT chk_fpl_missing_shape CHECK (
    status <> 'fiscal_config_missing' OR (missing_reason IS NOT NULL AND tax_rule_id IS NULL)
  ),

  -- idempotência: uma decisão por evento/passada/regra (regra NULL = a linha de missing)
  CONSTRAINT uq_fpl_event_rule UNIQUE NULLS NOT DISTINCT
    (tenant_id, source_module, source_reference_id, taxpayer_kind, platform_revenue_stream, tax_rule_id, tax_rule_version)
);

CREATE INDEX idx_fpl_tenant_event ON fiscal_provision_logs (tenant_id, source_module, source_reference_id);
CREATE INDEX idx_fpl_tenant_created ON fiscal_provision_logs (tenant_id, created_at DESC);

-- APPEND-ONLY: trilha nunca é reescrita (mudança futura de regra NÃO altera decisão passada).
CREATE OR REPLACE FUNCTION fiscal_provision_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'FISCAL_PROVISION_LOG_IMMUTABLE: trilha fiscal é append-only (0167 §7.3) — % proibido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fiscal_provision_logs_no_update
  BEFORE UPDATE ON fiscal_provision_logs
  FOR EACH ROW EXECUTE FUNCTION fiscal_provision_logs_immutable();

CREATE TRIGGER fiscal_provision_logs_no_delete
  BEFORE DELETE ON fiscal_provision_logs
  FOR EACH ROW EXECUTE FUNCTION fiscal_provision_logs_immutable();

ALTER TABLE fiscal_provision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_provision_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY fiscal_provision_logs_tenant_isolation ON fiscal_provision_logs
  USING (tenant_id = (current_setting('app.current_tenant', true))::uuid);

COMMENT ON TABLE fiscal_provision_logs IS
  'FISCAL 4D-1 (DECISION-0167 §7.3): trilha append-only da decisão do motor de provisão. Classe LOG '
  '(não-SSOT financeiro): não decide saldo/catálogo/policy; snapshot imutável sem PII; sem FK bank_*.';

COMMIT;

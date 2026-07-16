-- 20260716120000_fiscal_tax_reserve_bank_substrate.sql
-- FISCAL-4E — DECISION-0179 (materialização financeira da reserva fiscal) + DECISION-0182 (D10:
-- allowlist commission_distributable vazia + continuação residual da source line).
--
-- SUBSTRATO INTERNO E DORMENTE: zero conta fiscal real, zero seed, zero saldo, zero caller, zero
-- movimentação. O dinheiro continua tendo UMA verdade (bank_ledger). fiscal_reserve_accounts e
-- fiscal_provision_events são EVIDÊNCIA por FK, NUNCA saldo. Direção de FK: Bank→fiscal e logs→fiscal
-- (o domínio fiscal NUNCA conhece Bank). Forward-only, transacional (BEGIN…COMMIT).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. bank_splits.split_type — PRIMEIRO CHECK físico governado (hoje é TEXT livre, sem CHECK).
--    Exatamente os 7 valores canônicos de BANK_SPLIT_TYPES (DECISION-0180/0181 + 0179 D5).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE bank_splits
  ADD CONSTRAINT chk_bank_splits_split_type
  CHECK (split_type IN (
    'fee', 'regional_fund', 'reserve', 'escrow', 'revenue_share', 'referral', 'tax_reserve'));

-- ─────────────────────────────────────────────────────────────────────────────
-- B. bank_accounts.account_type — 14 → 15 (adiciona SOMENTE 'fiscal_reserve'; 14 preservados
--    literalmente, nenhum removido/renomeado/aliased). DECISION-0179 D6.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE bank_accounts DROP CONSTRAINT bank_accounts_account_type_check;
ALTER TABLE bank_accounts
  ADD CONSTRAINT bank_accounts_account_type_check
  CHECK (account_type IN (
    'credit', 'user_wallet', 'escrow_payments', 'escrow_disputes', 'seller_pending',
    'seller_available', 'seller_payout', 'platform_revenue', 'platform_fees', 'clearing',
    'bank_settlement', 'adjustment', 'risk_reserve', 'actor_wallet', 'fiscal_reserve'));

-- ─────────────────────────────────────────────────────────────────────────────
-- C. fiscal_reserve_accounts — mapa LOOKUP-ONLY (molde regional_fund_accounts). SEM saldo.
--    Chave institucional (tenant_id, fiscal_identity_id, currency) → bank_account_id.
--    A jurisdição fiscal NÃO entra na unicidade (vive no snapshot da operação — DECISION-0179 D3).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fiscal_reserve_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fiscal_identity_id UUID NOT NULL REFERENCES fiscal_identities(fiscal_identity_id),
  currency TEXT NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fra_identity_currency UNIQUE (tenant_id, fiscal_identity_id, currency),
  CONSTRAINT uq_fra_bank_account UNIQUE (bank_account_id)
);
COMMENT ON TABLE fiscal_reserve_accounts IS
  'FISCAL-4E (DECISION-0179 D3). Mapa lookup-only (tenant_id, fiscal_identity_id, currency) -> bank_account_id (account_type=fiscal_reserve). SEM saldo (bank_ledger e a unica verdade do dinheiro). Zero seed / zero auto-provision / zero fallback regional. Jurisdicao fiscal NAO entra na unicidade.';
CREATE INDEX idx_fra_tenant ON fiscal_reserve_accounts(tenant_id);

-- Coerência material da conta mapeada: mesmo tenant + account_type='fiscal_reserve' (garantido no banco).
CREATE OR REPLACE FUNCTION fn_fiscal_reserve_accounts_validate()
RETURNS TRIGGER AS $$
DECLARE acc RECORD;
BEGIN
  SELECT tenant_id, account_type INTO acc FROM bank_accounts WHERE id = NEW.bank_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FISCAL_RESERVE_MAP_BANK_ACCOUNT_MISSING';
  END IF;
  IF acc.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'FISCAL_RESERVE_MAP_CROSS_TENANT';
  END IF;
  IF acc.account_type <> 'fiscal_reserve' THEN
    RAISE EXCEPTION 'FISCAL_RESERVE_MAP_ACCOUNT_TYPE_INVALID';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_fiscal_reserve_accounts_validate ON fiscal_reserve_accounts;
CREATE TRIGGER trg_fiscal_reserve_accounts_validate
  BEFORE INSERT OR UPDATE ON fiscal_reserve_accounts
  FOR EACH ROW EXECUTE FUNCTION fn_fiscal_reserve_accounts_validate();

ALTER TABLE fiscal_reserve_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_reserve_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fiscal_reserve_accounts_tenant_isolation ON fiscal_reserve_accounts;
CREATE POLICY fiscal_reserve_accounts_tenant_isolation ON fiscal_reserve_accounts
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- D. fiscal_provision_events — cabeçalho APPEND-ONLY e IMUTÁVEL da composição fiscal-econômica.
--    Evidência, NUNCA saldo; NÃO conhece Bank. DECISION-0179 D7/D9 + DECISION-0182 D2/D3.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE fiscal_provision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fiscal_identity_id UUID NOT NULL REFERENCES fiscal_identities(fiscal_identity_id),
  taxpayer_kind TEXT NOT NULL CHECK (taxpayer_kind = 'platform'),          -- D14: PLATFORM only
  currency TEXT NOT NULL,
  -- idempotência (D11): raiz canônica + fingerprint dedicado (reference_id NÃO é fingerprint)
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  fiscal_economic_context_fingerprint TEXT NOT NULL,
  -- conservação da comissão (D1/D2) — centavos inteiros
  commission_gross_cents BIGINT NOT NULL,
  tax_reserve_cents BIGINT NOT NULL,
  commission_distributable_cents BIGINT NOT NULL,
  -- continuação residual (DECISION-0182): source line explícita + destino preservado
  source_line_ref JSONB NOT NULL,
  destination_snapshot JSONB NOT NULL,
  -- territórios nomeados por papel (D9): fiscal materializado; buyer reservado a B-CITY-2
  fiscal_jurisdiction JSONB NOT NULL,
  buyer_territory JSONB NULL,
  -- snapshot versionado
  snapshot_version INTEGER NOT NULL,
  fiscal_snapshot JSONB NOT NULL,
  -- reversão integral (D16): novo evento aponta ao original; nunca edição
  event_kind TEXT NOT NULL DEFAULT 'provision' CHECK (event_kind IN ('provision', 'full_reversal')),
  reverses_event_id UUID NULL REFERENCES fiscal_provision_events(id),
  status TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- conservação garantida no banco
  CONSTRAINT chk_fpe_conservation
    CHECK (commission_gross_cents = tax_reserve_cents + commission_distributable_cents),
  -- idempotência: mesma raiz + mesmo fingerprint = mesma linha; fingerprint divergente = nova linha
  CONSTRAINT uq_fpe_reference
    UNIQUE (tenant_id, reference_type, reference_id, fiscal_economic_context_fingerprint),
  -- full_reversal exige vínculo ao original; provision não
  CONSTRAINT chk_fpe_reversal_link
    CHECK ((event_kind = 'full_reversal' AND reverses_event_id IS NOT NULL)
        OR (event_kind = 'provision'     AND reverses_event_id IS NULL))
);
COMMENT ON TABLE fiscal_provision_events IS
  'FISCAL-4E (DECISION-0179 D7/D9). Cabecalho append-only e IMUTAVEL da composicao fiscal-economica. Evidencia, NUNCA saldo; NAO conhece Bank (FK so Bank->fiscal). Cardinalidade 1 bank_transaction -> 1 fiscal_provision_event -> N fiscal_provision_logs. Reversao = novo evento full_reversal apontando ao original.';
CREATE INDEX idx_fpe_tenant ON fiscal_provision_events(tenant_id);

-- Imutabilidade: append-only (UPDATE e DELETE bloqueados). Reversão por NOVO evento.
CREATE OR REPLACE FUNCTION fn_fiscal_provision_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'FISCAL_PROVISION_EVENT_IMMUTABLE: % blocked (append-only, DECISION-0179 D7)', TG_OP;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_fiscal_provision_events_immutable ON fiscal_provision_events;
CREATE TRIGGER trg_fiscal_provision_events_immutable
  BEFORE UPDATE OR DELETE ON fiscal_provision_events
  FOR EACH ROW EXECUTE FUNCTION fn_fiscal_provision_events_immutable();

ALTER TABLE fiscal_provision_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_provision_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fiscal_provision_events_tenant_isolation ON fiscal_provision_events;
CREATE POLICY fiscal_provision_events_tenant_isolation ON fiscal_provision_events
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ─────────────────────────────────────────────────────────────────────────────
-- E. Vínculos na direção SELADA (Bank→fiscal, logs→fiscal). Nullable (histórico/não-fiscalizadas).
--    DECISION-0179 D7/D11. bank_transactions ganha a referência fiscal estável + o fingerprint.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE bank_transactions
  ADD COLUMN fiscal_provision_event_id UUID NULL REFERENCES fiscal_provision_events(id),
  ADD COLUMN fiscal_economic_context_fingerprint TEXT NULL;

ALTER TABLE fiscal_provision_logs
  ADD COLUMN fiscal_provision_event_id UUID NULL REFERENCES fiscal_provision_events(id);

COMMIT;

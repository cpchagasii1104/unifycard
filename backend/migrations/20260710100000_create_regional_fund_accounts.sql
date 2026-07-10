-- 20260710100000_create_regional_fund_accounts.sql
-- DECISION-0166 D3 — Fase 2 / fatia 2a da frente F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION.
--
-- Resolver CANÔNICO de fundo regional por FK do Location Core (DECISION-0020): (scope_level + IDs
-- territoriais) → bank_account_id. Mata a chave-string 'system:regional_fund:{tenant}:{country}-{state}-
-- {city}' como FONTE DE VERDADE (owner_id de bank_accounts vira rótulo técnico derivado — cutover na 2c).
--
--   - SEM saldo, SEM ledger, SEM seed de dinheiro: isto é só um mapa nível+território→conta Bank.
--     O dinheiro continua tendo UMA verdade: bank_ledger.
--   - Coerência por nível via CHECK (planet: nenhum ID; country: só country; state: country+state;
--     city: +city; neighborhood: +neighborhood).
--   - Coerência HIERÁRQUICA MATERIAL via FKs compostas: (country_id,state_id)→states,
--     (state_id,city_id)→cities, (city_id,neighborhood_id)→neighborhoods. MATCH SIMPLE (default)
--     pula a checagem quando há NULL — exatamente a semântica dos níveis mais altos. Os UNIQUE de
--     apoio nos catálogos são aditivos (PK já garante unicidade; o par é para a FK composta).
--     Estado de outra country / city de outro state = REJEITADO PELO BANCO, não por convenção.
--   - UNIQUE NULLS NOT DISTINCT (PG 17.5 confirmado) por (tenant, nível, IDs): impede dois fundos
--     'planet' (todas NULL) ou dois fundos da mesma cidade.
--   - UNIQUE(bank_account_id): uma conta Bank serve exatamente UM escopo territorial.
--   - neighborhood: o SCHEMA já suporta (D4 = HOLD no RESOLVER enquanto catálogo vazio, não no schema).
--   - RLS ENABLE+FORCE (padrão da casa, policy direta por tenant_id).
-- Forward-only, idempotente, não toca dados nem dinheiro.

BEGIN;

-- UNIQUEs de apoio nos catálogos globais (aditivos; viabilizam as FKs compostas hierárquicas).
CREATE UNIQUE INDEX IF NOT EXISTS uq_states_country_state ON states(country_id, state_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cities_state_city ON cities(state_id, city_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_neighborhoods_city_neighborhood ON neighborhoods(city_id, neighborhood_id);

CREATE TABLE IF NOT EXISTS regional_fund_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  scope_level TEXT NOT NULL
    CHECK (scope_level IN ('planet', 'country', 'state', 'city', 'neighborhood')),

  country_id UUID NULL REFERENCES countries(country_id),
  state_id UUID NULL,
  city_id UUID NULL,
  neighborhood_id UUID NULL,

  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Hierarquia territorial MATERIAL (MATCH SIMPLE: NULL em qualquer coluna pula a checagem).
  CONSTRAINT fk_rfa_state FOREIGN KEY (country_id, state_id)
    REFERENCES states(country_id, state_id),
  CONSTRAINT fk_rfa_city FOREIGN KEY (state_id, city_id)
    REFERENCES cities(state_id, city_id),
  CONSTRAINT fk_rfa_neighborhood FOREIGN KEY (city_id, neighborhood_id)
    REFERENCES neighborhoods(city_id, neighborhood_id),

  -- Forma exata por nível.
  CONSTRAINT chk_rfa_scope_shape CHECK (
    (scope_level = 'planet'
      AND country_id IS NULL AND state_id IS NULL AND city_id IS NULL AND neighborhood_id IS NULL)
    OR (scope_level = 'country'
      AND country_id IS NOT NULL AND state_id IS NULL AND city_id IS NULL AND neighborhood_id IS NULL)
    OR (scope_level = 'state'
      AND country_id IS NOT NULL AND state_id IS NOT NULL AND city_id IS NULL AND neighborhood_id IS NULL)
    OR (scope_level = 'city'
      AND country_id IS NOT NULL AND state_id IS NOT NULL AND city_id IS NOT NULL AND neighborhood_id IS NULL)
    OR (scope_level = 'neighborhood'
      AND country_id IS NOT NULL AND state_id IS NOT NULL AND city_id IS NOT NULL AND neighborhood_id IS NOT NULL)
  ),

  -- Um fundo por escopo territorial por tenant (NULLS NOT DISTINCT: dois 'planet' colidem).
  CONSTRAINT uq_rfa_scope UNIQUE NULLS NOT DISTINCT
    (tenant_id, scope_level, country_id, state_id, city_id, neighborhood_id),

  -- Uma conta Bank serve exatamente um escopo.
  CONSTRAINT uq_rfa_bank_account UNIQUE (bank_account_id)
);

COMMENT ON TABLE regional_fund_accounts IS
  'DECISION-0166 D3 (Fase 2a). Resolver canônico fundo regional: (scope_level + FKs Location Core) → bank_account_id. SEM saldo (bank_ledger é a única verdade do dinheiro). owner_id string de bank_accounts é rótulo técnico, NUNCA fonte de verdade geográfica. neighborhood em HOLD no resolver enquanto catálogo vazio (D4).';

CREATE INDEX IF NOT EXISTS idx_rfa_tenant_level
  ON regional_fund_accounts(tenant_id, scope_level);

ALTER TABLE regional_fund_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_fund_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS regional_fund_accounts_tenant_isolation ON regional_fund_accounts;
CREATE POLICY regional_fund_accounts_tenant_isolation ON regional_fund_accounts
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;

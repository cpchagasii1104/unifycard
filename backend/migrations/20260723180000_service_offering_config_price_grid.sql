-- 20260723180000: FATIA PREÇO arco fundação eventos — GRADE DE PREÇO por CONFIG (formação), dia-da-semana × período.
-- A banda/artista declara, por item do cardápio (service_offering_configs), um PREÇO por célula (dia × período).
-- PREÇO = valor DECLARADO de catálogo ("a partir de"), NUNCA cobrança/movimento de dinheiro (Δbank=0; porta-01 FORA;
-- sem coluna de moeda — BRL implícito). Dinheiro SEMPRE cents/BIGINT (nunca FLOAT/DECIMAL/NUMERIC). Forward-only.
--
-- §2 SEM VERDADE DUPLICADA — UMA verdade por célula (config,dia,período) via cascata "a partir de" de 3 níveis:
--   1) célula da grade service_offering_config_prices(config_id,day_of_week,period_of_day)  [mais específica]
--   2) base POR CONFIG service_offering_configs.default_price_cents                   [intermediária]
--   3) base DA OFERTA service_offerings.price_cents (coluna SELADA 20260611180000)    [fallback]
-- Nunca dois valores competindo pela mesma célula: grade ESPARSA (só as células que DIFEREM são persistidas).
-- Molde do precedente de grade de preço §2: 20260708150000_rental_resource_pricing_tiers (child + UNIQUE + índice).
--
-- SOFT-RETIRE: agora que existem linhas de PREÇO referenciando configs, o DELETE físico de config precificada é
-- PROIBIDO (FK ON DELETE RESTRICT como backstop) — fecha a promessa selada da F3 (20260723170000:18-20,48-49).
-- retired_at é ORTOGONAL à situação de negócio ('disponivel'/'sob_consulta'): retira do cardápio ATIVO sem apagar,
-- e a config retirada permanece RESOLVÍVEL para os preços já declarados. Aditiva/idempotente/forward-only.
BEGIN;

-- 1. service_offering_configs += base POR CONFIG ("a partir de", nível 2) + soft-retire (retirada sem apagar).
ALTER TABLE service_offering_configs
  ADD COLUMN IF NOT EXISTS default_price_cents BIGINT NULL;
ALTER TABLE service_offering_configs
  DROP CONSTRAINT IF EXISTS chk_soc_default_price_nonneg;
ALTER TABLE service_offering_configs
  ADD CONSTRAINT chk_soc_default_price_nonneg
  CHECK (default_price_cents IS NULL OR default_price_cents >= 0);
ALTER TABLE service_offering_configs
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN service_offering_configs.default_price_cents IS
  'FATIA PREÇO: base "a partir de" POR CONFIG (nível 2 da cascata §2). NULL = sem base própria, cai no nível 3 '
  '(service_offerings.price_cents). Valor DECLARADO de catálogo — Δbank=0, porta-01 FORA. BRL implícito.';
COMMENT ON COLUMN service_offering_configs.retired_at IS
  'FATIA PREÇO: soft-retire (retirada sem apagar). ORTOGONAL a status disponivel/sob_consulta. Config com preço '
  'declarado NÃO pode ser deletada fisicamente (FK ON DELETE RESTRICT) — retired_at NÃO NULO a tira do cardápio '
  'ATIVO, mas os preços já declarados seguem RESOLVÍVEIS. Fecha a promessa selada da F3 (20260723170000:18-20).';

-- 2. Grade de preço por CÉLULA (config, dia-da-semana canônico §4.25, período pt-BR). Nível 1 da cascata.
--    ESPARSA: só as células que DIFEREM da base são persistidas (ausência = cai no nível 2, depois no nível 3).
CREATE TABLE IF NOT EXISTS service_offering_config_prices (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id),
  -- RESTRICT: config PRECIFICADA não pode ser fisicamente deletada — o writer faz soft-retire (retired_at).
  config_id    UUID        NOT NULL REFERENCES service_offering_configs(id) ON DELETE RESTRICT,
  -- Canônico §4.25: 0=Dom .. 6=Sáb (alinha com PG EXTRACT(DOW) e com service_demands.weekdays 0..6); CHECK-not-enum (§4.9.7).
  day_of_week  SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- período do dia, pt-BR sem acento (CHECK-not-enum §4.9.7 — precedente disponivel/sob_consulta da F3).
  period_of_day TEXT       NOT NULL CHECK (period_of_day IN ('manha', 'tarde', 'noite')),
  -- dinheiro: cents/BIGINT, nunca float; valor DECLARADO ("a partir de"), não cobrança (Δbank=0).
  price_cents  BIGINT      NOT NULL CHECK (price_cents >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- UMA verdade por célula (§2): não há duas linhas competindo por (config,dia,período).
  CONSTRAINT uq_socp_cell UNIQUE (config_id, day_of_week, period_of_day)
);

CREATE INDEX IF NOT EXISTS idx_socp_tenant_config
  ON service_offering_config_prices (tenant_id, config_id);

COMMENT ON TABLE service_offering_config_prices IS
  'FATIA PREÇO: grade ESPARSA de preço DECLARADO por CONFIG × dia-da-semana (§4.25: 0=Dom..6=Sáb) × período (manha/tarde/'
  'noite). Nível 1 da cascata "a partir de" (§2 UMA verdade/célula): célula → configs.default_price_cents → '
  'offerings.price_cents. Preço = valor de catálogo, NUNCA movimento de dinheiro (Δbank=0; porta-01 FORA; BRL implícito).';

COMMIT;

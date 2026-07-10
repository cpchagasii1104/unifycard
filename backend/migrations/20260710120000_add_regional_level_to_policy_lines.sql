-- 20260710120000_add_regional_level_to_policy_lines.sql
-- DECISION-0166 D2 — Fase 3 / fatia 3a da frente F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION.
--
-- EIXO territorial do split regional: cada linha regional_fund declara PARA QUAL NÍVEL vai a
-- fatia (planet/country/state/city/neighborhood) — ortogonal ao regional_origin_basis
-- (DECISION-0049), que declara DE QUAL ENDEREÇO a região é resolvida. Uma policy passa a poder
-- ter N linhas regional_fund, uma por nível, cada uma com seus bps.
--
-- MESMO vocabulário de regional_fund_accounts.scope_level (2a) — um enum só, zero paralelo.
--
-- ESTA FATIA É SÓ O EIXO, NÃO A BASE (regra dura do D7): o motor segue aplicando bps sobre o
-- amount do caller; a base fiscal (commission_gross → tax_reserve → commission_distributable)
-- é a Fase 4. NENHUMA policy ativa com rateio regional real nasce antes disso.
--
-- Quebra ZERO provada por query: 0 linhas line_type='regional_fund' existem no banco (50 lines
-- totais, todas revenue/fee de e2e). Forward-only, aditiva, idempotente; não toca dados/dinheiro.

BEGIN;

ALTER TABLE economic_policy_lines
  ADD COLUMN IF NOT EXISTS regional_level TEXT NULL;

-- CHECK 1: vocabulário canônico (mesmos valores de regional_fund_accounts.scope_level).
ALTER TABLE economic_policy_lines
  ADD CONSTRAINT chk_regional_level_canonical_values
  CHECK (
    regional_level IS NULL
    OR regional_level IN ('planet', 'country', 'state', 'city', 'neighborhood')
  );

-- CHECK 2: linha regional_fund SEMPRE declara o nível (banco rejeita, não convenção).
ALTER TABLE economic_policy_lines
  ADD CONSTRAINT chk_regional_level_required_for_regional_fund
  CHECK (line_type <> 'regional_fund' OR regional_level IS NOT NULL);

-- CHECK 3: nível só faz sentido em linha regional — não-regional NÃO carrega nível decorativo.
ALTER TABLE economic_policy_lines
  ADD CONSTRAINT chk_regional_level_only_for_regional_fund
  CHECK (line_type = 'regional_fund' OR regional_level IS NULL);

-- Duas linhas do MESMO nível + MESMO basis na mesma policy = erro de configuração (dois splits
-- idênticos para o mesmo fundo). UNIQUE parcial barra no banco. Bases distintas para o mesmo
-- nível continuam permitidas (composição legítima do DECISION-0049).
CREATE UNIQUE INDEX IF NOT EXISTS uq_policy_lines_regional_level_basis
  ON economic_policy_lines (policy_id, regional_level, regional_origin_basis)
  WHERE line_type = 'regional_fund';

COMMENT ON COLUMN economic_policy_lines.regional_level IS
  'DECISION-0166 D2 (Fase 3a). Nível territorial da fatia regional (planet/country/state/city/neighborhood — mesmo enum de regional_fund_accounts.scope_level). OBRIGATÓRIO em line_type=regional_fund; PROIBIDO (NULL) nas demais. Ortogonal ao regional_origin_basis: basis = de onde vem a região; level = para qual nível vai a fatia. neighborhood segue HOLD no resolver (D4).';

COMMIT;

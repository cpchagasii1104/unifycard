-- 20260727100000_economic_policies_territorial_location_core.sql
-- FATIA 0 (economic-policy front) — converge os seletores territoriais de economic_policies
-- de TEXTO livre (country/region/city) para o Location Core governado (countries/states/cities,
-- FKs, name_normalized anti-duplicata), mirando fielmente o padrão hierárquico MATERIAL já
-- provado por regional_fund_accounts (20260710100000_create_regional_fund_accounts.sql).
--
--   - country/region/city (TEXT) NÃO são apagados nesta fatia (Lei 4 — estrutura prevalece).
--     Ficam DEPRECATED via COMMENT ON COLUMN; leitura histórica continua possível.
--   - country_id/state_id/city_id (UUID) são os seletores GOVERNADOS a partir de agora.
--     "region" (produto) corresponde semanticamente a "state" (Location Core) — não existe
--     camada macro-regional separada; region_id NÃO é criado, o campo é state_id.
--   - Coerência hierárquica MATERIAL via FKs compostas MATCH SIMPLE (default; NULL em qualquer
--     lado pula a checagem — a mesma semântica usada por regional_fund_accounts):
--       (country_id, state_id) → states(country_id, state_id)
--       (state_id, city_id)    → cities(state_id, city_id)
--     Os UNIQUE de apoio (uq_states_country_state, uq_cities_state_city) já existem —
--     criados em 20260710100000, aditivos e IF NOT EXISTS — não precisam ser recriados aqui.
--   - Além da composta, cada coluna também carrega uma FK SIMPLES para sua própria tabela
--     (country_id→countries, state_id→states, city_id→cities). Diferença deliberada frente a
--     regional_fund_accounts: lá o CHECK chk_rfa_scope_shape já garante que state_id nunca
--     aparece sem country_id (nem city_id sem state_id), então a FK composta basta. Aqui os
--     seletores são INDEPENDENTES (specificity engine conta qualquer combinação; não há CHECK de
--     "forma exata" por nível) — sem a FK simples em state_id/city_id, um state_id ou city_id
--     soltos (sem o pai preenchido) escapariam de QUALQUER checagem referencial (MATCH SIMPLE da
--     composta pula quando o lado esquerdo é NULL). A FK simples fecha esse buraco sem impor forma.
--   - ON DELETE SET NULL nas 3 colunas (simples E compostas) — igual ao padrão já existente de
--     category_id (linha 105 da migration 20260530560000). NUNCA CASCADE, NUNCA RESTRICT: apagar
--     um país/estado/cidade do catálogo DEGRADA a especificidade da policy (ela passa a valer em
--     escopo mais amplo), nunca quebra nem reescreve retroativamente a policy.
--   - Índice composto (tenant_id, country_id, state_id, city_id) para o fast-path de lookup
--     territorial, mesmo papel do idx_rfa_tenant_level em regional_fund_accounts.
--
-- Regra financeira (Lei 5 / GATE): esta migration NÃO cria, altera nem referencia bank_ledger,
-- bank_transactions, bank_splits ou bank_accounts. economic_policies é substrato de REGRA
-- (seletor de qual policy se aplica), nunca movimentação de dinheiro (Δbank=0).
-- category_id (linha 63/105 da migration original) NÃO é tocado — DECISION-0048 (category
-- SELECIONA policy, não calcula split, não é identidade semântica) permanece intacta.
--
-- Zero rows em economic_policies hoje (sistema virgem) — sem backfill necessário nesta fatia.
-- ADD COLUMN sem IF NOT EXISTS (Lei 3: colunas estruturais não usam a exceção de idempotência —
-- só índices/triggers/functions/views a usam). Forward-only (Lei 2: 20260530560000 permanece
-- intocada); Bank-free.

BEGIN;

ALTER TABLE economic_policies
  ADD COLUMN country_id UUID,
  ADD COLUMN state_id UUID,
  ADD COLUMN city_id UUID;

-- FKs simples — cada coluna válida contra seu próprio catálogo, independente das demais.
ALTER TABLE economic_policies
  ADD CONSTRAINT fk_economic_policies_country
    FOREIGN KEY (country_id) REFERENCES countries(country_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_economic_policies_state
    FOREIGN KEY (state_id) REFERENCES states(state_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_economic_policies_city
    FOREIGN KEY (city_id) REFERENCES cities(city_id) ON DELETE SET NULL;

-- FKs compostas — coerência hierárquica MATERIAL (mirror exato de regional_fund_accounts):
-- MATCH SIMPLE (default) pula a checagem quando qualquer lado é NULL; quando AMBOS os lados
-- estão preenchidos, o banco rejeita estado de outro país / cidade de outro estado.
ALTER TABLE economic_policies
  ADD CONSTRAINT fk_economic_policies_country_state
    FOREIGN KEY (country_id, state_id) REFERENCES states(country_id, state_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_economic_policies_state_city
    FOREIGN KEY (state_id, city_id) REFERENCES cities(state_id, city_id) ON DELETE SET NULL;

-- Índice composto para o fast-path de resolução por território (mesmo papel de
-- idx_rfa_tenant_level em regional_fund_accounts). CREATE INDEX IF NOT EXISTS é a exceção
-- idempotente permitida pela Lei 3 (índices são idempotentes por natureza).
CREATE INDEX IF NOT EXISTS idx_economic_policies_territory
  ON economic_policies(tenant_id, country_id, state_id, city_id);

COMMENT ON COLUMN economic_policies.country_id IS
  'FK governada para countries(country_id) — Location Core (DECISION-0020). Seletor territorial
   canônico a partir da FATIA 0 (frente economic-policy). Substitui o campo TEXT country.';

COMMENT ON COLUMN economic_policies.state_id IS
  'FK governada para states(state_id) — Location Core (DECISION-0020). Corresponde
   semanticamente ao antigo seletor TEXT "region" (não existe camada macro-regional separada
   nesta tabela). Substitui o campo TEXT region.';

COMMENT ON COLUMN economic_policies.city_id IS
  'FK governada para cities(city_id) — Location Core (DECISION-0020). Substitui o campo TEXT
   city.';

-- Deprecação explícita dos seletores TEXT (Lei 4 — estrutura prevalece; NÃO dropados nesta
-- fatia). Nenhum código NOVO deve gravar ou decidir specificity a partir destas 3 colunas.
COMMENT ON COLUMN economic_policies.country IS
  'DEPRECATED (FATIA 0, 2026-07-27) — substituído por country_id (Location Core, FK governada).
   Não usar em código novo; mantido apenas para leitura de histórico eventual (tabela estava
   vazia no momento da convergência — nenhum histórico real hoje).';

COMMENT ON COLUMN economic_policies.region IS
  'DEPRECATED (FATIA 0, 2026-07-27) — substituído por state_id (Location Core, FK governada;
   "region" no produto corresponde a "state" no Location Core). Não usar em código novo.';

COMMENT ON COLUMN economic_policies.city IS
  'DEPRECATED (FATIA 0, 2026-07-27) — substituído por city_id (Location Core, FK governada).
   Não usar em código novo.';

-- ACHADO durante o MAP desta fatia: a trigger de imutabilidade de policy ATIVA
-- (enforce_economic_policies_immutability, migration 20260709140000/DECISION-0166 D5) compara
-- uma LISTA EXPLÍCITA de campos materiais (NEW IS DISTINCT FROM OLD por coluna) — lista que
-- antecede esta fatia e por isso NÃO incluía country_id/state_id/city_id (colunas não existiam
-- ainda). Sem este ajuste, as 3 colunas GOVERNADAS ficariam DE FORA da trava de imutabilidade:
-- seria possível fazer UPDATE em country_id/state_id/city_id de uma policy ATIVA sem disparar a
-- exceção — o mesmo buraco que a trava foi criada para fechar, só que nos seletores novos.
-- CREATE OR REPLACE FUNCTION é a exceção idempotente permitida pela Lei 3 (functions são
-- substituíveis); o corpo é o MESMO da migration 20260709140000 + as 3 colunas novas na
-- comparação. Nenhum outro comportamento muda (append-only, active→deprecated único caminho,
-- deprecated permanece terminal).
CREATE OR REPLACE FUNCTION enforce_economic_policies_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'economic_policies is append-only for % policies: DELETE not allowed (policy %). Supersede with a new version.',
        OLD.status, OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;

  -- TG_OP = 'UPDATE'
  IF OLD.status = 'deprecated' THEN
    RAISE EXCEPTION
      'economic_policies: deprecated policy % is terminal and frozen — no UPDATE allowed. Create a new version instead.',
      OLD.id
      USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD.status = 'active' THEN
    IF NEW.status NOT IN ('active', 'deprecated') THEN
      RAISE EXCEPTION
        'economic_policies: active policy % cannot return to status % — only active→deprecated is allowed.',
        OLD.id, NEW.status
        USING ERRCODE = 'raise_exception';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.policy_code IS DISTINCT FROM OLD.policy_code
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.policy_type IS DISTINCT FROM OLD.policy_type
      OR NEW.module_context IS DISTINCT FROM OLD.module_context
      OR NEW.vertical IS DISTINCT FROM OLD.vertical
      OR NEW.actor_type IS DISTINCT FROM OLD.actor_type
      OR NEW.service_type IS DISTINCT FROM OLD.service_type
      OR NEW.pricing_model IS DISTINCT FROM OLD.pricing_model
      OR NEW.settlement_flow IS DISTINCT FROM OLD.settlement_flow
      OR NEW.country IS DISTINCT FROM OLD.country
      OR NEW.region IS DISTINCT FROM OLD.region
      OR NEW.city IS DISTINCT FROM OLD.city
      OR NEW.country_id IS DISTINCT FROM OLD.country_id
      OR NEW.state_id IS DISTINCT FROM OLD.state_id
      OR NEW.city_id IS DISTINCT FROM OLD.city_id
      OR NEW.category_id IS DISTINCT FROM OLD.category_id
      OR NEW.channel IS DISTINCT FROM OLD.channel
      OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION
        'economic_policies: active policy % is immutable — material fields cannot change. Allowed: status→deprecated and effective_until. Create a new version for rule changes.',
        OLD.id
        USING ERRCODE = 'raise_exception';
    END IF;
    -- permitidos: effective_until (encerramento controlado), status active→deprecated, updated_at.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Trigger já existe (economic_policies_immutability, criada em 20260709140000) e continua
-- apontando para a mesma function por nome — CREATE OR REPLACE FUNCTION acima já é suficiente
-- para o novo corpo valer; sem necessidade de DROP/CREATE TRIGGER (o vínculo é por nome de function).

COMMIT;

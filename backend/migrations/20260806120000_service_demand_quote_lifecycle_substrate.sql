-- 20260806120000: F-SERVICE-DEMAND-QUOTE-LIFECYCLE — substrato da F1 (DECISION-0196, GO Clayton 2026-08-06).
--
-- Abre a porta que a DECISION-0164 fechou ("reabertura só por frente nomeada, não patch solto"),
-- pelo lado certo: frente nomeada, escopo fixado, decisões promulgadas em DECISION-0196.
-- Forward-only. Δbank = 0 — `quote_cents` é preço DECLARADO, não custódia; nada aqui toca bank_*.
-- Sem backfill: as duas tabelas têm 0 linhas (medido em unificard_dev, 2026-08-06).
--
-- ── (A) VALIDADE DO ORÇAMENTO — DECISION-0196 §C/D1 ──────────────────────────────────────────────
-- 🔴 O NOME: o plano pedia `valid_until`. A norma vence — `07_NOMENCLATURA §4.6` exige sufixo `_at`
-- em timestamp, e o CLAUDE.md §3.2 já lista `effective_until` entre as 33 violações medidas.
-- `expires_at` é canônico E é a convenção VIVA deste repositório para exatamente este conceito
-- (`live_presence.expires_at`, `actor_active_location.expires_at`). Não se cria a 34ª violação.
--
-- NOT NULL e SEM DEFAULT DE BANCO, de propósito: a DECISION-0196 manda o default ser injetado
-- NA ESCRITA (7 dias, configurável POR OFERTA) e proíbe `NULL`. Default de banco deixaria o writer
-- esquecer em silêncio; a ausência de default faz a omissão FALHAR ALTO, que é o que se quer.
--
-- ⚠️ `actor_active_location.expires_at` era prazo DECORATIVO (escrito e nunca lido) — foi
-- `DT-EXPIRY-DOOR-WITHOUT-TRIGGER`, fechada em 2026-08-05. Esta coluna nasce com a obrigação de ter
-- LEITOR: a expiração é preguiçosa (derivada na leitura, imposta no aceite), nunca um worker.
--
-- ── (B) ORÇAMENTO DIRIGIDO — DECISION-0196 §C/D4 ────────────────────────────────────────────────
-- `target_actor_id` NULL = broadcast (o comportamento de hoje). Mesma entidade, não uma segunda:
-- duas entidades seriam segunda verdade sobre "o que é um pedido".
--
-- ── (C) O QUE ESTÁ SENDO OFERTADO — DECISION-0196 §B.2 ──────────────────────────────────────────
-- 🔴 DUAS FKs, NÃO UMA. O pacote de recomendação pedia só `service_offerings`; medição de
-- 2026-08-06 mostrou que isso EXPULSARIA a metade locação que a 0164 ADENDO 5(c) promulga
-- ("a MESMA demanda serve pra RECURSOS — o motor é UM só"): os 2 donos de actor_assets têm
-- ZERO service_offering ativa. `offering_id` XOR `asset_id`, com CHECK de exclusividade.
--
-- ⚠️ O QUE O BANCO PODE E O QUE ELE NÃO PODE: o CHECK garante EXCLUSIVIDADE (nunca os dois). Ele
-- NÃO consegue garantir a OBRIGATORIEDADE por `pricing_mode='orcamento'` (§B.4), porque
-- `pricing_mode` mora na outra tabela e CHECK não atravessa tabelas. Essa metade é do SERVICE, e
-- fica vigiada por guard — declarado aqui para ninguém supor que o banco cobre o que ele não cobre.

BEGIN;

-- (A) validade
ALTER TABLE service_demand_responses
  ADD COLUMN expires_at TIMESTAMPTZ NOT NULL;

COMMENT ON COLUMN service_demand_responses.expires_at IS
  'DECISION-0196 §C/D1: ate quando esta resposta vale. Default 7 dias injetado NA ESCRITA, '
  'configuravel POR OFERTA; NULL proibido (sem prazo so como escolha explicita futura). '
  'Vencido MORRE e nasce outro (D2) — renovar faria o historico mentir sobre o que o cliente viu. '
  'Expiracao PREGUICOSA: derivada na leitura, imposta no aceite, sem worker.';

-- (B) orçamento dirigido
ALTER TABLE service_demands
  ADD COLUMN target_actor_id UUID NULL REFERENCES actors(id);

CREATE INDEX idx_service_demands_target_actor
  ON service_demands (tenant_id, target_actor_id)
  WHERE target_actor_id IS NOT NULL;

COMMENT ON COLUMN service_demands.target_actor_id IS
  'DECISION-0196 §C/D4: demanda DIRIGIDA a um actor. NULL = broadcast (comportamento vigente). '
  'MESMA entidade da demanda aberta — duas entidades seriam segunda verdade sobre "o que e um pedido".';

-- (C) o que está sendo ofertado
ALTER TABLE service_demand_responses
  ADD COLUMN offering_id UUID NULL REFERENCES service_offerings(id),
  ADD COLUMN asset_id    UUID NULL REFERENCES actor_assets(id);

ALTER TABLE service_demand_responses
  ADD CONSTRAINT chk_sd_responses_offer_ref_exclusive
  CHECK (num_nonnulls(offering_id, asset_id) <= 1);

CREATE INDEX idx_sd_responses_offering ON service_demand_responses (offering_id) WHERE offering_id IS NOT NULL;
CREATE INDEX idx_sd_responses_asset    ON service_demand_responses (asset_id)    WHERE asset_id    IS NOT NULL;

COMMENT ON CONSTRAINT chk_sd_responses_offer_ref_exclusive ON service_demand_responses IS
  'DECISION-0196 §B.2: a resposta declara O QUE oferta — service_offering XOR actor_asset, nunca os '
  'dois. FK unica (so offering) expulsaria a metade LOCACAO que a 0164 ADENDO 5(c) promulga: medido '
  'em 2026-08-06, os 2 donos de actor_assets tem ZERO service_offering ativa. '
  'O banco garante EXCLUSIVIDADE; a OBRIGATORIEDADE quando pricing_mode=orcamento e do service '
  '(CHECK nao atravessa tabelas) e fica vigiada por guard.';

COMMIT;

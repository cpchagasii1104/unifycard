-- 20260708380000: F-ASSET-MULTI-OFFER-FOUNDATION Fatia 2 — Parte A (reconciliação de concepts).
-- Regra promulgada (RFC §7-BIS D5): todo concept com offer_kind='rentable' É asset-elegível (só bem durável
-- se aluga). READ-FIRST classificou os 42 rentables faltantes = 21 imóveis/espaços + 21 equipamentos = TODOS
-- duráveis, ZERO perecível/ambíguo. Backfill governado dos 54 rentables em concept_asset_eligibilities.
-- SEM category_id. Δbank=0. Forward-only. NÃO cria camada rental nem toca o módulo de locação (Partes B-G).
BEGIN;

INSERT INTO concept_asset_eligibilities (concept_id, seed_reason)
SELECT DISTINCT ok.concept_id, 'backfill Fatia 2 Parte A: offer_kind=rentable ⇒ asset-elegível (bem durável)'
  FROM concept_offer_kinds ok
 WHERE ok.offer_kind = 'rentable'
ON CONFLICT (concept_id) DO NOTHING;

COMMIT;

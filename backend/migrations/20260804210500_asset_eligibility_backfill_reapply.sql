-- ============================================================
-- 20260804210500: REAPLICAÇÃO do backfill de elegibilidade de asset
-- ============================================================
-- Não promulga regra nova. A regra JÁ é sua, de 2026-07-08, e está escrita em
-- 20260708380000_rentable_concepts_asset_eligible_backfill.sql:
--
--   "Regra promulgada (RFC §7-BIS D5): todo concept com offer_kind='rentable' É asset-elegível
--    (só bem durável se aluga)."
--
-- Mesmo defeito de FORMA do backfill de alias: data fixa protege o passado, não o futuro.
--
-- ═══ ESTADO MEDIDO EM 2026-08-04 (antes desta migration) ═══
--   concepts com offer_kind='rentable' SEM linha em concept_asset_eligibilities .... 6
--     mesa-de-som · guitarra · baixo · bateria · monitor-de-palco ... nascidos 2026-07-29
--     banheiro-quimico ............................................. nascido 2026-08-03
--
-- Todos posteriores ao backfill de 2026-07-08, e todos bem durável — nenhum pede exceção pelo
-- mérito da regra. `banheiro-quimico` foi criado pela migration
-- 20260803130000_show_orchestration_roles_not_equipment.sql, que insere em concepts,
-- concept_offer_kinds, canonical_services e event_orchestration_template_items — e NUNCA em
-- concept_asset_eligibilities (medido: zero ocorrência do nome da tabela naquele arquivo).
--
-- Efeito prático observado: `rentableResourceService.create` recusa com
-- RENTABLE_RESOURCE_CONCEPT_NOT_ASSET_ELIGIBLE, então um banheiro químico não pode nascer como
-- locável pelo writer canônico — enquanto tenda e gerador podem. Mesma família, tratamento
-- diferente, por acidente de data.
--
-- Cláusula do INSERT é a MESMA do original (offer_kind='rentable' ⇒ elegível), com o mesmo
-- ON CONFLICT DO NOTHING. `concept_asset_eligibilities` é GLOBAL (sem tenant_id) — preservado.
--
-- Lei 2: forward-only, idempotente. Zero mudança de motor/autoridade/dinheiro.
-- ============================================================

BEGIN;

INSERT INTO public.concept_asset_eligibilities (concept_id, seed_reason)
SELECT DISTINCT ok.concept_id,
       'reaplicacao 2026-08-04 da regra RFC §7-BIS D5: offer_kind=rentable ⇒ asset-elegível (bem durável)'
  FROM public.concept_offer_kinds ok
 WHERE ok.offer_kind = 'rentable'
ON CONFLICT (concept_id) DO NOTHING;

COMMIT;

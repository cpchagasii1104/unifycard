-- 20260803110000_show_orchestration_rentable_items.sql
-- F-EVENT-ORCHESTRATION-RENTABLE (2ª fatia): liga ao formato SHOW as necessidades que se resolvem
-- LOCANDO. Só usa concepts que JÁ EXISTEM e JÁ são 'rentable' em concept_offer_kinds — nenhum
-- conceito novo é criado aqui.
--
-- ESTADO MEDIDO ANTES (unificard_dev):
--   SHOW = 3 necessidades (Segurança · Fotografia · Limpeza), todas fulfillment_kind='service'.
--   59 concepts já cadastrados como 'rentable' — som, luz, energia e cobertura entre eles,
--   nunca ligados a formato de evento nenhum.
--
-- Depende de 20260803100000 (CHECK ampliado para o vocabulário governado). Sem ela, todo INSERT
-- abaixo é recusado com 23514 — é a mesma prova que o E2E efêmero faz na fase RED.
--
-- 🔴 IDENTIDADE POR SLUG, NUNCA POR UUID LITERAL: concept_id é gerado por ambiente
-- (uuid_generate_v4), então UUID escrito à mão aqui casaria em unificard_dev e falharia em
-- qualquer outro banco. O slug é a chave estável (UNIQUE (domain, slug)).
--
-- ON CONFLICT DO NOTHING respeita uq_event_orch_template_format_need: reaplicar é inócuo.
--
-- ⚠️ NÃO define 'Palco', 'Banheiro químico', 'Grade de contenção', 'Recepção', 'Bilheteria',
-- 'Brigadista' nem 'Produção' — esses conceitos NÃO EXISTEM no catálogo e criá-los é decisão de
-- produto de Clayton, não da migration. O que entra aqui é só religamento do que já está cadastrado.

BEGIN;

INSERT INTO event_orchestration_template_items
  (format_concept_id, need_concept_id, fulfillment_kind, is_required, sort_order)
SELECT
  fmt.concept_id,
  need.concept_id,
  'rentable',
  item.is_required,
  item.sort_order
FROM (VALUES
  -- slug                    obrigatória   ordem (depois dos 3 serviços já existentes: 10/20/30)
  ('mesa-de-som',            true,         40),
  ('caixa-de-som',           true,         50),
  ('microfone',              true,         60),
  ('monitor-de-palco',       false,        70),
  ('torre-de-iluminacao',    false,        80),
  ('gerador',                false,        90),
  ('tenda',                  false,       100)
) AS item(slug, is_required, sort_order)
JOIN concepts need
  ON need.slug = item.slug
 AND need.domain = 'produtos-e-comercio'
JOIN concept_offer_kinds k
  ON k.concept_id = need.concept_id
 AND k.offer_kind = 'rentable'
CROSS JOIN (
  SELECT f.concept_id
    FROM event_format_concepts f
    JOIN concepts c ON c.concept_id = f.concept_id
   WHERE c.slug = 'show'
     AND c.domain = 'cultura-lazer-e-eventos'
) AS fmt
ON CONFLICT (format_concept_id, need_concept_id) DO NOTHING;

COMMIT;

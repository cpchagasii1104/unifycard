-- 20260803100000_orchestration_fulfillment_kind_rentable.sql
-- F-EVENT-ORCHESTRATION-RENTABLE: alinha o vocabulário de `fulfillment_kind` ao vocabulário
-- GOVERNADO que já é lei em concept_offer_kinds. NÃO cria vocabulário novo.
--
-- ESTADO MEDIDO EM unificard_dev ANTES desta migration:
--   concept_offer_kinds  CHECK (offer_kind IN ('rentable','service'))
--                        rentable = 59 concepts · service = 33 concepts
--   event_orchestration_template_items  CHECK (fulfillment_kind IN ('service'))   <-- MAIS ESTRITO
--   event_operational_needs             CHECK (fulfillment_kind IN ('service'))   <-- MAIS ESTRITO
--
-- Ou seja: as duas tabelas de orquestração eram mais restritas que o domínio que elas referenciam.
-- Consequência prática: um evento não conseguia declarar necessidade que se resolve LOCANDO
-- (palco, som, banheiro químico, gerador, tenda) — só contratando serviço. Metade da orquestração
-- de um show grande não cabia no substrato.
--
-- 🔴 POR QUE ISTO É SEGURO: o enforcement MATERIAL nunca foi o CHECK, e sim a FK COMPOSTA
--   (need_concept_id, fulfillment_kind) → concept_offer_kinds (concept_id, offer_kind)
-- criada na mesma migration de origem (20260708360000). A FK continua intacta: só é possível
-- declarar 'rentable' para um concept que JÁ está cadastrado como locável. O CHECK apenas deixa
-- de ser mais estrito que a norma — ampliar não invalida nenhuma linha existente (todas são
-- 'service', que segue permitido).
--
-- ⚠️ NÃO INCLUI canal de venda (lojas parceiras revendendo ingresso). Isso NÃO é offer_kind: um
-- ponto de venda não "oferta o conceito", ele distribui o ingresso de outro. Criar 'sales_channel'
-- aqui seria enfiar uma relação comercial dentro do vocabulário de ofertabilidade. Fica como
-- frente própria, nomeada e não decidida.

BEGIN;

ALTER TABLE event_orchestration_template_items
  DROP CONSTRAINT IF EXISTS chk_event_orch_template_fulfillment;

ALTER TABLE event_orchestration_template_items
  ADD CONSTRAINT chk_event_orch_template_fulfillment
  CHECK (fulfillment_kind IN ('service', 'rentable'));

ALTER TABLE event_operational_needs
  DROP CONSTRAINT IF EXISTS chk_event_op_needs_fulfillment;

ALTER TABLE event_operational_needs
  ADD CONSTRAINT chk_event_op_needs_fulfillment
  CHECK (fulfillment_kind IN ('service', 'rentable'));

COMMENT ON COLUMN event_orchestration_template_items.fulfillment_kind IS
  'COMO a necessidade se resolve. Vocabulário GOVERNADO por concept_offer_kinds.offer_kind '
  '(service | rentable) — a FK composta com concept_offer_kinds é o enforcement material. '
  'NÃO enumerar valor aqui sem que ele exista naquele vocabulário.';

COMMENT ON COLUMN event_operational_needs.fulfillment_kind IS
  'COMO a necessidade se resolve. Mesmo vocabulário GOVERNADO de '
  'event_orchestration_template_items.fulfillment_kind (concept_offer_kinds.offer_kind).';

COMMIT;

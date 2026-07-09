-- 20260708330000: F-OFFER-KIND-SERVICE-GATE (GO Clayton 2026-07-08, condicionado a gate governado).
-- CONTENÇÃO de papel semântico: canonical_services sozinho NÃO significa serviço ofertável. O picker de
-- criação de serviço / capability profissional / demanda passa a enxergar SÓ concept com
-- offer_kind='service' (aplicabilidade governada, espelho de 'rentable'). Assunto/tema/formato de evento
-- (futebol/festa/campeonato/…) NÃO é serviço por existir no CONCEPT — fica de fora do gate.
-- CHECK compõe do vocabulário GOVERNADO CONCEPT_OFFER_KINDS (manifest) — não literal solto. Δbank=0.
BEGIN;

-- (1) CHECK governado: offer_kind ∈ CONCEPT_OFFER_KINDS = {rentable, service}. Nome canônico próprio.
ALTER TABLE concept_offer_kinds DROP CONSTRAINT IF EXISTS concept_offer_kinds_offer_kind_check;
ALTER TABLE concept_offer_kinds DROP CONSTRAINT IF EXISTS chk_concept_offer_kind_value;
ALTER TABLE concept_offer_kinds
  ADD CONSTRAINT chk_concept_offer_kind_value CHECK (offer_kind IN ('rentable', 'service'));

-- (2) BACKFILL SELETIVO: offer_kind='service' APENAS para serviços reais. Critério = domain='servicos'
-- (N0 governado de serviços: Corte de cabelo, Barba, etc.) COM canonical_service ativo. Forbidden
-- (cultura-lazer-e-eventos = assuntos/formatos; bens-imoveis = espaços; produtos = produtos) NÃO entram.
-- Nada é materialmente usado como serviço hoje (0 services/professional/offerings) — sem risco de quebra.
INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT DISTINCT c.concept_id, 'service'
  FROM concepts c
  JOIN canonical_services cs ON cs.concept_id = c.concept_id
 WHERE c.domain = 'servicos'
   AND cs.scope = 'global' AND cs.tenant_id IS NULL AND cs.status = 'active'
ON CONFLICT (concept_id, offer_kind) DO NOTHING;

COMMIT;

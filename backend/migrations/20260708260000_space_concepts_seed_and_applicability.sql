-- 20260708260000: SEED governado dos concepts de ESPAÇO + tabela de APLICABILIDADE por resource_type.
-- (GO Clayton 2026-07-08). Imóvel x Espaço = modalidade de USO, não matéria. A identidade continua em
-- CONCEPT (SSOT); resource_type é modalidade operacional. Não cria N1/N2/CONTEXT novo.
-- Seed: 12 concepts de espaço (concepts + canonical_services global + offer_kind rentable), idempotente.
-- Aplicabilidade: concept_rentable_types diz quais concepts aparecem em property vs space (com overlap:
-- consultório/sala-comercial servem aos DOIS — imóvel inteiro OU uso por hora/turno). Δbank=0.
BEGIN;

-- Autoriza o seed de concepts nesta transação (governança 0075 — insert direto é bloqueado sem isto).
SELECT set_config('app.concept_governance', 'true', true);

-- tabela de aplicabilidade (facet, não árvore): concept ↔ resource_type onde ele é ofertável.
CREATE TABLE IF NOT EXISTS concept_rentable_types (
  concept_id UUID NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('property', 'space', 'equipment', 'vehicle')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (concept_id, resource_type)
);

-- (1) concepts de espaço (slug → nome). domain = bens-imoveis (mesma natureza; o uso é que muda).
WITH novos(slug, nome) AS (VALUES
  ('sala-de-reuniao', 'Sala de reunião'),
  ('salao-de-festa', 'Salão de festa'),
  ('area-de-churrasco', 'Área de churrasco'),
  ('quadra-esportiva', 'Quadra esportiva'),
  ('estudio', 'Estúdio'),
  ('vaga-de-garagem', 'Vaga de garagem'),
  ('box-de-garagem', 'Box de garagem'),
  ('quiosque', 'Quiosque'),
  ('estande', 'Estande'),
  ('estacao-de-barbeiro', 'Estação de barbeiro'),
  ('estacao-de-cabeleireiro', 'Estação de cabeleireiro'),
  ('box-de-mecanica', 'Box de mecânica')
),
ins_concept AS (
  INSERT INTO concepts (concept_id, slug, domain)
  SELECT gen_random_uuid(), n.slug, 'bens-imoveis' FROM novos n
  WHERE NOT EXISTS (SELECT 1 FROM concepts c WHERE c.slug = n.slug)
  RETURNING concept_id, slug
)
-- canonical_service global de cada concept novo (nome de exibição). Usa o concept_id recém-criado OU o já existente.
INSERT INTO canonical_services (concept_id, tenant_id, scope, name, slug, status, attributes)
SELECT c.concept_id, NULL, 'global', n.nome, n.slug, 'active', '{}'::jsonb
  FROM novos n JOIN concepts c ON c.slug = n.slug
 WHERE NOT EXISTS (SELECT 1 FROM canonical_services cs WHERE cs.concept_id = c.concept_id AND cs.tenant_id IS NULL);

-- (2) offer_kind rentable para os 12.
INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT c.concept_id, 'rentable'
  FROM concepts c
 WHERE c.slug IN ('sala-de-reuniao','salao-de-festa','area-de-churrasco','quadra-esportiva','estudio','vaga-de-garagem','box-de-garagem','quiosque','estande','estacao-de-barbeiro','estacao-de-cabeleireiro','box-de-mecanica')
ON CONFLICT (concept_id, offer_kind) DO NOTHING;

-- (3a) aplicabilidade SPACE: os 12 novos + overlap (consultório/sala-comercial servem por hora/turno).
INSERT INTO concept_rentable_types (concept_id, resource_type)
SELECT c.concept_id, 'space'
  FROM concepts c
 WHERE c.slug IN ('sala-de-reuniao','salao-de-festa','area-de-churrasco','quadra-esportiva','estudio','vaga-de-garagem','box-de-garagem','quiosque','estande','estacao-de-barbeiro','estacao-de-cabeleireiro','box-de-mecanica','consultorio','sala-comercial')
ON CONFLICT DO NOTHING;

-- (3b) aplicabilidade PROPERTY: as unidades imobiliárias (bens-imoveis rentable EXCETO os concepts que
-- só fazem sentido como espaço). consultório/sala-comercial ficam nos dois (imóvel inteiro).
INSERT INTO concept_rentable_types (concept_id, resource_type)
SELECT c.concept_id, 'property'
  FROM concepts c
  JOIN concept_offer_kinds k ON k.concept_id = c.concept_id AND k.offer_kind = 'rentable'
 WHERE c.domain = 'bens-imoveis'
   AND c.slug NOT IN ('sala-de-reuniao','salao-de-festa','area-de-churrasco','quadra-esportiva','estudio','vaga-de-garagem','box-de-garagem','quiosque','estande','estacao-de-barbeiro','estacao-de-cabeleireiro','box-de-mecanica')
ON CONFLICT DO NOTHING;

COMMIT;

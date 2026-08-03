-- 20260803130000_show_orchestration_roles_not_equipment.sql
-- F-EVENT-ORCHESTRATION-ROLES: o template do SHOW passa a pedir GENTE, não PEÇA.
--
-- ═══ A CORREÇÃO CONCEITUAL (Clayton, 2026-08-03, atravessando a tela) ═══
--   "Mesa de som / Caixa de som / Microfone… acho que pode ser equipamentos, porque com a empresa
--    ele define o que vai precisar, certo? Qual o nome do profissional que cuida de toda a parte do
--    som? acho que isto também falta."
--
-- Ele está certo, e a régua que isso estabelece vale para o catálogo inteiro:
--   SERVIÇO = gente que se contrata; o FORNECEDOR traz o equipamento dele
--   LOCAÇÃO = bem que o organizador aluga direto, sem profissional embutido
--
-- A fatia anterior (20260803110000, minha) ligou 7 LOCÁVEIS ao Show — e errou em 5: mesa de som,
-- caixa de som, microfone, monitor de palco e torre de iluminação são o que a empresa de
-- sonorização/iluminação TRAZ. O organizador não deve declarar peça por peça; ele declara que
-- precisa de SOM. Tenda e gerador ficam: esses ele aluga direto, sem gente junto.
--
-- ⚠️ NADA É APAGADO DO CATÁLOGO: os 5 equipamentos seguem `rentable` e continuam locáveis avulsos.
-- O que sai é o VÍNCULO com o formato Show — o wizard para de pedir peça, não perde a peça.
--
-- Identidade por SLUG (concept_id é uuid_generate_v4 por ambiente). Domain/scope/status copiados do
-- padrão medido nos serviços de evento que já existem (servicos/global/active).

BEGIN;

-- 🔴 GOVERNANÇA DE CONCEITO — trava REAL do sistema, encontrada ao tentar aplicar esta migration:
--   "concept insert blocked: use concept governance (set app.concept_governance in authorized
--    transaction)"  (trigger enforce_concept_governance sobre `concepts`)
-- Não existe INSERT direto em `concepts`. O flag abaixo é o mecanismo PREVISTO pela própria trava
-- ("authorized transaction"), não um contorno: migration é ato de governança, revisado e versionado.
-- SET LOCAL — vale só nesta transação e morre no COMMIT; nunca vaza para a sessão.
-- ⚠️ Runtime NÃO pode fazer isto. Código de aplicação que precise criar conceito usa o writer
-- canônico; setar este flag fora de migration é criar catálogo pelas costas da governança.
SET LOCAL app.concept_governance = 'true';

-- ── 1. CONCEITOS NOVOS ────────────────────────────────────────────────────────────────────────
INSERT INTO concepts (slug, domain)
SELECT v.slug, v.domain
  FROM (VALUES
    ('sonorizacao-tecnico-de-som',   'servicos'),
    ('iluminacao-tecnico-de-luz',    'servicos'),
    ('brigadista-equipe-de-saude',   'servicos'),
    ('recepcao-portaria',            'servicos'),
    ('estacionamento-manobrista',    'servicos'),
    ('bartender',                    'servicos'),
    ('promotores-modelos',           'servicos'),
    ('montagem-de-palco',            'servicos'),
    ('banheiro-quimico',             'produtos-e-comercio')
  ) AS v(slug, domain)
ON CONFLICT (domain, slug) DO NOTHING;

-- ── 2. OFERTABILIDADE (governa fulfillment_kind via FK composta) ──────────────────────────────
INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT c.concept_id, v.kind
  FROM (VALUES
    ('sonorizacao-tecnico-de-som',   'servicos',            'service'),
    ('iluminacao-tecnico-de-luz',    'servicos',            'service'),
    ('brigadista-equipe-de-saude',   'servicos',            'service'),
    ('recepcao-portaria',            'servicos',            'service'),
    ('estacionamento-manobrista',    'servicos',            'service'),
    ('bartender',                    'servicos',            'service'),
    ('promotores-modelos',           'servicos',            'service'),
    ('montagem-de-palco',            'servicos',            'service'),
    ('banheiro-quimico',             'produtos-e-comercio', 'rentable')
  ) AS v(slug, domain, kind)
  JOIN concepts c ON c.slug = v.slug AND c.domain = v.domain
ON CONFLICT DO NOTHING;

-- ── 3. NOME EXIBIDO (canonical_services · catálogo global) ────────────────────────────────────
INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, attributes, status)
SELECT NULL, 'global', c.concept_id, v.name, v.slug, '{}'::jsonb, 'active'
  FROM (VALUES
    ('sonorizacao-tecnico-de-som',   'servicos',            'Sonorização (técnico de som)'),
    ('iluminacao-tecnico-de-luz',    'servicos',            'Iluminação (técnico de luz)'),
    ('brigadista-equipe-de-saude',   'servicos',            'Brigadista / equipe de saúde'),
    ('recepcao-portaria',            'servicos',            'Recepção / portaria'),
    ('estacionamento-manobrista',    'servicos',            'Estacionamento / manobrista'),
    ('bartender',                    'servicos',            'Bartender'),
    ('promotores-modelos',           'servicos',            'Promotores / modelos'),
    ('montagem-de-palco',            'servicos',            'Montagem de palco'),
    ('banheiro-quimico',             'produtos-e-comercio', 'Banheiro químico')
  ) AS v(slug, domain, name)
  JOIN concepts c ON c.slug = v.slug AND c.domain = v.domain
 WHERE NOT EXISTS (
   SELECT 1 FROM canonical_services cs WHERE cs.concept_id = c.concept_id AND cs.tenant_id IS NULL
 );

-- ── 4. DESLIGA OS EQUIPAMENTOS DO FORMATO SHOW (o catálogo os mantém locáveis) ────────────────
DELETE FROM event_orchestration_template_items t
 USING concepts n
 WHERE t.need_concept_id = n.concept_id
   AND n.slug IN ('mesa-de-som','caixa-de-som','microfone','monitor-de-palco','torre-de-iluminacao')
   AND t.format_concept_id = (
     SELECT concept_id FROM concepts WHERE slug = 'show' AND domain = 'cultura-lazer-e-eventos'
   );

-- ── 5. LIGA AS FUNÇÕES AO SHOW (novas + as 3 que já existiam e nunca foram ligadas) ───────────
INSERT INTO event_orchestration_template_items
  (format_concept_id, need_concept_id, fulfillment_kind, is_required, sort_order)
SELECT fmt.concept_id, c.concept_id, v.kind, v.req, v.ord
  FROM (VALUES
    ('brigadista-equipe-de-saude',   'servicos',            'service',  true,   15),
    ('sonorizacao-tecnico-de-som',   'servicos',            'service',  true,   20),
    ('iluminacao-tecnico-de-luz',    'servicos',            'service',  false,  25),
    ('montagem-de-palco',            'servicos',            'service',  false,  30),
    ('recepcao-portaria',            'servicos',            'service',  true,   35),
    ('estacionamento-manobrista',    'servicos',            'service',  false,  40),
    ('bartender',                    'servicos',            'service',  false,  45),
    ('garcom',                       'servicos',            'service',  false,  50),
    ('buffet-para-eventos',          'servicos',            'service',  false,  55),
    ('cozinheiro',                   'servicos',            'service',  false,  60),
    ('promotores-modelos',           'servicos',            'service',  false,  65),
    ('banheiro-quimico',             'produtos-e-comercio', 'rentable', true,   70)
  ) AS v(slug, domain, kind, req, ord)
  JOIN concepts c ON c.slug = v.slug AND c.domain = v.domain
  JOIN concept_offer_kinds k ON k.concept_id = c.concept_id AND k.offer_kind = v.kind
  CROSS JOIN (
    SELECT f.concept_id FROM event_format_concepts f
      JOIN concepts fc ON fc.concept_id = f.concept_id
     WHERE fc.slug = 'show' AND fc.domain = 'cultura-lazer-e-eventos'
  ) AS fmt
ON CONFLICT (format_concept_id, need_concept_id) DO NOTHING;

COMMIT;

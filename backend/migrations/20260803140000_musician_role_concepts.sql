-- 20260803140000_musician_role_concepts.sql
-- F-MUSICIAN-ROLES: papéis de MÚSICO como serviço contratável — o que a pessoa SABE TOCAR.
--
-- ═══ A RÉGUA (Clayton, 2026-08-03, na mesma sessão) ═══
--   SERVIÇO = gente que se contrata; o FORNECEDOR traz o equipamento dele
--   LOCAÇÃO = bem que se aluga direto, sem profissional embutido
-- Foi ela que fez `mesa-de-som` continuar equipamento e nascer `sonorizacao-tecnico-de-som`
-- (migration 20260803130000). Esta migration aplica a MESMA régua ao músico.
--
-- 🔴 O ERRO QUE ISTO EVITA — a direção quase o cometeu, horas depois de escrever a régua:
-- `guitarra`, `baixo` e `bateria` JÁ EXISTEM, mas em `domain='produtos-e-comercio'` com
-- `offer_kind='rentable'` — são EQUIPAMENTO LOCÁVEL (pool do checklist "eu trago meu gear",
-- migration 20260722120000). A direção verificou que "guitarra existe" e ia semear teclado/voz/sax
-- NESSE pool. O sistema então diria "esta oferta inclui um saxofone alugável" quando o músico quis
-- dizer "eu toco sax" — e o writer ACEITARIA, porque o slug está mesmo no pool rentable.
-- Aceitar não faz virar certo. Derrubado por auditoria independente antes de virar dado.
--
-- ═══ AS DUAS PERGUNTAS SÃO DIFERENTES, E A TELA VAI PRECISAR DAS DUAS ═══
--   "o que eu SEI tocar"  → ESTES conceitos (servicos/service) — é assim que me contratam
--   "o que eu LEVO"       → os que já existem (produtos-e-comercio/rentable) — checklist de gear
-- Um baixista com baixo próprio marca as duas coisas; são informações distintas e ambas úteis.
--
-- ⚠️ GÊNERO NÃO ENTRA AQUI. "Baixista de rock" não é um conceito: é `Baixista` (papel) + `rock`
-- (gênero, em shared_subject_concepts) taggeado NA OFERTA via tagOfferingGenres. Fundir os dois
-- criaria produto cartesiano — baixista-rock, baixista-samba, baixista-sertanejo… — e o catálogo
-- viraria combinação em vez de vocabulário. A busca cruza os dois eixos, que é o que Clayton pediu:
-- "em uma banda de rock não adianta um baixista que toca sertanejo".
--
-- Identidade por SLUG (concept_id é uuid_generate_v4 por ambiente).

BEGIN;

-- Governança de conceito: mecanismo PREVISTO pela trava `enforce_concept_governance`
-- ("authorized transaction"). SET LOCAL morre no COMMIT e nunca vaza para a sessão.
-- ⚠️ Runtime NÃO pode fazer isto — código de aplicação usa o writer canônico.
SET LOCAL app.concept_governance = 'true';

INSERT INTO concepts (slug, domain)
SELECT v.slug, 'servicos'
  FROM (VALUES
    ('vocalista'), ('guitarrista'), ('baixista'), ('baterista'), ('tecladista'),
    ('violonista'), ('percussionista'), ('saxofonista'), ('trompetista'), ('trombonista'),
    ('violinista'), ('sanfoneiro'), ('cavaquinista'), ('dj')
  ) AS v(slug)
ON CONFLICT (domain, slug) DO NOTHING;

INSERT INTO concept_offer_kinds (concept_id, offer_kind)
SELECT c.concept_id, 'service'
  FROM concepts c
 WHERE c.domain = 'servicos'
   AND c.slug IN ('vocalista','guitarrista','baixista','baterista','tecladista','violonista',
                  'percussionista','saxofonista','trompetista','trombonista','violinista',
                  'sanfoneiro','cavaquinista','dj')
ON CONFLICT DO NOTHING;

INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, attributes, status)
SELECT NULL, 'global', c.concept_id, v.name, v.slug, '{}'::jsonb, 'active'
  FROM (VALUES
    ('vocalista',      'Vocalista'),
    ('guitarrista',    'Guitarrista'),
    ('baixista',       'Baixista'),
    ('baterista',      'Baterista'),
    ('tecladista',     'Tecladista'),
    ('violonista',     'Violonista'),
    ('percussionista', 'Percussionista'),
    ('saxofonista',    'Saxofonista'),
    ('trompetista',    'Trompetista'),
    ('trombonista',    'Trombonista'),
    ('violinista',     'Violinista'),
    ('sanfoneiro',     'Sanfoneiro'),
    ('cavaquinista',   'Cavaquinista'),
    ('dj',             'DJ')
  ) AS v(slug, name)
  JOIN concepts c ON c.slug = v.slug AND c.domain = 'servicos'
 WHERE NOT EXISTS (
   SELECT 1 FROM canonical_services cs WHERE cs.concept_id = c.concept_id AND cs.tenant_id IS NULL
 );

COMMIT;

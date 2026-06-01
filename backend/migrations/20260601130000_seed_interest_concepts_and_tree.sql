-- ============================================================
-- 20260601130000: Migration B — Interest concepts (governado) + árvore scope='interest'
-- ============================================================
-- Autoridade: DECISION-0064 (Opção C) + DECISION-0066 + ADENDO A (slugs de category com sufixo -interesse).
-- Objetivo:
--   (1) criar 11 concepts NOVOS de lazer/afinidade no domínio N0 'cultura-lazer-e-eventos' (slug LIMPO);
--   (2) criar árvore mínima governada scope='interest': 7 raízes (level 0, sem concept) + 38 folhas
--       (level 1, com concept_id), TODAS com slug de category sufixado '-interesse'
--       (categories_slug_key é UNIQUE global; concepts mantêm slug limpo — ADENDO A);
--   (3) folhas reutilizam concepts de Learning (educacao-e-conhecimento) quando o significado é comum (27),
--       e usam concepts novos (cultura-lazer-e-eventos) para lazer/afinidade (11).
-- Invariantes: categories=navegação; concepts=identidade (Lei 7). Sufixo -interesse é navegação, não
--   identidade. Folha interest e folha learning compartilham o MESMO concept_id (slugs de category distintos).
-- NÃO toca scope='learning', lifestyle, C1, frontend, financeiro.
-- Propriedades: forward-only (Lei 2), idempotente (ON CONFLICT), transacional, fail-closed.
-- ============================================================

BEGIN;

-- GUARD 0: domínio N0 deve existir (fail-closed).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM domains WHERE domain_key = 'cultura-lazer-e-eventos') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: domain cultura-lazer-e-eventos ausente em domains';
  END IF;
END $$;

-- Governança de INSERT em concepts (trigger trg_concept_governance exige isto na mesma transação).
SELECT set_config('app.concept_governance', 'true', true);

-- PASSO 1: criar 11 concepts NOVOS (slug limpo, domain cultura-lazer-e-eventos). Idempotente.
INSERT INTO concepts (slug, domain)
SELECT v.slug, 'cultura-lazer-e-eventos'
FROM (
  VALUES
    ('cinema-e-series'),
    ('leitura'),
    ('teatro'),
    ('futebol'),
    ('corrida'),
    ('yoga'),
    ('gadgets'),
    ('vinhos-e-bebidas'),
    ('cafe'),
    ('viagens'),
    ('pets')
) AS v(slug)
ON CONFLICT (domain, slug) DO NOTHING;

-- PASSO 2: criar 7 raízes scope='interest' (level 0, sem concept, slug -interesse). Idempotente.
INSERT INTO categories (
  name, slug, description, level, path, parent_id, scope, status,
  requires_review, is_created_by_ai, is_active, keywords, metadata, concept_id
)
SELECT v.name, v.slug, NULL, 0, ARRAY[]::text[], NULL, 'interest', 'active',
       false, false, true, '[]'::jsonb, '{}'::jsonb, NULL
FROM (
  VALUES
    ('cultura-e-arte-interesse', 'Cultura e Arte'),
    ('esporte-e-bem-estar-interesse', 'Esporte e Bem-Estar'),
    ('tecnologia-e-jogos-interesse', 'Tecnologia e Jogos'),
    ('gastronomia-interesse', 'Gastronomia'),
    ('casa-e-mao-na-massa-interesse', 'Casa e Mão na Massa'),
    ('negocios-e-financas-interesse', 'Negócios e Finanças'),
    ('mundo-e-pessoas-interesse', 'Mundo e Pessoas')
) AS v(slug, name)
ON CONFLICT (slug) DO NOTHING;

-- PASSO 3: criar 38 folhas scope='interest' (level 1, com concept_id, slug -interesse). Idempotente.
-- parent_id resolvido pelo slug da raiz; concept_id resolvido por (slug, domain). Mapping literal.
WITH leaf(leaf_slug, leaf_name, root_slug, concept_slug, concept_domain) AS (
  VALUES
    -- cultura-e-arte
    ('musica-interesse', 'Música', 'cultura-e-arte-interesse', 'musica', 'educacao-e-conhecimento'),
    ('fotografia-interesse', 'Fotografia', 'cultura-e-arte-interesse', 'fotografia', 'educacao-e-conhecimento'),
    ('cinema-e-series-interesse', 'Cinema e Séries', 'cultura-e-arte-interesse', 'cinema-e-series', 'cultura-lazer-e-eventos'),
    ('leitura-interesse', 'Leitura', 'cultura-e-arte-interesse', 'leitura', 'cultura-lazer-e-eventos'),
    ('teatro-interesse', 'Teatro', 'cultura-e-arte-interesse', 'teatro', 'cultura-lazer-e-eventos'),
    ('desenho-ilustracao-interesse', 'Desenho e Ilustração', 'cultura-e-arte-interesse', 'desenho-ilustracao', 'educacao-e-conhecimento'),
    ('design-interesse', 'Design', 'cultura-e-arte-interesse', 'design', 'educacao-e-conhecimento'),
    -- esporte-e-bem-estar
    ('atividade-fisica-interesse', 'Atividade Física', 'esporte-e-bem-estar-interesse', 'atividade-fisica', 'educacao-e-conhecimento'),
    ('futebol-interesse', 'Futebol', 'esporte-e-bem-estar-interesse', 'futebol', 'cultura-lazer-e-eventos'),
    ('corrida-interesse', 'Corrida', 'esporte-e-bem-estar-interesse', 'corrida', 'cultura-lazer-e-eventos'),
    ('yoga-interesse', 'Yoga', 'esporte-e-bem-estar-interesse', 'yoga', 'cultura-lazer-e-eventos'),
    ('nutricao-interesse', 'Nutrição', 'esporte-e-bem-estar-interesse', 'nutricao', 'educacao-e-conhecimento'),
    ('saude-mental-interesse', 'Saúde Mental', 'esporte-e-bem-estar-interesse', 'saude-mental', 'educacao-e-conhecimento'),
    -- tecnologia-e-jogos
    ('games-interesse', 'Games', 'tecnologia-e-jogos-interesse', 'games', 'educacao-e-conhecimento'),
    ('programacao-interesse', 'Programação', 'tecnologia-e-jogos-interesse', 'programacao', 'educacao-e-conhecimento'),
    ('inteligencia-artificial-interesse', 'Inteligência Artificial', 'tecnologia-e-jogos-interesse', 'inteligencia-artificial', 'educacao-e-conhecimento'),
    ('ferramentas-digitais-interesse', 'Ferramentas Digitais', 'tecnologia-e-jogos-interesse', 'ferramentas-digitais', 'educacao-e-conhecimento'),
    ('gadgets-interesse', 'Gadgets', 'tecnologia-e-jogos-interesse', 'gadgets', 'cultura-lazer-e-eventos'),
    -- gastronomia
    ('culinaria-interesse', 'Culinária', 'gastronomia-interesse', 'culinaria', 'educacao-e-conhecimento'),
    ('confeitaria-interesse', 'Confeitaria', 'gastronomia-interesse', 'confeitaria', 'educacao-e-conhecimento'),
    ('panificacao-interesse', 'Panificação', 'gastronomia-interesse', 'panificacao', 'educacao-e-conhecimento'),
    ('vinhos-e-bebidas-interesse', 'Vinhos e Bebidas', 'gastronomia-interesse', 'vinhos-e-bebidas', 'cultura-lazer-e-eventos'),
    ('cafe-interesse', 'Café', 'gastronomia-interesse', 'cafe', 'cultura-lazer-e-eventos'),
    -- casa-e-mao-na-massa
    ('jardinagem-interesse', 'Jardinagem', 'casa-e-mao-na-massa-interesse', 'jardinagem', 'educacao-e-conhecimento'),
    ('marcenaria-interesse', 'Marcenaria', 'casa-e-mao-na-massa-interesse', 'marcenaria', 'educacao-e-conhecimento'),
    ('diy-interesse', 'DIY', 'casa-e-mao-na-massa-interesse', 'diy', 'educacao-e-conhecimento'),
    ('decoracao-interesse', 'Decoração', 'casa-e-mao-na-massa-interesse', 'decoracao', 'educacao-e-conhecimento'),
    ('manutencao-basica-interesse', 'Manutenção Básica', 'casa-e-mao-na-massa-interesse', 'manutencao-basica', 'educacao-e-conhecimento'),
    -- negocios-e-financas
    ('empreendedorismo-interesse', 'Empreendedorismo', 'negocios-e-financas-interesse', 'empreendedorismo', 'educacao-e-conhecimento'),
    ('financas-pessoais-interesse', 'Finanças Pessoais', 'negocios-e-financas-interesse', 'financas-pessoais', 'educacao-e-conhecimento'),
    ('gestao-interesse', 'Gestão', 'negocios-e-financas-interesse', 'gestao', 'educacao-e-conhecimento'),
    ('marketing-digital-interesse', 'Marketing Digital', 'negocios-e-financas-interesse', 'marketing-digital', 'educacao-e-conhecimento'),
    -- mundo-e-pessoas
    ('idiomas-interesse', 'Idiomas', 'mundo-e-pessoas-interesse', 'idiomas', 'educacao-e-conhecimento'),
    ('historia-interesse', 'História', 'mundo-e-pessoas-interesse', 'historia', 'educacao-e-conhecimento'),
    ('filosofia-interesse', 'Filosofia', 'mundo-e-pessoas-interesse', 'filosofia', 'educacao-e-conhecimento'),
    ('ciencias-interesse', 'Ciências', 'mundo-e-pessoas-interesse', 'ciencias', 'educacao-e-conhecimento'),
    ('viagens-interesse', 'Viagens', 'mundo-e-pessoas-interesse', 'viagens', 'cultura-lazer-e-eventos'),
    ('pets-interesse', 'Pets', 'mundo-e-pessoas-interesse', 'pets', 'cultura-lazer-e-eventos')
)
INSERT INTO categories (
  name, slug, description, level, path, parent_id, scope, status,
  requires_review, is_created_by_ai, is_active, keywords, metadata, concept_id
)
SELECT
  l.leaf_name, l.leaf_slug, NULL, 1, ARRAY[l.root_slug]::text[], r.category_id, 'interest', 'active',
  false, false, true, '[]'::jsonb, '{}'::jsonb, c.concept_id
FROM leaf l
JOIN categories r ON r.slug = l.root_slug AND r.scope = 'interest' AND r.level = 0
JOIN concepts c ON c.slug = l.concept_slug AND c.domain = l.concept_domain
ON CONFLICT (slug) DO NOTHING;

-- GUARDS DE VALIDAÇÃO (fail-closed — rollback se algo não bater).
DO $$
DECLARE
  v_concepts          INTEGER;
  v_roots             INTEGER;
  v_roots_concept     INTEGER;
  v_leaves            INTEGER;
  v_leaves_noconcept  INTEGER;
  v_nonsuffix         INTEGER;
  v_reuse             INTEGER;
  v_new               INTEGER;
  v_learn_leaves      INTEGER;
  v_learn_roots       INTEGER;
BEGIN
  -- 11 concepts novos em cultura-lazer-e-eventos
  SELECT count(*) INTO v_concepts FROM concepts
   WHERE domain = 'cultura-lazer-e-eventos'
     AND slug IN ('cinema-e-series','leitura','teatro','futebol','corrida','yoga','gadgets','vinhos-e-bebidas','cafe','viagens','pets');
  IF v_concepts <> 11 THEN RAISE EXCEPTION 'MIGRATION_ABORT: concepts novos=% (esperado 11)', v_concepts; END IF;

  -- 7 raízes scope='interest', sem concept
  SELECT count(*) INTO v_roots FROM categories WHERE scope='interest' AND level=0;
  IF v_roots <> 7 THEN RAISE EXCEPTION 'MIGRATION_ABORT: roots interest=% (esperado 7)', v_roots; END IF;
  SELECT count(*) INTO v_roots_concept FROM categories WHERE scope='interest' AND level=0 AND concept_id IS NOT NULL;
  IF v_roots_concept <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: roots interest com concept=% (esperado 0)', v_roots_concept; END IF;

  -- 38 folhas scope='interest', todas com concept
  SELECT count(*) INTO v_leaves FROM categories WHERE scope='interest' AND level=1;
  IF v_leaves <> 38 THEN RAISE EXCEPTION 'MIGRATION_ABORT: leaves interest=% (esperado 38)', v_leaves; END IF;
  SELECT count(*) INTO v_leaves_noconcept FROM categories WHERE scope='interest' AND level=1 AND concept_id IS NULL;
  IF v_leaves_noconcept <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: leaves interest sem concept=%', v_leaves_noconcept; END IF;

  -- TODAS as categorias interest com sufixo -interesse
  SELECT count(*) INTO v_nonsuffix FROM categories WHERE scope='interest' AND slug NOT LIKE '%-interesse';
  IF v_nonsuffix <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % categorias interest sem sufixo -interesse', v_nonsuffix; END IF;

  -- folhas reuso apontam educacao (27); folhas novas apontam cultura-lazer (11)
  SELECT count(*) INTO v_reuse FROM categories cat JOIN concepts c ON c.concept_id=cat.concept_id
   WHERE cat.scope='interest' AND cat.level=1 AND c.domain='educacao-e-conhecimento';
  IF v_reuse <> 27 THEN RAISE EXCEPTION 'MIGRATION_ABORT: leaves reuso educacao=% (esperado 27)', v_reuse; END IF;
  SELECT count(*) INTO v_new FROM categories cat JOIN concepts c ON c.concept_id=cat.concept_id
   WHERE cat.scope='interest' AND cat.level=1 AND c.domain='cultura-lazer-e-eventos';
  IF v_new <> 11 THEN RAISE EXCEPTION 'MIGRATION_ABORT: leaves novas cultura-lazer=% (esperado 11)', v_new; END IF;

  -- Learning INALTERADO (36 folhas com concept + 8 raízes sem concept)
  SELECT count(*) INTO v_learn_leaves FROM categories WHERE scope='learning' AND level=1 AND concept_id IS NOT NULL;
  IF v_learn_leaves <> 36 THEN RAISE EXCEPTION 'MIGRATION_ABORT: learning leaves com concept=% (esperado 36 — learning nao deve mudar)', v_learn_leaves; END IF;
  SELECT count(*) INTO v_learn_roots FROM categories WHERE scope='learning' AND level=0 AND concept_id IS NOT NULL;
  IF v_learn_roots <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: learning roots com concept=% (esperado 0)', v_learn_roots; END IF;
END $$;

COMMIT;

-- ============================================================
-- 20260601120000: Migration A — Learning concepts (governado) + associação às folhas
-- ============================================================
-- Autoridade: DECISION-0064 (Opção C híbrida governada) + DECISION-0065 (diretrizes materiais).
-- Objetivo:
--   (1) criar 36 concepts de Learning no domínio N0 'educacao-e-conhecimento' (slug LIMPO do tópico,
--       sem sufixo de contexto), via governança (app.concept_governance);
--   (2) associar categories.concept_id às 36 folhas EXISTENTES scope='learning' level=1 por mapping
--       literal category_slug -> concept_slug, PRESERVANDO a árvore atual (sem reestruturar, sem
--       create_category_from_concept, sem criar nível 2).
-- Invariantes:
--   - categories = navegação; concepts = identidade semântica (Lei 7).
--   - source/breadcrumb permanece nas categorias; concept_id é a identidade.
--   - raízes/agregadores (level 0) permanecem SEM concept_id.
--   - NÃO toca scope='interest', C1, frontend, financeiro.
-- Propriedades: forward-only (Lei 2), idempotente, transacional, fail-closed.
-- ============================================================

BEGIN;

-- GUARD 0: domínio N0 deve existir (fail-closed).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM domains WHERE domain_key = 'educacao-e-conhecimento') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: domain educacao-e-conhecimento ausente em domains';
  END IF;
END $$;

-- Governança de INSERT em concepts (trigger trg_concept_governance exige isto na mesma transação).
SELECT set_config('app.concept_governance', 'true', true);

-- PASSO 1: criar concepts (slug limpo, domain educacao-e-conhecimento). Idempotente.
INSERT INTO concepts (slug, domain)
SELECT v.slug, 'educacao-e-conhecimento'
FROM (
  VALUES
    ('fotografia'),
    ('musica'),
    ('desenho-ilustracao'),
    ('design'),
    ('escrita-criativa'),
    ('video'),
    ('programacao'),
    ('inteligencia-artificial'),
    ('ferramentas-digitais'),
    ('games'),
    ('idiomas'),
    ('ciencias'),
    ('estudos-gerais'),
    ('filosofia'),
    ('historia'),
    ('culinaria'),
    ('confeitaria'),
    ('panificacao'),
    ('nutricao'),
    ('atividade-fisica'),
    ('saude-mental'),
    ('marketing-digital'),
    ('redes-sociais'),
    ('producao-conteudo'),
    ('escrita-profissional'),
    ('oratoria'),
    ('empreendedorismo'),
    ('gestao'),
    ('vendas'),
    ('financas-pessoais'),
    ('organizacao-produtividade'),
    ('decoracao'),
    ('jardinagem'),
    ('marcenaria'),
    ('diy'),
    ('manutencao-basica')
) AS v(slug)
ON CONFLICT (domain, slug) DO NOTHING;

-- PASSO 2: associar concept_id às folhas existentes (mapping literal). Idempotente
-- (só atualiza folha scope='learning' level=1 ainda sem concept_id).
WITH mapping(cat_slug, concept_slug) AS (
  VALUES
    ('fotografia-aprendizado', 'fotografia'),
    ('musica-aprendizado', 'musica'),
    ('desenho-ilustracao', 'desenho-ilustracao'),
    ('design-aprendizado', 'design'),
    ('escrita-criativa', 'escrita-criativa'),
    ('video-aprendizado', 'video'),
    ('programacao', 'programacao'),
    ('inteligencia-artificial', 'inteligencia-artificial'),
    ('ferramentas-digitais', 'ferramentas-digitais'),
    ('games-aprendizado', 'games'),
    ('idiomas', 'idiomas'),
    ('ciencias', 'ciencias'),
    ('estudos-gerais', 'estudos-gerais'),
    ('filosofia-aprendizado', 'filosofia'),
    ('historia-aprendizado', 'historia'),
    ('culinaria-aprendizado', 'culinaria'),
    ('confeitaria-aprendizado', 'confeitaria'),
    ('panificacao', 'panificacao'),
    ('nutricao-aprendizado', 'nutricao'),
    ('atividade-fisica-aprendizado', 'atividade-fisica'),
    ('saude-mental-aprendizado', 'saude-mental'),
    ('marketing-digital-aprendizado', 'marketing-digital'),
    ('redes-sociais-aprendizado', 'redes-sociais'),
    ('producao-conteudo-aprendizado', 'producao-conteudo'),
    ('escrita-profissional', 'escrita-profissional'),
    ('oratoria', 'oratoria'),
    ('empreender', 'empreendedorismo'),
    ('gestao-aprendizado', 'gestao'),
    ('vendas-aprendizado', 'vendas'),
    ('financas-pessoais', 'financas-pessoais'),
    ('organizacao-produtividade', 'organizacao-produtividade'),
    ('decoracao', 'decoracao'),
    ('jardinagem-aprendizado', 'jardinagem'),
    ('marcenaria-aprendizado', 'marcenaria'),
    ('diy-aprendizado', 'diy'),
    ('manutencao-basica', 'manutencao-basica')
),
resolved AS (
  SELECT m.cat_slug, c.concept_id
  FROM mapping m
  JOIN concepts c
    ON c.slug = m.concept_slug
   AND c.domain = 'educacao-e-conhecimento'
)
UPDATE categories cat
SET concept_id = r.concept_id,
    updated_at = now()
FROM resolved r
WHERE cat.slug = r.cat_slug
  AND cat.scope = 'learning'
  AND cat.level = 1
  AND cat.concept_id IS NULL;

-- GUARDS DE VALIDAÇÃO (fail-closed, dentro da transação — rollback se algo não bater).
DO $$
DECLARE
  v_assoc   INTEGER;
  v_roots   INTEGER;
BEGIN
  -- Cada par do mapping deve ter folha learning level=1 com concept_id apontando ao concept correto.
  WITH mapping(cat_slug, concept_slug) AS (
    VALUES
      ('fotografia-aprendizado', 'fotografia'),
      ('musica-aprendizado', 'musica'),
      ('desenho-ilustracao', 'desenho-ilustracao'),
      ('design-aprendizado', 'design'),
      ('escrita-criativa', 'escrita-criativa'),
      ('video-aprendizado', 'video'),
      ('programacao', 'programacao'),
      ('inteligencia-artificial', 'inteligencia-artificial'),
      ('ferramentas-digitais', 'ferramentas-digitais'),
      ('games-aprendizado', 'games'),
      ('idiomas', 'idiomas'),
      ('ciencias', 'ciencias'),
      ('estudos-gerais', 'estudos-gerais'),
      ('filosofia-aprendizado', 'filosofia'),
      ('historia-aprendizado', 'historia'),
      ('culinaria-aprendizado', 'culinaria'),
      ('confeitaria-aprendizado', 'confeitaria'),
      ('panificacao', 'panificacao'),
      ('nutricao-aprendizado', 'nutricao'),
      ('atividade-fisica-aprendizado', 'atividade-fisica'),
      ('saude-mental-aprendizado', 'saude-mental'),
      ('marketing-digital-aprendizado', 'marketing-digital'),
      ('redes-sociais-aprendizado', 'redes-sociais'),
      ('producao-conteudo-aprendizado', 'producao-conteudo'),
      ('escrita-profissional', 'escrita-profissional'),
      ('oratoria', 'oratoria'),
      ('empreender', 'empreendedorismo'),
      ('gestao-aprendizado', 'gestao'),
      ('vendas-aprendizado', 'vendas'),
      ('financas-pessoais', 'financas-pessoais'),
      ('organizacao-produtividade', 'organizacao-produtividade'),
      ('decoracao', 'decoracao'),
      ('jardinagem-aprendizado', 'jardinagem'),
      ('marcenaria-aprendizado', 'marcenaria'),
      ('diy-aprendizado', 'diy'),
      ('manutencao-basica', 'manutencao-basica')
  )
  SELECT count(*) INTO v_assoc
  FROM mapping m
  JOIN categories cat
    ON cat.slug = m.cat_slug AND cat.scope = 'learning' AND cat.level = 1
  JOIN concepts c
    ON c.concept_id = cat.concept_id
   AND c.slug = m.concept_slug
   AND c.domain = 'educacao-e-conhecimento';

  IF v_assoc <> 36 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: associadas=% (esperado 36) — mapping nao satisfeito', v_assoc;
  END IF;

  -- Raízes/agregadores (level 0) NÃO podem ter recebido concept_id.
  SELECT count(*) INTO v_roots
  FROM categories
  WHERE scope = 'learning' AND level = 0 AND concept_id IS NOT NULL;

  IF v_roots <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % raizes learning com concept_id (esperado 0)', v_roots;
  END IF;
END $$;

COMMIT;

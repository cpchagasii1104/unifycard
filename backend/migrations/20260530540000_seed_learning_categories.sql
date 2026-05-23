-- ============================================================
-- Seed canônico de categorias de APRENDIZADO
-- ============================================================
-- Fonte SSOT: backend/src/scripts/seed-learning-categories.ts
-- Princípio: aprendizado = direção/interesse/processo, NÃO identidade
-- profissional, NÃO serviço comercial. Eixos semanticamente separados.
--
-- Contrato canônico (categories.model.ts):
--   level=0 → path=[]
--   level=1 → path=[root_slug]
--   level=2 → path=[root_slug, l1_slug]
--
-- Idempotente: ON CONFLICT (slug) DO NOTHING — não sobrescreve eventual
-- estado pré-existente para a mesma slug.
--
-- Hierarquia desta seed: 8 raízes (L0) + 30 ramos (L1) = 38 rows.
-- L2 (80 folhas) NÃO incluído nesta seed: constraint defensiva
-- `chk_n2_requires_concept` exige concept_id NOT NULL em level=2.
-- Para incluir L2 é necessário criar domain 'learning' em concepts +
-- ~80 concepts dummy. Frente própria de governance — DT registrada,
-- não aberta nesta sessão.
-- ============================================================

BEGIN;

-- ============================================================
-- LEVEL 0 — 8 grandes áreas de aprendizado
-- ============================================================
INSERT INTO categories (parent_id, name, slug, description, level, path, scope, status, is_active)
VALUES
  (NULL, 'Criatividade e Expressão',         'criatividade-expressao',     'Aprender a criar e se expressar',                0, ARRAY[]::text[], 'learning', 'active', true),
  (NULL, 'Tecnologia e Digital',             'tecnologia-digital',         'Aprender tecnologia e ferramentas digitais',     0, ARRAY[]::text[], 'learning', 'active', true),
  (NULL, 'Comunicação e Conteúdo',           'comunicacao-conteudo',       'Aprender a comunicar e criar conteúdo',          0, ARRAY[]::text[], 'learning', 'active', true),
  (NULL, 'Bem-Estar e Corpo',                'bem-estar-corpo',            'Aprender sobre bem-estar e saúde',               0, ARRAY[]::text[], 'learning', 'active', true),
  (NULL, 'Gastronomia e Sabores',            'gastronomia-sabores',        'Aprender sobre culinária e gastronomia',         0, ARRAY[]::text[], 'learning', 'active', true),
  (NULL, 'Negócios e Empreendedorismo',      'negocios-empreendedorismo',  'Aprender sobre negócios e empreender',           0, ARRAY[]::text[], 'learning', 'active', true),
  (NULL, 'Casa, Manual e Prático',           'casa-manual-pratico',        'Aprender habilidades manuais e práticas',        0, ARRAY[]::text[], 'learning', 'active', true),
  (NULL, 'Educação e Conhecimento Geral',    'educacao-conhecimento',      'Aprender sobre diversos temas',                  0, ARRAY[]::text[], 'learning', 'active', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- LEVEL 1 — 30 ramos sob cada raiz
-- ============================================================
INSERT INTO categories (parent_id, name, slug, description, level, path, scope, status, is_active)
SELECT p.category_id, v.name, v.slug, v.description, 1, ARRAY[p.slug]::text[], 'learning', 'active', true
FROM categories p
CROSS JOIN (VALUES
  -- Criatividade e Expressão
  ('criatividade-expressao', 'Desenho e Ilustração', 'desenho-ilustracao', 'Aprender a desenhar e ilustrar'),
  ('criatividade-expressao', 'Fotografia',           'fotografia-aprendizado', 'Aprender fotografia'),
  ('criatividade-expressao', 'Vídeo',                'video-aprendizado', 'Aprender produção de vídeo'),
  ('criatividade-expressao', 'Escrita Criativa',     'escrita-criativa', 'Aprender a escrever criativamente'),
  ('criatividade-expressao', 'Música',               'musica-aprendizado', 'Aprender música'),
  ('criatividade-expressao', 'Design',               'design-aprendizado', 'Aprender design'),
  -- Tecnologia e Digital
  ('tecnologia-digital', 'Programação',              'programacao', 'Aprender a programar'),
  ('tecnologia-digital', 'Inteligência Artificial',  'inteligencia-artificial', 'Aprender sobre IA'),
  ('tecnologia-digital', 'Ferramentas Digitais',     'ferramentas-digitais', 'Aprender ferramentas digitais'),
  ('tecnologia-digital', 'Games',                    'games-aprendizado', 'Aprender desenvolvimento de jogos'),
  -- Comunicação e Conteúdo
  ('comunicacao-conteudo', 'Produção de Conteúdo',   'producao-conteudo-aprendizado', 'Aprender a produzir conteúdo'),
  ('comunicacao-conteudo', 'Redes Sociais',          'redes-sociais-aprendizado', 'Aprender sobre redes sociais'),
  ('comunicacao-conteudo', 'Escrita Profissional',   'escrita-profissional', 'Aprender escrita profissional'),
  ('comunicacao-conteudo', 'Oratória',               'oratoria', 'Aprender a falar em público'),
  ('comunicacao-conteudo', 'Marketing Digital',      'marketing-digital-aprendizado', 'Aprender marketing digital'),
  -- Bem-Estar e Corpo
  ('bem-estar-corpo', 'Nutrição',                    'nutricao-aprendizado', 'Aprender sobre nutrição'),
  ('bem-estar-corpo', 'Atividade Física',            'atividade-fisica-aprendizado', 'Aprender sobre atividade física'),
  ('bem-estar-corpo', 'Saúde Mental',                'saude-mental-aprendizado', 'Aprender sobre saúde mental'),
  -- Gastronomia e Sabores
  ('gastronomia-sabores', 'Culinária',               'culinaria-aprendizado', 'Aprender a cozinhar'),
  ('gastronomia-sabores', 'Confeitaria',             'confeitaria-aprendizado', 'Aprender confeitaria'),
  ('gastronomia-sabores', 'Panificação',             'panificacao', 'Aprender panificação'),
  -- Negócios e Empreendedorismo
  ('negocios-empreendedorismo', 'Empreender',                  'empreender', 'Aprender a empreender'),
  ('negocios-empreendedorismo', 'Vendas',                      'vendas-aprendizado', 'Aprender sobre vendas'),
  ('negocios-empreendedorismo', 'Gestão',                      'gestao-aprendizado', 'Aprender gestão'),
  ('negocios-empreendedorismo', 'Finanças Pessoais',           'financas-pessoais', 'Aprender sobre finanças'),
  ('negocios-empreendedorismo', 'Organização e Produtividade', 'organizacao-produtividade', 'Aprender organização'),
  -- Casa, Manual e Prático
  ('casa-manual-pratico', 'Marcenaria',         'marcenaria-aprendizado', 'Aprender marcenaria'),
  ('casa-manual-pratico', 'Jardinagem',         'jardinagem-aprendizado', 'Aprender jardinagem'),
  ('casa-manual-pratico', 'DIY',                'diy-aprendizado', 'Aprender faça você mesmo'),
  ('casa-manual-pratico', 'Manutenção Básica',  'manutencao-basica', 'Aprender manutenção'),
  ('casa-manual-pratico', 'Decoração',          'decoracao', 'Aprender decoração'),
  -- Educação e Conhecimento Geral
  ('educacao-conhecimento', 'Idiomas',         'idiomas', 'Aprender idiomas'),
  ('educacao-conhecimento', 'História',        'historia-aprendizado', 'Aprender história'),
  ('educacao-conhecimento', 'Filosofia',       'filosofia-aprendizado', 'Aprender filosofia'),
  ('educacao-conhecimento', 'Ciências',        'ciencias', 'Aprender ciências'),
  ('educacao-conhecimento', 'Estudos Gerais',  'estudos-gerais', 'Estudos diversos')
) AS v(parent_slug, name, slug, description)
WHERE p.slug = v.parent_slug
  AND p.scope = 'learning'
  AND p.level = 0
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- LEVEL 2 — 80 folhas (NÃO incluído — bloqueado por chk_n2_requires_concept)
-- DT-LEARNING-L2-PENDING: requer domain 'learning' em concepts + concepts dummy.
-- Catálogo L2 preservado abaixo como comentário para referência futura.
-- ============================================================
/*
INSERT INTO categories (parent_id, name, slug, description, level, path, scope, status, is_active)
SELECT p.category_id, v.name, v.slug, NULL, 2, p.path || p.slug, 'learning', 'active', true
FROM categories p
CROSS JOIN (VALUES
  -- Criatividade e Expressão > Desenho e Ilustração
  ('desenho-ilustracao', 'Desenho à Mão',      'desenho-mao'),
  ('desenho-ilustracao', 'Ilustração Digital', 'ilustracao-digital'),
  ('desenho-ilustracao', 'Sketching',          'sketching'),
  ('desenho-ilustracao', 'Anatomia Artística', 'anatomia-artistica'),
  -- Criatividade > Fotografia
  ('fotografia-aprendizado', 'Fotografia Básica',     'fotografia-basica'),
  ('fotografia-aprendizado', 'Fotografia de Retrato', 'fotografia-retrato'),
  ('fotografia-aprendizado', 'Fotografia de Paisagem','fotografia-paisagem'),
  ('fotografia-aprendizado', 'Edição de Fotos',       'edicao-fotos'),
  -- Criatividade > Vídeo
  ('video-aprendizado', 'Edição de Vídeo',   'edicao-video-aprendizado'),
  ('video-aprendizado', 'Produção de Vídeo', 'producao-video-aprendizado'),
  ('video-aprendizado', 'Motion Graphics',   'motion-graphics'),
  -- Criatividade > Escrita Criativa
  ('escrita-criativa', 'Narrativa', 'narrativa'),
  ('escrita-criativa', 'Poesia',    'poesia-aprendizado'),
  ('escrita-criativa', 'Roteiro',   'roteiro'),
  -- Criatividade > Música
  ('musica-aprendizado', 'Teoria Musical',    'teoria-musical'),
  ('musica-aprendizado', 'Composição',        'composicao-musical'),
  ('musica-aprendizado', 'Produção Musical',  'producao-musical-aprendizado'),
  -- Criatividade > Design
  ('design-aprendizado', 'Design Gráfico',   'design-grafico-aprendizado'),
  ('design-aprendizado', 'Design de UX/UI',  'design-ux-ui-aprendizado'),
  ('design-aprendizado', 'Design de Produto','design-produto'),
  -- Tecnologia > Programação
  ('programacao', 'Programação Básica',       'programacao-basica'),
  ('programacao', 'Desenvolvimento Web',      'desenvolvimento-web-aprendizado'),
  ('programacao', 'Desenvolvimento Mobile',   'desenvolvimento-mobile-aprendizado'),
  ('programacao', 'Backend',                  'backend-aprendizado'),
  ('programacao', 'Frontend',                 'frontend-aprendizado'),
  -- Tecnologia > IA
  ('inteligencia-artificial', 'Machine Learning',  'machine-learning'),
  ('inteligencia-artificial', 'IA Generativa',     'ia-generativa'),
  ('inteligencia-artificial', 'Análise de Dados',  'analise-dados'),
  -- Tecnologia > Ferramentas Digitais
  ('ferramentas-digitais', 'Excel e Planilhas',    'excel-planilhas'),
  ('ferramentas-digitais', 'Ferramentas de Design','ferramentas-design'),
  ('ferramentas-digitais', 'Automação',            'automacao'),
  -- Tecnologia > Games
  ('games-aprendizado', 'Desenvolvimento de Jogos','desenvolvimento-jogos'),
  ('games-aprendizado', 'Game Design',             'game-design'),
  -- Comunicação > Produção de Conteúdo
  ('producao-conteudo-aprendizado', 'Criação de Conteúdo', 'criacao-conteudo-aprendizado'),
  ('producao-conteudo-aprendizado', 'Storytelling',        'storytelling'),
  ('producao-conteudo-aprendizado', 'Podcast',             'podcast-aprendizado'),
  -- Comunicação > Redes Sociais
  ('redes-sociais-aprendizado', 'Gestão de Redes Sociais', 'gestao-redes-sociais'),
  ('redes-sociais-aprendizado', 'Estratégia de Conteúdo',  'estrategia-conteudo'),
  -- Comunicação > Escrita Profissional
  ('escrita-profissional', 'Redação',     'redacao-aprendizado'),
  ('escrita-profissional', 'Copywriting', 'copywriting'),
  ('escrita-profissional', 'Jornalismo',  'jornalismo-aprendizado'),
  -- Comunicação > Oratória
  ('oratoria', 'Apresentações',       'apresentacoes'),
  ('oratoria', 'Comunicação Verbal',  'comunicacao-verbal'),
  -- Comunicação > Marketing Digital
  ('marketing-digital-aprendizado', 'Marketing de Conteúdo', 'marketing-conteudo'),
  ('marketing-digital-aprendizado', 'SEO',                   'seo'),
  ('marketing-digital-aprendizado', 'Publicidade Online',    'publicidade-online'),
  -- Bem-Estar > Nutrição
  ('nutricao-aprendizado', 'Alimentação Saudável', 'alimentacao-saudavel'),
  ('nutricao-aprendizado', 'Nutrição Esportiva',   'nutricao-esportiva'),
  -- Bem-Estar > Atividade Física
  ('atividade-fisica-aprendizado', 'Treinamento Físico',    'treinamento-fisico'),
  ('atividade-fisica-aprendizado', 'Yoga e Meditação',      'yoga-meditacao-aprendizado'),
  ('atividade-fisica-aprendizado', 'Pilates',               'pilates-aprendizado'),
  -- Bem-Estar > Saúde Mental
  ('saude-mental-aprendizado', 'Autoconhecimento', 'autoconhecimento'),
  ('saude-mental-aprendizado', 'Mindfulness',      'mindfulness-aprendizado'),
  ('saude-mental-aprendizado', 'Terapias',         'terapias-aprendizado'),
  -- Gastronomia > Culinária
  ('culinaria-aprendizado', 'Culinária Básica',          'culinaria-basica'),
  ('culinaria-aprendizado', 'Culinária Internacional',   'culinaria-internacional-aprendizado'),
  ('culinaria-aprendizado', 'Técnicas de Cozinha',       'tecnicas-cozinha'),
  -- Gastronomia > Confeitaria
  ('confeitaria-aprendizado', 'Doces e Sobremesas', 'doces-sobremesas-aprendizado'),
  ('confeitaria-aprendizado', 'Bolos',              'bolos-aprendizado'),
  -- Gastronomia > Panificação
  ('panificacao', 'Pães',   'paes'),
  ('panificacao', 'Massas', 'massas-aprendizado'),
  -- Negócios > Empreender
  ('empreender', 'Criação de Negócios', 'criacao-negocios'),
  ('empreender', 'Modelos de Negócio',  'modelos-negocio'),
  ('empreender', 'Startups',            'startups'),
  -- Negócios > Vendas
  ('vendas-aprendizado', 'Técnicas de Vendas',       'tecnicas-vendas'),
  ('vendas-aprendizado', 'Atendimento ao Cliente',   'atendimento-cliente-aprendizado'),
  -- Negócios > Gestão
  ('gestao-aprendizado', 'Gestão de Projetos', 'gestao-projetos'),
  ('gestao-aprendizado', 'Gestão de Pessoas',  'gestao-pessoas'),
  ('gestao-aprendizado', 'Liderança',          'lideranca'),
  -- Negócios > Finanças
  ('financas-pessoais', 'Investimentos',     'investimentos'),
  ('financas-pessoais', 'Orçamento Pessoal', 'orcamento-pessoal'),
  -- Negócios > Organização e Produtividade
  ('organizacao-produtividade', 'Produtividade',    'produtividade'),
  ('organizacao-produtividade', 'Gestão de Tempo',  'gestao-tempo'),
  -- Casa > Marcenaria
  ('marcenaria-aprendizado', 'Carpintaria', 'carpintaria'),
  ('marcenaria-aprendizado', 'Móveis',      'moveis-aprendizado'),
  -- Casa > Jardinagem
  ('jardinagem-aprendizado', 'Plantio',    'plantio'),
  ('jardinagem-aprendizado', 'Paisagismo', 'paisagismo-aprendizado'),
  -- Casa > DIY
  ('diy-aprendizado', 'Reparos Domésticos', 'reparos-domesticos'),
  ('diy-aprendizado', 'Projetos DIY',       'projetos-diy'),
  -- Casa > Manutenção Básica
  ('manutencao-basica', 'Elétrica Básica',  'eletrica-basica'),
  ('manutencao-basica', 'Hidráulica Básica','hidraulica-basica'),
  -- Casa > Decoração
  ('decoracao', 'Interiores',         'interiores'),
  ('decoracao', 'Arquitetura Básica', 'arquitetura-basica'),
  -- Educação > Idiomas
  ('idiomas', 'Inglês',         'ingles'),
  ('idiomas', 'Espanhol',       'espanhol'),
  ('idiomas', 'Francês',        'frances'),
  ('idiomas', 'Outros Idiomas', 'outros-idiomas'),
  -- Educação > História
  ('historia-aprendizado', 'História do Brasil', 'historia-brasil'),
  ('historia-aprendizado', 'História Mundial',   'historia-mundial'),
  -- Educação > Filosofia
  ('filosofia-aprendizado', 'Filosofia Geral', 'filosofia-geral'),
  ('filosofia-aprendizado', 'Ética',           'etica'),
  -- Educação > Ciências
  ('ciencias', 'Física',   'fisica'),
  ('ciencias', 'Química',  'quimica'),
  ('ciencias', 'Biologia', 'biologia'),
  -- Educação > Estudos Gerais
  ('estudos-gerais', 'Cultura Geral', 'cultura-geral'),
  ('estudos-gerais', 'Atualidades',   'atualidades')
) AS v(parent_slug, name, slug)
WHERE p.slug = v.parent_slug
  AND p.scope = 'learning'
  AND p.level = 1
ON CONFLICT (slug) DO NOTHING;
*/

COMMIT;

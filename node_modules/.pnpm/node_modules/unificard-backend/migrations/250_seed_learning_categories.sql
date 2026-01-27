-- ============================================================
-- UNIFICARD — SEED CANÔNICO DE CATEGORIAS DE APRENDIZADO
-- Migration: 250_seed_learning_categories.sql
-- Scope: learning
-- 
-- OBJETIVO:
-- Criar estrutura canônica de categorias de aprendizado
-- com scope='learning', hierarquia completa (nível 0/1/2)
-- e sem reutilizar categorias de outros contexts
--
-- REGRAS:
-- - Todas as categorias DEVEM ter scope='learning'
-- - status='active' e is_active=true
-- - country_code=NULL (categorias globais) ou 'BR' conforme padrão
-- - Hierarquia explícita: parent_id correto
-- - Idempotente: ON CONFLICT DO NOTHING
--
-- ESTRUTURA CANÔNICA:
-- Nível 0: Raízes (8 grandes áreas)
-- Nível 1: Subcategorias principais
-- Nível 2: Temas específicos de aprendizado
-- ============================================================

BEGIN;

-- ============================================================
-- NÍVEL 0: RAÍZES (Grandes Áreas de Aprendizado)
-- ============================================================

-- 1. Tecnologia e Digital
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
VALUES (
  NULL,
  'Tecnologia e Digital',
  'tecnologia-digital-learning',
  'Aprender tecnologia e ferramentas digitais',
  0,
  ARRAY['tecnologia-digital-learning'],
  ARRAY['tecnologia', 'digital', 'programação', 'computação']::TEXT[],
  'learning',
  'active',
  true,
  NULL
)
ON CONFLICT (slug, country_code) DO NOTHING;

-- 2. Comunicação e Idiomas
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
VALUES (
  NULL,
  'Comunicação e Idiomas',
  'comunicacao-idiomas-learning',
  'Aprender a comunicar e dominar idiomas',
  0,
  ARRAY['comunicacao-idiomas-learning'],
  ARRAY['comunicação', 'idiomas', 'línguas', 'escrita', 'oratória']::TEXT[],
  'learning',
  'active',
  true,
  NULL
)
ON CONFLICT (slug, country_code) DO NOTHING;

-- 3. Criatividade e Expressão
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
VALUES (
  NULL,
  'Criatividade e Expressão',
  'criatividade-expressao-learning',
  'Aprender a criar e se expressar artisticamente',
  0,
  ARRAY['criatividade-expressao-learning'],
  ARRAY['criatividade', 'arte', 'expressão', 'design', 'música']::TEXT[],
  'learning',
  'active',
  true,
  NULL
)
ON CONFLICT (slug, country_code) DO NOTHING;

-- 4. Ciências e Conhecimento
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
VALUES (
  NULL,
  'Ciências e Conhecimento',
  'ciencias-conhecimento-learning',
  'Aprender ciências e conhecimento geral',
  0,
  ARRAY['ciencias-conhecimento-learning'],
  ARRAY['ciências', 'conhecimento', 'física', 'química', 'biologia', 'história']::TEXT[],
  'learning',
  'active',
  true,
  NULL
)
ON CONFLICT (slug, country_code) DO NOTHING;

-- 5. Corpo e Bem-Estar
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
VALUES (
  NULL,
  'Corpo e Bem-Estar',
  'corpo-bem-estar-learning',
  'Aprender sobre saúde física e mental',
  0,
  ARRAY['corpo-bem-estar-learning'],
  ARRAY['saúde', 'bem-estar', 'fitness', 'meditação', 'nutrição']::TEXT[],
  'learning',
  'active',
  true,
  NULL
)
ON CONFLICT (slug, country_code) DO NOTHING;

-- 6. Educação Financeira
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
VALUES (
  NULL,
  'Educação Financeira',
  'educacao-financeira-learning',
  'Aprender sobre finanças pessoais e investimentos',
  0,
  ARRAY['educacao-financeira-learning'],
  ARRAY['finanças', 'investimentos', 'orçamento', 'economia']::TEXT[],
  'learning',
  'active',
  true,
  NULL
)
ON CONFLICT (slug, country_code) DO NOTHING;

-- 7. Desenvolvimento Pessoal
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
VALUES (
  NULL,
  'Desenvolvimento Pessoal',
  'desenvolvimento-pessoal-learning',
  'Aprender sobre crescimento pessoal e autoconhecimento',
  0,
  ARRAY['desenvolvimento-pessoal-learning'],
  ARRAY['desenvolvimento', 'pessoal', 'autoconhecimento', 'liderança', 'produtividade']::TEXT[],
  'learning',
  'active',
  true,
  NULL
)
ON CONFLICT (slug, country_code) DO NOTHING;

-- 8. Cultura e Sociedade
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
VALUES (
  NULL,
  'Cultura e Sociedade',
  'cultura-sociedade-learning',
  'Aprender sobre cultura, história e sociedade',
  0,
  ARRAY['cultura-sociedade-learning'],
  ARRAY['cultura', 'sociedade', 'história', 'filosofia', 'política']::TEXT[],
  'learning',
  'active',
  true,
  NULL
)
ON CONFLICT (slug, country_code) DO NOTHING;

-- ============================================================
-- NÍVEL 1 e 2: SUBCATEGORIAS E TEMAS ESPECÍFICOS
-- ============================================================

-- ===== TECNOLOGIA E DIGITAL =====

-- Programação (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'tecnologia-digital-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Programação',
  'programacao-learning',
  'Aprender a programar',
  1,
  ARRAY['tecnologia-digital-learning', 'programacao-learning'],
  ARRAY['programação', 'código', 'desenvolvimento']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Programação - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'programacao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Lógica de Programação',
  'logica-programacao-learning',
  'Aprender fundamentos de lógica e algoritmos',
  2,
  ARRAY['tecnologia-digital-learning', 'programacao-learning', 'logica-programacao-learning'],
  ARRAY['lógica', 'algoritmos', 'fundamentos']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'programacao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Desenvolvimento Web',
  'desenvolvimento-web-learning',
  'Aprender desenvolvimento web',
  2,
  ARRAY['tecnologia-digital-learning', 'programacao-learning', 'desenvolvimento-web-learning'],
  ARRAY['web', 'frontend', 'backend', 'fullstack']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'programacao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Desenvolvimento Mobile',
  'desenvolvimento-mobile-learning',
  'Aprender desenvolvimento mobile',
  2,
  ARRAY['tecnologia-digital-learning', 'programacao-learning', 'desenvolvimento-mobile-learning'],
  ARRAY['mobile', 'apps', 'android', 'ios']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'programacao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Ciência de Dados',
  'ciencia-dados-learning',
  'Aprender ciência de dados e análise',
  2,
  ARRAY['tecnologia-digital-learning', 'programacao-learning', 'ciencia-dados-learning'],
  ARRAY['dados', 'análise', 'machine learning', 'estatística']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Inteligência Artificial (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'tecnologia-digital-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Inteligência Artificial',
  'inteligencia-artificial-learning',
  'Aprender sobre inteligência artificial',
  1,
  ARRAY['tecnologia-digital-learning', 'inteligencia-artificial-learning'],
  ARRAY['IA', 'inteligência artificial', 'machine learning', 'deep learning']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Segurança da Informação (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'tecnologia-digital-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Segurança da Informação',
  'seguranca-informacao-learning',
  'Aprender sobre segurança digital',
  1,
  ARRAY['tecnologia-digital-learning', 'seguranca-informacao-learning'],
  ARRAY['segurança', 'cybersecurity', 'hacking ético', 'proteção']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- ===== COMUNICAÇÃO E IDIOMAS =====

-- Português (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'comunicacao-idiomas-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Português',
  'portugues-learning',
  'Aprender e melhorar português',
  1,
  ARRAY['comunicacao-idiomas-learning', 'portugues-learning'],
  ARRAY['português', 'gramática', 'ortografia', 'redação']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Inglês (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'comunicacao-idiomas-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Inglês',
  'ingles-learning',
  'Aprender inglês',
  1,
  ARRAY['comunicacao-idiomas-learning', 'ingles-learning'],
  ARRAY['inglês', 'english', 'idioma']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Espanhol (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'comunicacao-idiomas-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Espanhol',
  'espanhol-learning',
  'Aprender espanhol',
  1,
  ARRAY['comunicacao-idiomas-learning', 'espanhol-learning'],
  ARRAY['espanhol', 'spanish', 'idioma']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Escrita e Redação (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'comunicacao-idiomas-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Escrita e Redação',
  'escrita-redacao-learning',
  'Aprender técnicas de escrita',
  1,
  ARRAY['comunicacao-idiomas-learning', 'escrita-redacao-learning'],
  ARRAY['escrita', 'redação', 'texto', 'comunicação escrita']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Comunicação Interpessoal (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'comunicacao-idiomas-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Comunicação Interpessoal',
  'comunicacao-interpessoal-learning',
  'Aprender a se comunicar melhor',
  1,
  ARRAY['comunicacao-idiomas-learning', 'comunicacao-interpessoal-learning'],
  ARRAY['comunicação', 'relacionamento', 'oratória', 'apresentações']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- ===== CRIATIVIDADE E EXPRESSÃO =====

-- Design (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'criatividade-expressao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Design',
  'design-learning',
  'Aprender design',
  1,
  ARRAY['criatividade-expressao-learning', 'design-learning'],
  ARRAY['design', 'gráfico', 'visual', 'criatividade']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Fotografia (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'criatividade-expressao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Fotografia',
  'fotografia-learning',
  'Aprender fotografia',
  1,
  ARRAY['criatividade-expressao-learning', 'fotografia-learning'],
  ARRAY['fotografia', 'fotos', 'imagens', 'câmera']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Audiovisual (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'criatividade-expressao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Audiovisual',
  'audiovisual-learning',
  'Aprender produção audiovisual',
  1,
  ARRAY['criatividade-expressao-learning', 'audiovisual-learning'],
  ARRAY['vídeo', 'audiovisual', 'produção', 'edição']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Música (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'criatividade-expressao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Música',
  'musica-learning',
  'Aprender música',
  1,
  ARRAY['criatividade-expressao-learning', 'musica-learning'],
  ARRAY['música', 'instrumentos', 'composição', 'teoria musical']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Artes Visuais (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'criatividade-expressao-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Artes Visuais',
  'artes-visuais-learning',
  'Aprender artes visuais',
  1,
  ARRAY['criatividade-expressao-learning', 'artes-visuais-learning'],
  ARRAY['arte', 'desenho', 'pintura', 'escultura']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- ===== CIÊNCIAS E CONHECIMENTO =====

-- Física (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'ciencias-conhecimento-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Física',
  'fisica-learning',
  'Aprender física',
  1,
  ARRAY['ciencias-conhecimento-learning', 'fisica-learning'],
  ARRAY['física', 'ciências', 'mecânica', 'termodinâmica']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Química (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'ciencias-conhecimento-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Química',
  'quimica-learning',
  'Aprender química',
  1,
  ARRAY['ciencias-conhecimento-learning', 'quimica-learning'],
  ARRAY['química', 'reações', 'elementos', 'compostos']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Biologia (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'ciencias-conhecimento-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Biologia',
  'biologia-learning',
  'Aprender biologia',
  1,
  ARRAY['ciencias-conhecimento-learning', 'biologia-learning'],
  ARRAY['biologia', 'vida', 'células', 'ecologia']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- História (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'ciencias-conhecimento-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'História',
  'historia-learning',
  'Aprender história',
  1,
  ARRAY['ciencias-conhecimento-learning', 'historia-learning'],
  ARRAY['história', 'passado', 'civilizações', 'eventos']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- ===== CORPO E BEM-ESTAR =====

-- Saúde Física (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'corpo-bem-estar-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Saúde Física',
  'saude-fisica-learning',
  'Aprender sobre saúde física',
  1,
  ARRAY['corpo-bem-estar-learning', 'saude-fisica-learning'],
  ARRAY['saúde', 'física', 'exercício', 'fitness']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Saúde Mental (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'corpo-bem-estar-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Saúde Mental',
  'saude-mental-learning',
  'Aprender sobre saúde mental',
  1,
  ARRAY['corpo-bem-estar-learning', 'saude-mental-learning'],
  ARRAY['saúde mental', 'psicologia', 'bem-estar emocional']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Meditação (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'corpo-bem-estar-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Meditação',
  'meditacao-learning',
  'Aprender meditação',
  1,
  ARRAY['corpo-bem-estar-learning', 'meditacao-learning'],
  ARRAY['meditação', 'mindfulness', 'relaxamento']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Alimentação Consciente (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'corpo-bem-estar-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Alimentação Consciente',
  'alimentacao-consciente-learning',
  'Aprender sobre alimentação saudável',
  1,
  ARRAY['corpo-bem-estar-learning', 'alimentacao-consciente-learning'],
  ARRAY['alimentação', 'nutrição', 'dieta', 'saudável']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Práticas Corporais (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'corpo-bem-estar-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Práticas Corporais',
  'praticas-corporais-learning',
  'Aprender práticas corporais',
  1,
  ARRAY['corpo-bem-estar-learning', 'praticas-corporais-learning'],
  ARRAY['yoga', 'pilates', 'alongamento', 'movimento']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- ===== EDUCAÇÃO FINANCEIRA =====

-- Investimentos (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'educacao-financeira-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Investimentos',
  'investimentos-learning',
  'Aprender sobre investimentos',
  1,
  ARRAY['educacao-financeira-learning', 'investimentos-learning'],
  ARRAY['investimentos', 'ações', 'renda fixa', 'bolsa']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Orçamento Pessoal (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'educacao-financeira-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Orçamento Pessoal',
  'orcamento-pessoal-learning',
  'Aprender a gerenciar orçamento',
  1,
  ARRAY['educacao-financeira-learning', 'orcamento-pessoal-learning'],
  ARRAY['orçamento', 'finanças pessoais', 'planejamento']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- ===== DESENVOLVIMENTO PESSOAL =====

-- Autoconhecimento (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'desenvolvimento-pessoal-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Autoconhecimento',
  'autoconhecimento-learning',
  'Aprender sobre autoconhecimento',
  1,
  ARRAY['desenvolvimento-pessoal-learning', 'autoconhecimento-learning'],
  ARRAY['autoconhecimento', 'introspecção', 'reflexão']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Liderança (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'desenvolvimento-pessoal-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Liderança',
  'lideranca-learning',
  'Aprender sobre liderança',
  1,
  ARRAY['desenvolvimento-pessoal-learning', 'lideranca-learning'],
  ARRAY['liderança', 'gestão de equipes', 'motivação']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Produtividade (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'desenvolvimento-pessoal-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Produtividade',
  'produtividade-learning',
  'Aprender sobre produtividade',
  1,
  ARRAY['desenvolvimento-pessoal-learning', 'produtividade-learning'],
  ARRAY['produtividade', 'organização', 'gestão de tempo']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- ===== CULTURA E SOCIEDADE =====

-- Filosofia (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'cultura-sociedade-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Filosofia',
  'filosofia-learning',
  'Aprender filosofia',
  1,
  ARRAY['cultura-sociedade-learning', 'filosofia-learning'],
  ARRAY['filosofia', 'pensamento', 'ética', 'moral']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Política e Sociedade (Nível 1)
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'cultura-sociedade-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Política e Sociedade',
  'politica-sociedade-learning',
  'Aprender sobre política e sociedade',
  1,
  ARRAY['cultura-sociedade-learning', 'politica-sociedade-learning'],
  ARRAY['política', 'sociedade', 'cidadania', 'democracia']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- ============================================================
-- ADICIONANDO MAIS CATEGORIAS DE NÍVEL 2 PARA COMPLETAR ESTRUTURA
-- ============================================================

-- Design - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'design-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Design Gráfico',
  'design-grafico-learning',
  'Aprender design gráfico',
  2,
  ARRAY['criatividade-expressao-learning', 'design-learning', 'design-grafico-learning'],
  ARRAY['design gráfico', 'visual', 'comunicação visual']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'design-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Design de UX/UI',
  'design-ux-ui-learning',
  'Aprender design de experiência e interface',
  2,
  ARRAY['criatividade-expressao-learning', 'design-learning', 'design-ux-ui-learning'],
  ARRAY['UX', 'UI', 'experiência do usuário', 'interface']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Fotografia - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'fotografia-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Fotografia Básica',
  'fotografia-basica-learning',
  'Aprender fundamentos de fotografia',
  2,
  ARRAY['criatividade-expressao-learning', 'fotografia-learning', 'fotografia-basica-learning'],
  ARRAY['fotografia básica', 'fundamentos', 'técnicas']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'fotografia-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Edição de Fotos',
  'edicao-fotos-learning',
  'Aprender edição de fotos',
  2,
  ARRAY['criatividade-expressao-learning', 'fotografia-learning', 'edicao-fotos-learning'],
  ARRAY['edição', 'photoshop', 'lightroom', 'pós-produção']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Audiovisual - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'audiovisual-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Edição de Vídeo',
  'edicao-video-learning',
  'Aprender edição de vídeo',
  2,
  ARRAY['criatividade-expressao-learning', 'audiovisual-learning', 'edicao-video-learning'],
  ARRAY['edição de vídeo', 'montagem', 'pós-produção']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'audiovisual-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Produção de Vídeo',
  'producao-video-learning',
  'Aprender produção de vídeo',
  2,
  ARRAY['criatividade-expressao-learning', 'audiovisual-learning', 'producao-video-learning'],
  ARRAY['produção', 'filmagem', 'direção']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Música - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'musica-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Teoria Musical',
  'teoria-musical-learning',
  'Aprender teoria musical',
  2,
  ARRAY['criatividade-expressao-learning', 'musica-learning', 'teoria-musical-learning'],
  ARRAY['teoria', 'harmonia', 'notas', 'escalas']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'musica-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Composição Musical',
  'composicao-musical-learning',
  'Aprender composição musical',
  2,
  ARRAY['criatividade-expressao-learning', 'musica-learning', 'composicao-musical-learning'],
  ARRAY['composição', 'criar música', 'arranjo']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Artes Visuais - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'artes-visuais-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Desenho',
  'desenho-learning',
  'Aprender desenho',
  2,
  ARRAY['criatividade-expressao-learning', 'artes-visuais-learning', 'desenho-learning'],
  ARRAY['desenho', 'esboço', 'técnicas']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'artes-visuais-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Pintura',
  'pintura-learning',
  'Aprender pintura',
  2,
  ARRAY['criatividade-expressao-learning', 'artes-visuais-learning', 'pintura-learning'],
  ARRAY['pintura', 'tintas', 'técnicas']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Investimentos - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'investimentos-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Renda Fixa',
  'renda-fixa-learning',
  'Aprender sobre renda fixa',
  2,
  ARRAY['educacao-financeira-learning', 'investimentos-learning', 'renda-fixa-learning'],
  ARRAY['renda fixa', 'CDB', 'tesouro', 'títulos']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'investimentos-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Renda Variável',
  'renda-variavel-learning',
  'Aprender sobre renda variável',
  2,
  ARRAY['educacao-financeira-learning', 'investimentos-learning', 'renda-variavel-learning'],
  ARRAY['renda variável', 'ações', 'bolsa', 'ações']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Orçamento Pessoal - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'orcamento-pessoal-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Planejamento Financeiro',
  'planejamento-financeiro-learning',
  'Aprender planejamento financeiro',
  2,
  ARRAY['educacao-financeira-learning', 'orcamento-pessoal-learning', 'planejamento-financeiro-learning'],
  ARRAY['planejamento', 'finanças', 'organização']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'orcamento-pessoal-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Controle de Gastos',
  'controle-gastos-learning',
  'Aprender a controlar gastos',
  2,
  ARRAY['educacao-financeira-learning', 'orcamento-pessoal-learning', 'controle-gastos-learning'],
  ARRAY['gastos', 'economia', 'controle']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Autoconhecimento - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'autoconhecimento-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Inteligência Emocional',
  'inteligencia-emocional-learning',
  'Aprender sobre inteligência emocional',
  2,
  ARRAY['desenvolvimento-pessoal-learning', 'autoconhecimento-learning', 'inteligencia-emocional-learning'],
  ARRAY['inteligência emocional', 'emoções', 'autocontrole']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'autoconhecimento-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Reflexão e Introspecção',
  'reflexao-introspeccao-learning',
  'Aprender técnicas de reflexão',
  2,
  ARRAY['desenvolvimento-pessoal-learning', 'autoconhecimento-learning', 'reflexao-introspeccao-learning'],
  ARRAY['reflexão', 'introspecção', 'autoconhecimento']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Liderança - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'lideranca-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Gestão de Equipes',
  'gestao-equipes-learning',
  'Aprender gestão de equipes',
  2,
  ARRAY['desenvolvimento-pessoal-learning', 'lideranca-learning', 'gestao-equipes-learning'],
  ARRAY['gestão', 'equipes', 'liderança']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'lideranca-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Tomada de Decisão',
  'tomada-decisao-learning',
  'Aprender tomada de decisão',
  2,
  ARRAY['desenvolvimento-pessoal-learning', 'lideranca-learning', 'tomada-decisao-learning'],
  ARRAY['decisão', 'liderança', 'estratégia']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Produtividade - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'produtividade-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Gestão de Tempo',
  'gestao-tempo-learning',
  'Aprender gestão de tempo',
  2,
  ARRAY['desenvolvimento-pessoal-learning', 'produtividade-learning', 'gestao-tempo-learning'],
  ARRAY['tempo', 'organização', 'produtividade']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'produtividade-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Organização Pessoal',
  'organizacao-pessoal-learning',
  'Aprender organização pessoal',
  2,
  ARRAY['desenvolvimento-pessoal-learning', 'produtividade-learning', 'organizacao-pessoal-learning'],
  ARRAY['organização', 'planejamento', 'métodos']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

-- Filosofia - Nível 2
WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'filosofia-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Filosofia Geral',
  'filosofia-geral-learning',
  'Aprender filosofia geral',
  2,
  ARRAY['cultura-sociedade-learning', 'filosofia-learning', 'filosofia-geral-learning'],
  ARRAY['filosofia', 'pensamento', 'filosofias']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE slug = 'filosofia-learning' AND scope = 'learning' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, status, is_active, country_code)
SELECT 
  parent.category_id,
  'Ética',
  'etica-learning',
  'Aprender sobre ética',
  2,
  ARRAY['cultura-sociedade-learning', 'filosofia-learning', 'etica-learning'],
  ARRAY['ética', 'moral', 'valores']::TEXT[],
  'learning',
  'active',
  true,
  NULL
FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

COMMIT;

-- ============================================================
-- VALIDAÇÃO PÓS-SEED
-- ============================================================
-- Verificar se as categorias foram criadas corretamente:
-- SELECT COUNT(*) FROM categories WHERE scope = 'learning';
-- SELECT name, level, scope FROM categories WHERE scope = 'learning' ORDER BY level, name;
-- ============================================================


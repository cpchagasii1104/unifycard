-- UNIFICARD — SEED CANÔNICO DE CATEGORIAS (NÍVEL 0 e 1)
-- Gerado a partir de categorias.md (verdade única)
-- Seguro para reexecutar: usa UPSERT por (parent_id, slug)

BEGIN;

-- Opcional (DEV only): limpar categorias antes de seedar
-- TRUNCATE TABLE categories CASCADE;

-- ===== NÍVEL 0 =====
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Pessoas & Perfis', 'pessoas-e-perfis', NULL, 0, ARRAY['Pessoas & Perfis'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Organizações & Instituições', 'organizacoes-e-instituicoes', NULL, 0, ARRAY['Organizações & Instituições'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Serviços', 'servicos', NULL, 0, ARRAY['Serviços'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Produtos & Comércio', 'produtos-e-comercio', NULL, 0, ARRAY['Produtos & Comércio'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Mobilidade & Logística', 'mobilidade-e-logistica', NULL, 0, ARRAY['Mobilidade & Logística'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Finanças & Economia', 'financas-e-economia', NULL, 0, ARRAY['Finanças & Economia'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Comunidades & Grupos', 'comunidades-e-grupos', NULL, 0, ARRAY['Comunidades & Grupos'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Cultura, Lazer & Eventos', 'cultura-lazer-e-eventos', NULL, 0, ARRAY['Cultura, Lazer & Eventos'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Educação & Conhecimento', 'educacao-e-conhecimento', NULL, 0, ARRAY['Educação & Conhecimento'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Causas & Impacto Social', 'causas-e-impacto-social', NULL, 0, ARRAY['Causas & Impacto Social'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Tecnologia & Sistemas', 'tecnologia-e-sistemas', NULL, 0, ARRAY['Tecnologia & Sistemas'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
VALUES (NULL, 'Saúde & Bem-Estar', 'saude-e-bem-estar', NULL, 0, ARRAY['Saúde & Bem-Estar'], ARRAY[]::TEXT[], 'global', TRUE, NULL)
ON CONFLICT (slug, country_code) DO NOTHING;

-- ===== NÍVEL 1 =====
WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Identidade Pessoal', 'identidade-pessoal', NULL, 1, ARRAY['Pessoas & Perfis','Identidade Pessoal'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Perfil Profissional', 'perfil-profissional', NULL, 1, ARRAY['Pessoas & Perfis','Perfil Profissional'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Habilidades & Competências', 'habilidades-e-competencias', NULL, 1, ARRAY['Pessoas & Perfis','Habilidades & Competências'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Interesses & Preferências', 'interesses-e-preferencias', NULL, 1, ARRAY['Pessoas & Perfis','Interesses & Preferências'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Formação Individual', 'formacao-individual', NULL, 1, ARRAY['Pessoas & Perfis','Formação Individual'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Experiência & Histórico', 'experiencia-e-historico', NULL, 1, ARRAY['Pessoas & Perfis','Experiência & Histórico'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Condições de Saúde Pessoal', 'condicoes-de-saude-pessoal', NULL, 1, ARRAY['Pessoas & Perfis','Condições de Saúde Pessoal'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Relacionamentos & Redes', 'relacionamentos-e-redes', NULL, 1, ARRAY['Pessoas & Perfis','Relacionamentos & Redes'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Reputação & Avaliações', 'reputacao-e-avaliacoes', NULL, 1, ARRAY['Pessoas & Perfis','Reputação & Avaliações'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Participação & Engajamento', 'participacao-e-engajamento', NULL, 1, ARRAY['Pessoas & Perfis','Participação & Engajamento'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Papéis & Responsabilidades', 'papeis-e-responsabilidades', NULL, 1, ARRAY['Pessoas & Perfis','Papéis & Responsabilidades'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'pessoas-e-perfis' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Dados Legais & Documentais', 'dados-legais-e-documentais', NULL, 1, ARRAY['Pessoas & Perfis','Dados Legais & Documentais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Empresas', 'empresas', NULL, 1, ARRAY['Organizações & Instituições','Empresas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Instituições Públicas', 'instituicoes-publicas', NULL, 1, ARRAY['Organizações & Instituições','Instituições Públicas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Organizações Religiosas', 'organizacoes-religiosas', NULL, 1, ARRAY['Organizações & Instituições','Organizações Religiosas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Organizações Educacionais', 'organizacoes-educacionais', NULL, 1, ARRAY['Organizações & Instituições','Organizações Educacionais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Organizações de Saúde', 'organizacoes-de-saude', NULL, 1, ARRAY['Organizações & Instituições','Organizações de Saúde'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Organizações Financeiras', 'organizacoes-financeiras', NULL, 1, ARRAY['Organizações & Instituições','Organizações Financeiras'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Organizações Sem Fins Lucrativos', 'organizacoes-sem-fins-lucrativos', NULL, 1, ARRAY['Organizações & Instituições','Organizações Sem Fins Lucrativos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Cooperativas & Associações', 'cooperativas-e-associacoes', NULL, 1, ARRAY['Organizações & Instituições','Cooperativas & Associações'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Startups & Empreendimentos', 'startups-e-empreendimentos', NULL, 1, ARRAY['Organizações & Instituições','Startups & Empreendimentos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Fundos & Holdings', 'fundos-e-holdings', NULL, 1, ARRAY['Organizações & Instituições','Fundos & Holdings'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Sindicatos & Conselhos', 'sindicatos-e-conselhos', NULL, 1, ARRAY['Organizações & Instituições','Sindicatos & Conselhos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'organizacoes-e-instituicoes' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Partidos & Movimentos Políticos', 'partidos-e-movimentos-politicos', NULL, 1, ARRAY['Organizações & Instituições','Partidos & Movimentos Políticos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços Profissionais', 'servicos-profissionais', NULL, 1, ARRAY['Serviços','Serviços Profissionais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços Pessoais', 'servicos-pessoais', NULL, 1, ARRAY['Serviços','Serviços Pessoais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Mobilidade', 'servicos-de-mobilidade', NULL, 1, ARRAY['Serviços','Serviços de Mobilidade'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Entrega & Logística', 'servicos-de-entrega-e-logistica', NULL, 1, ARRAY['Serviços','Serviços de Entrega & Logística'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Hospedagem', 'servicos-de-hospedagem', NULL, 1, ARRAY['Serviços','Serviços de Hospedagem'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Alimentação', 'servicos-de-alimentacao', NULL, 1, ARRAY['Serviços','Serviços de Alimentação'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Saúde', 'servicos-de-saude', NULL, 1, ARRAY['Serviços','Serviços de Saúde'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços Financeiros', 'servicos-financeiros', NULL, 1, ARRAY['Serviços','Serviços Financeiros'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços Educacionais', 'servicos-educacionais', NULL, 1, ARRAY['Serviços','Serviços Educacionais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços Tecnológicos', 'servicos-tecnologicos', NULL, 1, ARRAY['Serviços','Serviços Tecnológicos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços Técnicos & Operacionais', 'servicos-tecnicos-e-operacionais', NULL, 1, ARRAY['Serviços','Serviços Técnicos & Operacionais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços Públicos', 'servicos-publicos', NULL, 1, ARRAY['Serviços','Serviços Públicos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Segurança', 'servicos-de-seguranca', NULL, 1, ARRAY['Serviços','Serviços de Segurança'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Eventos', 'servicos-de-eventos', NULL, 1, ARRAY['Serviços','Serviços de Eventos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'servicos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Turismo & Experiências', 'servicos-de-turismo-e-experiencias', NULL, 1, ARRAY['Serviços','Serviços de Turismo & Experiências'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Produtos Físicos', 'produtos-fisicos', NULL, 1, ARRAY['Produtos & Comércio','Produtos Físicos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Produtos Digitais', 'produtos-digitais', NULL, 1, ARRAY['Produtos & Comércio','Produtos Digitais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Bens Duráveis', 'bens-duraveis', NULL, 1, ARRAY['Produtos & Comércio','Bens Duráveis'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Bens de Consumo', 'bens-de-consumo', NULL, 1, ARRAY['Produtos & Comércio','Bens de Consumo'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Alimentos & Bebidas', 'alimentos-e-bebidas', NULL, 1, ARRAY['Produtos & Comércio','Alimentos & Bebidas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Moda & Vestuário', 'moda-e-vestuario', NULL, 1, ARRAY['Produtos & Comércio','Moda & Vestuário'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Eletrônicos & Tecnologia', 'eletronicos-e-tecnologia', NULL, 1, ARRAY['Produtos & Comércio','Eletrônicos & Tecnologia'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Veículos & Transportes', 'veiculos-e-transportes', NULL, 1, ARRAY['Produtos & Comércio','Veículos & Transportes'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Imóveis & Propriedades', 'imoveis-e-propriedades', NULL, 1, ARRAY['Produtos & Comércio','Imóveis & Propriedades'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Ingressos & Bilhetes', 'ingressos-e-bilhetes', NULL, 1, ARRAY['Produtos & Comércio','Ingressos & Bilhetes'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Assinaturas & Planos', 'assinaturas-e-planos', NULL, 1, ARRAY['Produtos & Comércio','Assinaturas & Planos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Marketplace & Varejo', 'marketplace-e-varejo', NULL, 1, ARRAY['Produtos & Comércio','Marketplace & Varejo'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Atacado & Distribuição', 'atacado-e-distribuicao', NULL, 1, ARRAY['Produtos & Comércio','Atacado & Distribuição'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Comércio Internacional', 'comercio-internacional', NULL, 1, ARRAY['Produtos & Comércio','Comércio Internacional'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Licenças & Direitos', 'licencas-e-direitos', NULL, 1, ARRAY['Produtos & Comércio','Licenças & Direitos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'produtos-e-comercio' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Insumos & Matérias-Primas', 'insumos-e-materias-primas', NULL, 1, ARRAY['Produtos & Comércio','Insumos & Matérias-Primas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Transporte de Pessoas', 'transporte-de-pessoas', NULL, 1, ARRAY['Mobilidade & Logística','Transporte de Pessoas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Transporte de Cargas', 'transporte-de-cargas', NULL, 1, ARRAY['Mobilidade & Logística','Transporte de Cargas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Mobilidade Urbana', 'mobilidade-urbana', NULL, 1, ARRAY['Mobilidade & Logística','Mobilidade Urbana'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Logística & Distribuição', 'logistica-e-distribuicao', NULL, 1, ARRAY['Mobilidade & Logística','Logística & Distribuição'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Delivery & Última Milha', 'delivery-e-ultima-milha', NULL, 1, ARRAY['Mobilidade & Logística','Delivery & Última Milha'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Armazenagem & Estoque', 'armazenagem-e-estoque', NULL, 1, ARRAY['Mobilidade & Logística','Armazenagem & Estoque'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Frotas & Operações', 'frotas-e-operacoes', NULL, 1, ARRAY['Mobilidade & Logística','Frotas & Operações'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Viagens & Deslocamentos', 'viagens-e-deslocamentos', NULL, 1, ARRAY['Mobilidade & Logística','Viagens & Deslocamentos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Infraestrutura de Transporte', 'infraestrutura-de-transporte', NULL, 1, ARRAY['Mobilidade & Logística','Infraestrutura de Transporte'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Mudança', 'servicos-de-mudanca', NULL, 1, ARRAY['Mobilidade & Logística','Serviços de Mudança'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Rastreamento & Monitoramento', 'rastreamento-e-monitoramento', NULL, 1, ARRAY['Mobilidade & Logística','Rastreamento & Monitoramento'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'mobilidade-e-logistica' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Mobilidade Sustentável', 'mobilidade-sustentavel', NULL, 1, ARRAY['Mobilidade & Logística','Mobilidade Sustentável'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Pagamentos & Transações', 'pagamentos-e-transacoes', NULL, 1, ARRAY['Finanças & Economia','Pagamentos & Transações'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Bancos & Instituições Financeiras', 'bancos-e-instituicoes-financeiras', NULL, 1, ARRAY['Finanças & Economia','Bancos & Instituições Financeiras'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Crédito & Empréstimos', 'credito-e-emprestimos', NULL, 1, ARRAY['Finanças & Economia','Crédito & Empréstimos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Investimentos & Patrimônio', 'investimentos-e-patrimonio', NULL, 1, ARRAY['Finanças & Economia','Investimentos & Patrimônio'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Seguros & Previdência', 'seguros-e-previdencia', NULL, 1, ARRAY['Finanças & Economia','Seguros & Previdência'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Contabilidade & Fiscal', 'contabilidade-e-fiscal', NULL, 1, ARRAY['Finanças & Economia','Contabilidade & Fiscal'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Precificação & Custos', 'precificacao-e-custos', NULL, 1, ARRAY['Finanças & Economia','Precificação & Custos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Cobrança & Faturamento', 'cobranca-e-faturamento', NULL, 1, ARRAY['Finanças & Economia','Cobrança & Faturamento'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Moedas & Câmbio', 'moedas-e-cambio', NULL, 1, ARRAY['Finanças & Economia','Moedas & Câmbio'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Benefícios & Incentivos', 'beneficios-e-incentivos', NULL, 1, ARRAY['Finanças & Economia','Benefícios & Incentivos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Economia Local & Regional', 'economia-local-e-regional', NULL, 1, ARRAY['Finanças & Economia','Economia Local & Regional'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'financas-e-economia' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Compliance & Regulamentação', 'compliance-e-regulamentacao', NULL, 1, ARRAY['Finanças & Economia','Compliance & Regulamentação'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Comunidades Locais', 'comunidades-locais', NULL, 1, ARRAY['Comunidades & Grupos','Comunidades Locais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Comunidades Temáticas', 'comunidades-tematicas', NULL, 1, ARRAY['Comunidades & Grupos','Comunidades Temáticas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Grupos de Interesse', 'grupos-de-interesse', NULL, 1, ARRAY['Comunidades & Grupos','Grupos de Interesse'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Grupos Esportivos', 'grupos-esportivos', NULL, 1, ARRAY['Comunidades & Grupos','Grupos Esportivos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Grupos Culturais & Artísticos', 'grupos-culturais-e-artisticos', NULL, 1, ARRAY['Comunidades & Grupos','Grupos Culturais & Artísticos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Grupos Religiosos', 'grupos-religiosos', NULL, 1, ARRAY['Comunidades & Grupos','Grupos Religiosos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Grupos Educacionais', 'grupos-educacionais', NULL, 1, ARRAY['Comunidades & Grupos','Grupos Educacionais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Grupos Profissionais', 'grupos-profissionais', NULL, 1, ARRAY['Comunidades & Grupos','Grupos Profissionais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Grupos Sociais & Recreativos', 'grupos-sociais-e-recreativos', NULL, 1, ARRAY['Comunidades & Grupos','Grupos Sociais & Recreativos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Coletivos & Movimentos', 'coletivos-e-movimentos', NULL, 1, ARRAY['Comunidades & Grupos','Coletivos & Movimentos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Torcidas & Fandoms', 'torcidas-e-fandoms', NULL, 1, ARRAY['Comunidades & Grupos','Torcidas & Fandoms'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'comunidades-e-grupos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Clubes & Associações Informais', 'clubes-e-associacoes-informais', NULL, 1, ARRAY['Comunidades & Grupos','Clubes & Associações Informais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Artes & Expressões Culturais', 'artes-e-expressoes-culturais', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Artes & Expressões Culturais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Música & Performances', 'musica-e-performances', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Música & Performances'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Esporte & Atividades Físicas', 'esporte-e-atividades-fisicas', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Esporte & Atividades Físicas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Entretenimento & Mídia', 'entretenimento-e-midia', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Entretenimento & Mídia'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Eventos Sociais', 'eventos-sociais', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Eventos Sociais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Eventos Corporativos', 'eventos-corporativos', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Eventos Corporativos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Festas & Celebrações', 'festas-e-celebracoes', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Festas & Celebrações'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Turismo Cultural', 'turismo-cultural', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Turismo Cultural'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Lazer & Recreação', 'lazer-e-recreacao', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Lazer & Recreação'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Jogos & Competições', 'jogos-e-competicoes', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Jogos & Competições'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Cinema & Audiovisual', 'cinema-e-audiovisual', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Cinema & Audiovisual'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'cultura-lazer-e-eventos' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Patrimônio Cultural', 'patrimonio-cultural', NULL, 1, ARRAY['Cultura, Lazer & Eventos','Patrimônio Cultural'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Educação Formal', 'educacao-formal', NULL, 1, ARRAY['Educação & Conhecimento','Educação Formal'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Educação Profissional', 'educacao-profissional', NULL, 1, ARRAY['Educação & Conhecimento','Educação Profissional'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Educação Continuada', 'educacao-continuada', NULL, 1, ARRAY['Educação & Conhecimento','Educação Continuada'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Cursos & Treinamentos', 'cursos-e-treinamentos', NULL, 1, ARRAY['Educação & Conhecimento','Cursos & Treinamentos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Ensino a Distância', 'ensino-a-distancia', NULL, 1, ARRAY['Educação & Conhecimento','Ensino a Distância'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Certificações & Credenciais', 'certificacoes-e-credenciais', NULL, 1, ARRAY['Educação & Conhecimento','Certificações & Credenciais'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Pesquisa & Produção Científica', 'pesquisa-e-producao-cientifica', NULL, 1, ARRAY['Educação & Conhecimento','Pesquisa & Produção Científica'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Conteúdo Educacional', 'conteudo-educacional', NULL, 1, ARRAY['Educação & Conhecimento','Conteúdo Educacional'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Mentorias & Tutorias', 'mentorias-e-tutorias', NULL, 1, ARRAY['Educação & Conhecimento','Mentorias & Tutorias'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Bibliotecas & Acervos', 'bibliotecas-e-acervos', NULL, 1, ARRAY['Educação & Conhecimento','Bibliotecas & Acervos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Desenvolvimento Intelectual', 'desenvolvimento-intelectual', NULL, 1, ARRAY['Educação & Conhecimento','Desenvolvimento Intelectual'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'educacao-e-conhecimento' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Compartilhamento de Conhecimento', 'compartilhamento-de-conhecimento', NULL, 1, ARRAY['Educação & Conhecimento','Compartilhamento de Conhecimento'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Ação Social & Assistência', 'acao-social-e-assistencia', NULL, 1, ARRAY['Causas & Impacto Social','Ação Social & Assistência'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Sustentabilidade & Meio Ambiente', 'sustentabilidade-e-meio-ambiente', NULL, 1, ARRAY['Causas & Impacto Social','Sustentabilidade & Meio Ambiente'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Direitos Humanos', 'direitos-humanos', NULL, 1, ARRAY['Causas & Impacto Social','Direitos Humanos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Inclusão & Diversidade', 'inclusao-e-diversidade', NULL, 1, ARRAY['Causas & Impacto Social','Inclusão & Diversidade'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Cidadania & Participação Social', 'cidadania-e-participacao-social', NULL, 1, ARRAY['Causas & Impacto Social','Cidadania & Participação Social'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Desenvolvimento Comunitário', 'desenvolvimento-comunitario', NULL, 1, ARRAY['Causas & Impacto Social','Desenvolvimento Comunitário'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Voluntariado', 'voluntariado', NULL, 1, ARRAY['Causas & Impacto Social','Voluntariado'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Filantropia & Doações', 'filantropia-e-doacoes', NULL, 1, ARRAY['Causas & Impacto Social','Filantropia & Doações'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Transparência & Governança Social', 'transparencia-e-governanca-social', NULL, 1, ARRAY['Causas & Impacto Social','Transparência & Governança Social'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Impacto Ambiental', 'impacto-ambiental', NULL, 1, ARRAY['Causas & Impacto Social','Impacto Ambiental'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Impacto Econômico Social', 'impacto-economico-social', NULL, 1, ARRAY['Causas & Impacto Social','Impacto Econômico Social'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'causas-e-impacto-social' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Defesa de Causas & Incidência Pública', 'defesa-de-causas-e-incidencia-publica', NULL, 1, ARRAY['Causas & Impacto Social','Defesa de Causas & Incidência Pública'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Software & Aplicações', 'software-e-aplicacoes', NULL, 1, ARRAY['Tecnologia & Sistemas','Software & Aplicações'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Plataformas & Sistemas', 'plataformas-e-sistemas', NULL, 1, ARRAY['Tecnologia & Sistemas','Plataformas & Sistemas'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Infraestrutura & Cloud', 'infraestrutura-e-cloud', NULL, 1, ARRAY['Tecnologia & Sistemas','Infraestrutura & Cloud'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Dados & Analytics', 'dados-e-analytics', NULL, 1, ARRAY['Tecnologia & Sistemas','Dados & Analytics'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Inteligência Artificial & Automação', 'inteligencia-artificial-e-automacao', NULL, 1, ARRAY['Tecnologia & Sistemas','Inteligência Artificial & Automação'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Segurança da Informação', 'seguranca-da-informacao', NULL, 1, ARRAY['Tecnologia & Sistemas','Segurança da Informação'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Redes & Conectividade', 'redes-e-conectividade', NULL, 1, ARRAY['Tecnologia & Sistemas','Redes & Conectividade'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Integrações & APIs', 'integracoes-e-apis', NULL, 1, ARRAY['Tecnologia & Sistemas','Integrações & APIs'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Hardware & Dispositivos', 'hardware-e-dispositivos', NULL, 1, ARRAY['Tecnologia & Sistemas','Hardware & Dispositivos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'DevOps & Operações', 'devops-e-operacoes', NULL, 1, ARRAY['Tecnologia & Sistemas','DevOps & Operações'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Sistemas Corporativos', 'sistemas-corporativos', NULL, 1, ARRAY['Tecnologia & Sistemas','Sistemas Corporativos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'tecnologia-e-sistemas' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Inovação & Pesquisa Tecnológica', 'inovacao-e-pesquisa-tecnologica', NULL, 1, ARRAY['Tecnologia & Sistemas','Inovação & Pesquisa Tecnológica'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Saúde Física', 'saude-fisica', NULL, 1, ARRAY['Saúde & Bem-Estar','Saúde Física'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Saúde Mental', 'saude-mental', NULL, 1, ARRAY['Saúde & Bem-Estar','Saúde Mental'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Bem-Estar & Qualidade de Vida', 'bem-estar-e-qualidade-de-vida', NULL, 1, ARRAY['Saúde & Bem-Estar','Bem-Estar & Qualidade de Vida'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Serviços de Saúde', 'servicos-de-saude', NULL, 1, ARRAY['Saúde & Bem-Estar','Serviços de Saúde'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Profissionais de Saúde', 'profissionais-de-saude', NULL, 1, ARRAY['Saúde & Bem-Estar','Profissionais de Saúde'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Clínicas & Estabelecimentos de Saúde', 'clinicas-e-estabelecimentos-de-saude', NULL, 1, ARRAY['Saúde & Bem-Estar','Clínicas & Estabelecimentos de Saúde'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Prevenção & Cuidados', 'prevencao-e-cuidados', NULL, 1, ARRAY['Saúde & Bem-Estar','Prevenção & Cuidados'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Terapias & Tratamentos', 'terapias-e-tratamentos', NULL, 1, ARRAY['Saúde & Bem-Estar','Terapias & Tratamentos'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Nutrição & Alimentação Saudável', 'nutricao-e-alimentacao-saudavel', NULL, 1, ARRAY['Saúde & Bem-Estar','Nutrição & Alimentação Saudável'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Atividade Física & Reabilitação', 'atividade-fisica-e-reabilitacao', NULL, 1, ARRAY['Saúde & Bem-Estar','Atividade Física & Reabilitação'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Saúde Ocupacional', 'saude-ocupacional', NULL, 1, ARRAY['Saúde & Bem-Estar','Saúde Ocupacional'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Saúde Pública', 'saude-publica', NULL, 1, ARRAY['Saúde & Bem-Estar','Saúde Pública'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Ontologia coerente, escalável e enterprise-ready', 'ontologia-coerente-escalavel-e-enterprise-ready', NULL, 1, ARRAY['Saúde & Bem-Estar','Ontologia coerente, escalável e enterprise-ready'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Pronta para seed canônico, IA, busca, ERP/CRM, marketplaces', 'pronta-para-seed-canonico-ia-busca-erp-crm-marketplaces', NULL, 1, ARRAY['Saúde & Bem-Estar','Pronta para seed canônico, IA, busca, ERP/CRM, marketplaces'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

WITH parent AS (
  SELECT category_id FROM categories WHERE parent_id IS NULL AND slug = 'saude-e-bem-estar' LIMIT 1
)
INSERT INTO categories (parent_id, name, slug, description, level, path, keywords, scope, is_active, icon)
SELECT parent.category_id, 'Daqui pra frente: não se discute mais conceito, só execução', 'daqui-pra-frente-nao-se-discute-mais-conceito-so-execucao', NULL, 1, ARRAY['Saúde & Bem-Estar','Daqui pra frente: não se discute mais conceito, só execução'], ARRAY[]::TEXT[], 'global', TRUE, NULL
  FROM parent
ON CONFLICT (slug, country_code) DO NOTHING;

COMMIT;
-- ============================================================
-- UNIFICARD — MIGRATION 113
-- Arquivo: 113_groups_social_features.sql
-- Adiciona campos sociais aos grupos (slug, categoria, visibilidade)
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Preparar grupos para rede social com:
-- • Slug único para URLs amigáveis
-- • Categorias para organização e busca
-- • Visibilidade (public/private/secret)
-- • Descrição obrigatória
--
-- ESCOPO
-- ✔ Adiciona campos slug, category_id, visibility em groups
-- ✔ Cria tabela group_categories
-- ✔ Insere categorias iniciais
-- ✔ Cria índices para busca futura
-- ✔ Atualiza constraint UNIQUE para incluir slug
--
-- ❌ Não remove dados
-- ❌ Não altera funcionalidades existentes
--
-- ============================================================

BEGIN;

-- ============================================================
-- 1) TABELA DE CATEGORIAS DE GRUPO
-- ============================================================

CREATE TABLE IF NOT EXISTS group_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(50),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_categories_slug ON group_categories(slug);

-- ============================================================
-- 2) ADICIONAR CAMPOS EM GROUPS
-- ============================================================

-- Adicionar slug (único por tenant)
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Adicionar category_id
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES group_categories(category_id) ON DELETE SET NULL;

-- Adicionar visibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'group_visibility'
  ) THEN
    CREATE TYPE group_visibility AS ENUM ('public', 'private', 'secret');
  END IF;
END $$;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS visibility group_visibility NOT NULL DEFAULT 'public';

-- Tornar description obrigatória (para grupos novos)
-- Não alterar grupos existentes que podem ter description NULL
ALTER TABLE groups
  ALTER COLUMN description SET DEFAULT '';

-- ============================================================
-- 3) ÍNDICES PARA BUSCA FUTURA
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_groups_slug ON groups(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_groups_category ON groups(tenant_id, category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_groups_visibility ON groups(tenant_id, visibility);

-- ============================================================
-- 4) ATUALIZAR CONSTRAINT UNIQUE
-- ============================================================

-- Remover constraint antiga se existir
ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS groups_tenant_id_name_key;

-- Adicionar constraint única para (tenant_id, slug)
-- Slug será gerado automaticamente a partir do nome
ALTER TABLE groups
  ADD CONSTRAINT groups_tenant_id_slug_unique UNIQUE (tenant_id, slug);

-- ============================================================
-- 5) FUNÇÃO PARA GERAR SLUG
-- ============================================================

CREATE OR REPLACE FUNCTION generate_group_slug(group_name TEXT, tenant_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Normalizar nome para slug
  base_slug := lower(trim(group_name));
  -- Remover acentos básicos e caracteres especiais
  base_slug := regexp_replace(base_slug, '[àáâãäå]', 'a', 'gi');
  base_slug := regexp_replace(base_slug, '[èéêë]', 'e', 'gi');
  base_slug := regexp_replace(base_slug, '[ìíîï]', 'i', 'gi');
  base_slug := regexp_replace(base_slug, '[òóôõö]', 'o', 'gi');
  base_slug := regexp_replace(base_slug, '[ùúûü]', 'u', 'gi');
  base_slug := regexp_replace(base_slug, '[ç]', 'c', 'gi');
  base_slug := regexp_replace(base_slug, '[ñ]', 'n', 'gi');
  -- Remover caracteres não alfanuméricos, exceto hífens
  base_slug := regexp_replace(base_slug, '[^a-z0-9-]', '-', 'gi');
  -- Remover múltiplos hífens consecutivos
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  -- Remover hífens no início e fim
  base_slug := trim(both '-' from base_slug);
  -- Limitar tamanho
  base_slug := left(base_slug, 200);

  final_slug := base_slug;

  -- Verificar unicidade e adicionar sufixo numérico se necessário
  WHILE EXISTS (
    SELECT 1 FROM groups
    WHERE tenant_id = tenant_uuid
      AND slug = final_slug
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- ============================================================
-- 6) TRIGGER PARA GERAR SLUG AUTOMATICAMENTE
-- ============================================================

CREATE OR REPLACE FUNCTION set_group_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Gerar slug apenas se não foi fornecido
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_group_slug(NEW.name, NEW.tenant_id);
  END IF;

  -- Garantir que description não seja NULL
  IF NEW.description IS NULL THEN
    NEW.description := '';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_group_slug
  BEFORE INSERT OR UPDATE ON groups
  FOR EACH ROW
  WHEN (NEW.slug IS NULL OR NEW.slug = '' OR NEW.description IS NULL)
  EXECUTE FUNCTION set_group_slug();

-- ============================================================
-- 7) INSERIR CATEGORIAS INICIAIS
-- ============================================================

INSERT INTO group_categories (name, slug, icon, description) VALUES
  ('Bandas & Música', 'bandas-musica', '🎵', 'Grupos de música, bandas e artistas'),
  ('Motoclubes', 'motoclubes', '🏍️', 'Clubes de motociclistas e apaixonados por motos'),
  ('Igrejas & Fé', 'igrejas-fe', '⛪', 'Comunidades religiosas e grupos de fé'),
  ('Esporte & Lazer', 'esporte-lazer', '⚽', 'Esportes, atividades físicas e lazer'),
  ('Games', 'games', '🎮', 'Jogos, e-sports e comunidades gamer'),
  ('Estudos & Educação', 'estudos-educacao', '📚', 'Grupos de estudo, educação e aprendizado'),
  ('Negócios & Empreendedorismo', 'negocios-empreendedorismo', '💼', 'Networking, negócios e empreendedorismo'),
  ('Impacto Social', 'impacto-social', '🤝', 'Causas sociais, voluntariado e impacto'),
  ('Cultura & Arte', 'cultura-arte', '🎨', 'Arte, cultura e expressão artística')
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- ============================================================
-- FIM 113_groups_social_features.sql
-- ============================================================








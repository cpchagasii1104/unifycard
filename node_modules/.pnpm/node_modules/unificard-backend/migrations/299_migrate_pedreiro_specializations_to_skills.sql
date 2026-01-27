-- ============================================================
-- UNIFICARD - MIGRATION 299
-- Arquivo: 299_migrate_pedreiro_specializations_to_skills.sql
-- Tipo: MIGRAÇÃO DE DADOS (OPÇÃO A2)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Aplicar OPÇÃO A2: tornar "pedreiro" uma categoria LEAF
-- e migrar suas especializações para SKILLS.
--
-- REGRA INSTITUCIONAL:
-- - Profissões são categorias LEAF
-- - Autocomplete profissional retorna APENAS categorias LEAF
-- - Especializações NÃO podem existir como categorias filhas
-- - Especializações devem ser migradas para SKILLS
--
-- OBJETIVO
-- 1. Criar tabelas professional_skills e profession_skill_map se não existirem
-- 2. Buscar categoria "pedreiro" pelo slug
-- 3. Listar todas as categorias filhas de "pedreiro"
-- 4. Migrar cada categoria filha para professional_skills (slug + name)
-- 5. Vincular essas skills à profissão "pedreiro" via profession_skill_map
-- 6. Remover as categorias filhas da tabela categories
-- 7. Garantir que "pedreiro" fique sem filhos (LEAF)
--
-- RESTRIÇÕES ABSOLUTAS
-- - NÃO alterar código do autocomplete
-- - NÃO alterar leafCondition
-- - NÃO criar exceções
-- - NÃO mudar regras de scope, status ou level
-- - NÃO criar flags como is_profession ou is_selectable
-- - NÃO alterar serviços ou repositories
--
-- IDEMPOTÊNCIA
-- - Verifica se migration já foi executada antes de processar
-- - Usa IF NOT EXISTS para criar tabelas
-- ============================================================

BEGIN;

-- ============================================================
-- VERIFICAR SE MIGRATION JÁ FOI EXECUTADA
-- ============================================================

DO $$
DECLARE
  migration_executed BOOLEAN;
BEGIN
  -- Verificar se já existe registro desta migration
  SELECT EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE filename = '299_migrate_pedreiro_specializations_to_skills.sql'
  ) INTO migration_executed;

  -- Se já foi executada, apenas registrar e sair
  IF migration_executed THEN
    RAISE NOTICE 'Migration 299 já foi executada anteriormente. Pulando execução.';
    RETURN;
  END IF;
END $$;

-- ============================================================
-- CRIAR TABELA professional_skills (se não existir)
-- ============================================================

CREATE TABLE IF NOT EXISTS professional_skills (
  skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_professional_skills_slug ON professional_skills(slug);
CREATE INDEX IF NOT EXISTS idx_professional_skills_name ON professional_skills(name);

-- Comentários
COMMENT ON TABLE professional_skills IS
  'Skills profissionais (especializações). Não são categorias, são competências vinculadas a profissões.';
COMMENT ON COLUMN professional_skills.skill_id IS
  'ID único da skill (UUID)';
COMMENT ON COLUMN professional_skills.slug IS
  'Slug único da skill (ex: "alvenaria", "reboco")';
COMMENT ON COLUMN professional_skills.name IS
  'Nome da skill (ex: "Alvenaria", "Reboco")';

-- ============================================================
-- CRIAR TABELA profession_skill_map (se não existir)
-- ============================================================

CREATE TABLE IF NOT EXISTS profession_skill_map (
  profession_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profession_id, skill_id),
  CONSTRAINT fk_profession_skill_map_profession
    FOREIGN KEY (profession_id)
    REFERENCES categories(category_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_profession_skill_map_skill
    FOREIGN KEY (skill_id)
    REFERENCES professional_skills(skill_id)
    ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profession_skill_map_profession ON profession_skill_map(profession_id);
CREATE INDEX IF NOT EXISTS idx_profession_skill_map_skill ON profession_skill_map(skill_id);

-- Comentários
COMMENT ON TABLE profession_skill_map IS
  'Mapeamento entre profissões (categorias LEAF) e skills (especializações).';
COMMENT ON COLUMN profession_skill_map.profession_id IS
  'ID da categoria profissão (FK para categories.category_id)';
COMMENT ON COLUMN profession_skill_map.skill_id IS
  'ID da skill (FK para professional_skills.skill_id)';

-- ============================================================
-- MIGRAR ESPECIALIZAÇÕES DE "pedreiro" PARA SKILLS
-- ============================================================

DO $$
DECLARE
  pedreiro_category_id UUID;
  child_category RECORD;
  new_skill_id UUID;
  children_count INTEGER;
BEGIN
  -- 1. Buscar categoria "pedreiro" pelo slug
  SELECT category_id INTO pedreiro_category_id
  FROM categories
  WHERE slug = 'pedreiro'
  LIMIT 1;

  -- Se "pedreiro" não existe, não há nada para migrar
  IF pedreiro_category_id IS NULL THEN
    RAISE NOTICE 'Categoria "pedreiro" não encontrada. Nada para migrar.';
    RETURN;
  END IF;

  RAISE NOTICE 'Categoria "pedreiro" encontrada: %', pedreiro_category_id;

  -- 2. Contar quantos filhos "pedreiro" possui
  SELECT COUNT(*) INTO children_count
  FROM categories
  WHERE parent_id = pedreiro_category_id;

  RAISE NOTICE 'Categoria "pedreiro" possui % filhos', children_count;

  -- Se não tem filhos, já é LEAF - nada para migrar
  IF children_count = 0 THEN
    RAISE NOTICE 'Categoria "pedreiro" já é LEAF (sem filhos). Nada para migrar.';
    RETURN;
  END IF;

  -- 3. Para cada categoria filha de "pedreiro":
  FOR child_category IN
    SELECT category_id, name, slug
    FROM categories
    WHERE parent_id = pedreiro_category_id
    ORDER BY name
  LOOP
    RAISE NOTICE 'Processando categoria filha: % (slug: %)', child_category.name, child_category.slug;

    -- 3.1. Criar skill em professional_skills (ou usar existente)
    INSERT INTO professional_skills (slug, name)
    VALUES (child_category.slug, child_category.name)
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        updated_at = NOW()
    RETURNING skill_id INTO new_skill_id;

    -- Se ON CONFLICT não retornou (skill já existia), buscar skill_id
    IF new_skill_id IS NULL THEN
      SELECT skill_id INTO new_skill_id
      FROM professional_skills
      WHERE slug = child_category.slug
      LIMIT 1;
    END IF;

    RAISE NOTICE 'Skill criada/encontrada: % (skill_id: %)', child_category.name, new_skill_id;

    -- 3.2. Vincular skill à profissão "pedreiro" via profession_skill_map
    INSERT INTO profession_skill_map (profession_id, skill_id)
    VALUES (pedreiro_category_id, new_skill_id)
    ON CONFLICT (profession_id, skill_id) DO NOTHING;

    RAISE NOTICE 'Skill vinculada à profissão "pedreiro"';

    -- 3.3. Remover categoria filha da tabela categories
    -- IMPORTANTE: Verificar se a categoria filha não tem filhos próprios
    -- Se tiver, não remover (seria perda de dados)
    DECLARE
      has_children BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM categories
        WHERE parent_id = child_category.category_id
      ) INTO has_children;

      IF has_children THEN
        RAISE WARNING 'Categoria filha "%" possui filhos próprios. NÃO removendo para evitar perda de dados.', child_category.name;
      ELSE
        -- Remover categoria filha
        DELETE FROM categories
        WHERE category_id = child_category.category_id;
        RAISE NOTICE 'Categoria filha "%" removida da tabela categories', child_category.name;
      END IF;
    END;
  END LOOP;

  -- 4. Verificar se "pedreiro" ficou sem filhos (LEAF)
  SELECT COUNT(*) INTO children_count
  FROM categories
  WHERE parent_id = pedreiro_category_id;

  IF children_count = 0 THEN
    RAISE NOTICE '✅ Categoria "pedreiro" agora é LEAF (sem filhos)';
  ELSE
    RAISE WARNING '⚠️ Categoria "pedreiro" ainda possui % filhos (não é LEAF)', children_count;
  END IF;
END $$;

-- ============================================================
-- REGISTRAR MIGRATION
-- ============================================================

INSERT INTO schema_migrations (filename, executed_at)
VALUES ('299_migrate_pedreiro_specializations_to_skills.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

COMMIT;


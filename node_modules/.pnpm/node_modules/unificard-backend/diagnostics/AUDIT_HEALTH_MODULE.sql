-- ============================================================
-- UNIFICARD - AUDITORIA DO MÓDULO DE SAÚDE
-- ============================================================
-- 
-- OBJETIVO:
-- Verificar se o módulo de saúde está corretamente instalado
-- e se a migration 251 foi executada.
-- ============================================================

-- ============================================================
-- (1) VERIFICAR EXISTÊNCIA DA TABELA
-- ============================================================
-- Retorna o nome da tabela se existir, NULL caso contrário.
-- ============================================================
SELECT to_regclass('public.health_declarations') AS tabela_existe;

-- ============================================================
-- (2) VERIFICAR ESTRUTURA DA TABELA (SE EXISTIR)
-- ============================================================
-- Lista todas as colunas da tabela health_declarations.
-- ============================================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'health_declarations'
ORDER BY ordinal_position;

-- ============================================================
-- (3) VERIFICAR CONSTRAINT DE CONSENTIMENTO
-- ============================================================
-- Verifica se existe constraint CHECK que força consent = true.
-- ============================================================
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.health_declarations'::regclass
  AND contype = 'c'
  AND conname LIKE '%consent%';

-- ============================================================
-- (4) VERIFICAR ÍNDICES
-- ============================================================
-- Lista todos os índices da tabela health_declarations.
-- ============================================================
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'health_declarations'
ORDER BY indexname;

-- ============================================================
-- (5) CONTAGEM DE REGISTROS (SE HOUVER DADOS)
-- ============================================================
-- Conta quantas declarações existem (sem expor dados sensíveis).
-- ============================================================
SELECT 
    COUNT(*) AS total_declaracoes,
    COUNT(DISTINCT tenant_id) AS tenants_distintos,
    COUNT(DISTINCT actor_id) AS actors_distintos,
    MIN(created_at) AS primeira_declaracao,
    MAX(created_at) AS ultima_declaracao
FROM health_declarations;

-- ============================================================
-- (6) VERIFICAR MIGRATION 251 NO HISTÓRICO (SE HOUVER TABELA DE MIGRATIONS)
-- ============================================================
-- Nota: Depende de como o projeto controla migrations.
-- Se usar tabela schema_migrations ou similar, ajuste a query abaixo.
-- ============================================================
-- Exemplo genérico (ajuste conforme seu sistema de migrations):
-- SELECT * FROM schema_migrations WHERE version = '251' OR name LIKE '%251%';






-- ================================================
-- CORREÇÃO DE DUPLICATAS DE CATEGORIAS
-- TAREFA B2: Scripts MANUAIS para corrigir duplicatas
-- ⚠️ EXECUTAR COM CUIDADO - REVISAR ANTES DE RODAR
-- ================================================

-- PASSO 1: IDENTIFICAR DUPLICATAS
-- Execute primeiro: diagnose-duplicates.sql
-- Anote os category_ids das duplicatas

-- PASSO 2: PARA CADA DUPLICATA, ESCOLHER CANÔNICA
-- Regra sugerida: escolher a mais antiga (created_at menor) ou a que tem mais filhos
-- Exemplo para "Saúde" duplicado:

-- 2.1. Ver detalhes das duplicatas
/*
SELECT 
    category_id,
    name,
    slug,
    parent_id,
    created_at,
    (SELECT COUNT(*) FROM categories WHERE parent_id = c.category_id) as num_filhos
FROM categories c
WHERE slug = 'saude' AND parent_id IS NULL
ORDER BY created_at ASC, num_filhos DESC;
*/

-- 2.2. Escolher canônica (exemplo: category_id mais antigo)
-- Substituir '<CANON_ID>' e '<DUP_ID>' pelos IDs reais

-- PASSO 3: REAPONTAR FILHOS PARA CANÔNICA
-- ⚠️ EXECUTAR UM POR VEZ, VERIFICANDO RESULTADO

/*
-- Exemplo: Reapontar filhos de duplicata para canônica
BEGIN;

-- Ver quantos serão afetados
SELECT COUNT(*) as filhos_serao_reapontados
FROM categories 
WHERE parent_id = '<DUP_ID>';

-- Reapontar
UPDATE categories 
SET parent_id = '<CANON_ID>'
WHERE parent_id = '<DUP_ID>';

-- Verificar resultado
SELECT 
    category_id,
    name,
    parent_id
FROM categories 
WHERE parent_id = '<CANON_ID>'
ORDER BY name;

-- Se estiver correto, COMMIT. Se não, ROLLBACK.
-- COMMIT;
-- ROLLBACK;
*/

-- PASSO 4: VERIFICAR LOGS/REFERÊNCIAS
-- Se existirem tabelas que referenciam category_id, ajustar também:

/*
-- Exemplo: category_ai_logs
UPDATE category_ai_logs 
SET category_id = '<CANON_ID>'
WHERE category_id = '<DUP_ID>';

-- Exemplo: user_skills_categories (se existir)
UPDATE user_skills_categories 
SET category_id = '<CANON_ID>'
WHERE category_id = '<DUP_ID>';

-- Verificar outras tabelas que possam referenciar categories
-- SELECT table_name, column_name 
-- FROM information_schema.columns 
-- WHERE column_name LIKE '%category%';
*/

-- PASSO 5: DELETAR DUPLICATA
-- ⚠️ SÓ DEPOIS DE REAPONTAR TODOS OS FILHOS E REFERÊNCIAS

/*
BEGIN;

-- Verificar se ainda há referências
SELECT 
    'category_ai_logs' as tabela,
    COUNT(*) as referencias
FROM category_ai_logs 
WHERE category_id = '<DUP_ID>'

UNION ALL

SELECT 
    'categories (filhos)' as tabela,
    COUNT(*) as referencias
FROM categories 
WHERE parent_id = '<DUP_ID>';

-- Se todas as contagens forem 0, pode deletar
DELETE FROM categories 
WHERE category_id = '<DUP_ID>';

-- Verificar resultado
SELECT * FROM categories WHERE slug = 'saude' AND parent_id IS NULL;

-- Se estiver correto, COMMIT. Se não, ROLLBACK.
-- COMMIT;
-- ROLLBACK;
*/

-- ================================================
-- SCRIPT AUTOMATIZADO (PARA DEV/STAGING APENAS)
-- ⚠️ NÃO USAR EM PRODUÇÃO SEM REVISÃO
-- ================================================

-- Este script escolhe automaticamente a canônica (mais antiga) e corrige
-- Use apenas em ambiente de desenvolvimento

/*
DO $$
DECLARE
    dup_record RECORD;
    canon_id UUID;
    dup_id UUID;
BEGIN
    -- Para cada raiz duplicada por slug
    FOR dup_record IN 
        SELECT slug, array_agg(category_id ORDER BY created_at ASC) as ids
        FROM categories 
        WHERE parent_id IS NULL 
        GROUP BY slug 
        HAVING COUNT(*) > 1
    LOOP
        -- Primeiro ID (mais antigo) é a canônica
        canon_id := dup_record.ids[1];
        
        -- Para cada duplicata (exceto a canônica)
        FOR i IN 2..array_length(dup_record.ids, 1) LOOP
            dup_id := dup_record.ids[i];
            
            -- Reapontar filhos
            UPDATE categories 
            SET parent_id = canon_id
            WHERE parent_id = dup_id;
            
            -- Atualizar logs
            UPDATE category_ai_logs 
            SET category_id = canon_id
            WHERE category_id = dup_id;
            
            -- Deletar duplicata
            DELETE FROM categories 
            WHERE category_id = dup_id;
            
            RAISE NOTICE 'Corrigido: slug=%, canon=%, dup=%', dup_record.slug, canon_id, dup_id;
        END LOOP;
    END LOOP;
END $$;
*/





























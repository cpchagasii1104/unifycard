-- ================================================
-- CORREÇÃO: Consolidar "Saúde" e "Saúde e Bem-Estar"
-- TAREFA: Unificar em um único grupo "Saúde e Bem-Estar"
-- ================================================

-- PASSO 1: IDENTIFICAR AS DUPLICATAS
SELECT 
    category_id,
    name,
    slug,
    created_at,
    (SELECT COUNT(*) FROM categories WHERE parent_id = c.category_id) as num_filhos
FROM categories c
WHERE (LOWER(name) LIKE '%saúde%' OR LOWER(name) LIKE '%saude%' OR LOWER(name) LIKE '%bem-estar%')
  AND parent_id IS NULL
ORDER BY created_at ASC, num_filhos DESC;

-- PASSO 2: VERIFICAR FILHOS DE CADA UMA
-- Execute manualmente substituindo os IDs:
/*
SELECT 
    c.category_id,
    c.name,
    c.parent_id,
    p.name as parent_name
FROM categories c
LEFT JOIN categories p ON c.parent_id = p.category_id
WHERE c.parent_id IN (
    SELECT category_id 
    FROM categories 
    WHERE (LOWER(name) LIKE '%saúde%' OR LOWER(name) LIKE '%saude%' OR LOWER(name) LIKE '%bem-estar%')
      AND parent_id IS NULL
)
ORDER BY c.parent_id, c.name;
*/

-- PASSO 3: ESCOLHER CANÔNICA
-- Regra: "Saúde e Bem-Estar" deve ser a canônica (mais específica)
-- Se não existir, criar. Se "Saúde" existir, migrar filhos para "Saúde e Bem-Estar"

-- PASSO 4: CRIAR/MANTER "Saúde e Bem-Estar" COMO CANÔNICA
-- Se não existir, criar:
/*
INSERT INTO categories (
    category_id,
    name,
    slug,
    description,
    parent_id,
    level,
    path,
    keywords,
    country_code,
    status,
    requires_review,
    created_by_ai,
    created_at,
    updated_at
)
SELECT 
    uuid_generate_v4(),
    'Saúde e Bem-Estar',
    'saude-e-bem-estar',
    'Grupo consolidado: Saúde e Bem-Estar',
    NULL,
    0,
    ARRAY['saude-e-bem-estar'],
    ARRAY['saude', 'bem-estar', 'saúde'],
    NULL,
    'active',
    false,
    false,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM categories 
    WHERE slug = 'saude-e-bem-estar' AND parent_id IS NULL
)
RETURNING category_id;
*/

-- PASSO 5: REAPONTAR FILHOS DE "Saúde" PARA "Saúde e Bem-Estar"
-- ⚠️ EXECUTAR COM CUIDADO - SUBSTITUIR IDs MANUALMENTE
/*
BEGIN;

-- 1. Obter ID da canônica "Saúde e Bem-Estar"
-- Se não existir, criar primeiro (ver PASSO 4)

-- 2. Obter ID de "Saúde" (duplicata)
-- SELECT category_id FROM categories WHERE slug = 'saude' AND parent_id IS NULL;

-- 3. Reapontar filhos
UPDATE categories 
SET parent_id = '<CANON_ID_SAUDE_E_BEM_ESTAR>'
WHERE parent_id = '<DUP_ID_SAUDE>';

-- 4. Verificar resultado
SELECT 
    c.category_id,
    c.name,
    c.parent_id,
    p.name as parent_name
FROM categories c
LEFT JOIN categories p ON c.parent_id = p.category_id
WHERE c.parent_id = '<CANON_ID_SAUDE_E_BEM_ESTAR>'
ORDER BY c.name;

-- 5. Se estiver correto, COMMIT. Se não, ROLLBACK.
-- COMMIT;
-- ROLLBACK;
*/

-- PASSO 6: ATUALIZAR LOGS/REFERÊNCIAS
/*
UPDATE category_ai_logs 
SET category_id = '<CANON_ID_SAUDE_E_BEM_ESTAR>'
WHERE category_id = '<DUP_ID_SAUDE>';
*/

-- PASSO 7: DELETAR DUPLICATA "Saúde"
-- ⚠️ SÓ DEPOIS DE REAPONTAR TODOS OS FILHOS
/*
BEGIN;

-- Verificar se ainda há referências
SELECT 
    'category_ai_logs' as tabela,
    COUNT(*) as referencias
FROM category_ai_logs 
WHERE category_id = '<DUP_ID_SAUDE>'

UNION ALL

SELECT 
    'categories (filhos)' as tabela,
    COUNT(*) as referencias
FROM categories 
WHERE parent_id = '<DUP_ID_SAUDE>';

-- Se todas as contagens forem 0, pode deletar
DELETE FROM categories 
WHERE category_id = '<DUP_ID_SAUDE>';

-- Verificar resultado
SELECT * FROM categories 
WHERE (LOWER(name) LIKE '%saúde%' OR LOWER(name) LIKE '%saude%' OR LOWER(name) LIKE '%bem-estar%')
  AND parent_id IS NULL;

-- Se estiver correto, COMMIT. Se não, ROLLBACK.
-- COMMIT;
-- ROLLBACK;
*/

-- ================================================
-- SCRIPT AUTOMATIZADO (PARA DEV/STAGING APENAS)
-- ⚠️ NÃO USAR EM PRODUÇÃO SEM REVISÃO
-- ================================================

DO $$
DECLARE
    canon_id UUID;
    saude_id UUID;
    saude_bem_estar_id UUID;
    filhos_count INTEGER;
BEGIN
    -- 1. Buscar ou criar "Saúde e Bem-Estar" como canônica
    SELECT category_id INTO saude_bem_estar_id
    FROM categories
    WHERE slug = 'saude-e-bem-estar' AND parent_id IS NULL
    LIMIT 1;
    
    IF saude_bem_estar_id IS NULL THEN
        -- Criar "Saúde e Bem-Estar"
        INSERT INTO categories (
            name, slug, description, parent_id, level, path, keywords,
            country_code, status, requires_review, created_by_ai, created_at, updated_at
        )
        VALUES (
            'Saúde e Bem-Estar',
            'saude-e-bem-estar',
            'Grupo consolidado: Saúde e Bem-Estar',
            NULL,
            0,
            ARRAY['saude-e-bem-estar'],
            ARRAY['saude', 'bem-estar', 'saúde']::jsonb,
            NULL,
            'active',
            false,
            false,
            NOW(),
            NOW()
        )
        RETURNING category_id INTO saude_bem_estar_id;
        
        RAISE NOTICE 'Criado "Saúde e Bem-Estar": %', saude_bem_estar_id;
    ELSE
        RAISE NOTICE 'Usando "Saúde e Bem-Estar" existente: %', saude_bem_estar_id;
    END IF;
    
    -- 2. Buscar "Saúde" (duplicata)
    SELECT category_id INTO saude_id
    FROM categories
    WHERE slug = 'saude' AND parent_id IS NULL
    LIMIT 1;
    
    IF saude_id IS NOT NULL AND saude_id != saude_bem_estar_id THEN
        -- 3. Contar filhos
        SELECT COUNT(*) INTO filhos_count
        FROM categories
        WHERE parent_id = saude_id;
        
        RAISE NOTICE 'Encontrado "Saúde" duplicado: %, com % filhos', saude_id, filhos_count;
        
        -- 4. Reapontar filhos
        UPDATE categories 
        SET parent_id = saude_bem_estar_id
        WHERE parent_id = saude_id;
        
        RAISE NOTICE 'Reapontados % filhos de "Saúde" para "Saúde e Bem-Estar"', filhos_count;
        
        -- 5. Atualizar logs
        UPDATE category_ai_logs 
        SET category_id = saude_bem_estar_id
        WHERE category_id = saude_id;
        
        -- 6. Deletar duplicata
        DELETE FROM categories 
        WHERE category_id = saude_id;
        
        RAISE NOTICE 'Duplicata "Saúde" deletada: %', saude_id;
    ELSE
        RAISE NOTICE 'Nenhuma duplicata "Saúde" encontrada ou já consolidada';
    END IF;
    
    RAISE NOTICE 'Consolidação concluída!';
END $$;

-- Verificar resultado final
SELECT 
    category_id,
    name,
    slug,
    (SELECT COUNT(*) FROM categories WHERE parent_id = c.category_id) as num_filhos
FROM categories c
WHERE (LOWER(name) LIKE '%saúde%' OR LOWER(name) LIKE '%saude%' OR LOWER(name) LIKE '%bem-estar%')
  AND parent_id IS NULL
ORDER BY name;
















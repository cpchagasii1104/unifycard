-- ============================================================
-- UNIFICARD - SCRIPT DE VALIDAÇÃO DE ENCODING
-- Execute este script ANTES e DEPOIS da migration 284
-- ============================================================

-- Verificar encoding do servidor
SELECT 
  name,
  setting
FROM pg_settings
WHERE name IN ('server_encoding', 'client_encoding');

-- Verificar encoding do banco atual
SELECT 
  datname as database_name,
  pg_encoding_to_char(encoding) as database_encoding
FROM pg_database
WHERE datname = current_database();

-- Verificar encoding da tabela categories (se aplicável)
-- Nota: Query simplificada para compatibilidade
SELECT 
  n.nspname as schema_name,
  c.relname as table_name,
  a.attname as column_name
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'categories'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;

-- Verificar segments do market (ANTES da correção)
-- Nota: description pode não existir na tabela categories
SELECT 
  slug,
  name,
  encode(name::bytea, 'hex') as name_hex,
  metadata->>'category_type' as category_type,
  metadata->>'marketplace_domain' as marketplace_domain
FROM categories
WHERE metadata->>'category_type' = 'segment'
  AND metadata->>'marketplace_domain' = 'market'
  AND country_code = 'BR'
  AND parent_id IS NULL
ORDER BY slug;




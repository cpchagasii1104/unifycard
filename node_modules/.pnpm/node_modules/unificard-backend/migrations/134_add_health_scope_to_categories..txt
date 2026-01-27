-- Migration: Add 'health' scope to categories
-- PRINCÍPIO: Saúde é AUTODECLARAÇÃO. NUNCA diagnóstico.

BEGIN;

-- Remove constraint antiga
ALTER TABLE categories
DROP CONSTRAINT IF EXISTS categories_scope_check;

-- Recria constraint com 'health' incluído
ALTER TABLE categories
ADD CONSTRAINT categories_scope_check
CHECK (
  scope IN (
    'professional',
    'learning',
    'education',
    'hobby',
    'company',
    'lifestyle',
    'health'
  )
);

COMMIT;

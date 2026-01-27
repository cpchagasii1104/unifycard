-- Migration 135: Estender constraint categories_scope_check para incluir scope 'health'
-- Data: 2026-01-10
-- Descrição: Adiciona 'health' à lista de scopes permitidos na tabela categories

BEGIN;

-- 1. Remover constraint antiga (idempotente)
ALTER TABLE categories
DROP CONSTRAINT IF EXISTS categories_scope_check;

-- 2. Recriar constraint com todos os scopes permitidos incluindo 'health'
ALTER TABLE categories
ADD CONSTRAINT categories_scope_check
CHECK (
  scope IN (
    'global',
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

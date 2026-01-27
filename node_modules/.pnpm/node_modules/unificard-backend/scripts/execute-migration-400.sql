-- Script para executar apenas a migração 400
-- Execute via: psql -h <HOST> -U <USER> -d <DATABASE> -f backend/scripts/execute-migration-400.sql

\set ON_ERROR_STOP on

-- Executar o conteúdo da migração 400
\i backend/migrations/400_backfill_catalog_categories_to_core.sql




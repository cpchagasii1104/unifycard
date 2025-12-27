-- ================================================
-- UNIFICARD - MIGRATION 000 (BOOTSTRAP)
-- Tabela de controle de migrations
-- Deve ser executada PRIMEIRO, antes de qualquer outra migration
-- ================================================

-- ===========================
-- SCHEMA MIGRATIONS TABLE
-- ===========================
-- Tabela para rastrear quais migrations já foram executadas
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum VARCHAR(64), -- Hash do conteúdo para validação (opcional)
  execution_time_ms INTEGER, -- Tempo de execução em milissegundos (opcional)
  CONSTRAINT unique_filename UNIQUE (filename)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations (filename);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON schema_migrations (executed_at);

-- Comentários
COMMENT ON TABLE schema_migrations IS 'Controle de migrations executadas - usado pelo sistema de migração automático';
COMMENT ON COLUMN schema_migrations.filename IS 'Nome do arquivo de migration (ex: 001_initial_schema.sql)';
COMMENT ON COLUMN schema_migrations.executed_at IS 'Data/hora de execução da migration';
COMMENT ON COLUMN schema_migrations.checksum IS 'Hash SHA-256 do conteúdo SQL (opcional, para validação)';
COMMENT ON COLUMN schema_migrations.execution_time_ms IS 'Tempo de execução em milissegundos (opcional)';



/*
Arquivo: 000_schema_migrations.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Infraestrutura de migrations

Objetivo:
- Controlar quais migrations já foram executadas
- Permitir execução idempotente e auditável do schema

Dependências:
- Nenhuma (arquivo raiz do projeto)
Observações:
- Deve ser sempre o primeiro arquivo executado
*/


CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum VARCHAR(64),
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename
  ON schema_migrations (filename);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at
  ON schema_migrations (executed_at);

COMMENT ON TABLE schema_migrations IS 'Controle de migrations executadas - usado pelo sistema de migração automático';
COMMENT ON COLUMN schema_migrations.filename IS 'Nome do arquivo de migration (ex: 001_initial_schema.sql)';
COMMENT ON COLUMN schema_migrations.executed_at IS 'Data/hora de execução da migration';
COMMENT ON COLUMN schema_migrations.checksum IS 'Hash SHA-256 do conteúdo SQL (opcional, para validação)';
COMMENT ON COLUMN schema_migrations.execution_time_ms IS 'Tempo de execução em milissegundos (opcional)';














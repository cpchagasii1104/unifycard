-- ============================================================
-- UNIFICARD - MIGRATION 298
-- Arquivo: 298_add_metadata_to_events.sql
-- Tipo: EVOLUÇÃO ESTRUTURAL
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- A tabela events precisa da coluna metadata (JSONB) para
-- armazenar EventDeclaration e outros metadados flexíveis.
-- Esta migration adiciona a coluna de forma idempotente.
--
-- DEPENDÊNCIAS
-- - events (026_events_core.sql)
--
-- IDEMPOTÊNCIA
-- - Usa IF NOT EXISTS para garantir execução segura
-- ============================================================

-- ============================================================
-- ADICIONAR COLUNA metadata
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE events
      ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    
    -- Comentário canônico
    COMMENT ON COLUMN events.metadata IS
      'Metadados flexíveis do evento (JSONB). Armazena EventDeclaration em metadata.declaration.';
  END IF;
END $$;

-- ============================================================
-- ÍNDICE GIN PARA QUERIES JSONB (opcional, mas recomendado)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_events_metadata_gin
  ON events USING GIN (metadata);

-- ============================================================
-- COMENTÁRIO FINAL
-- ============================================================

COMMENT ON COLUMN events.metadata IS
  'Metadados flexíveis do evento (JSONB). Armazena EventDeclaration em metadata.declaration conforme FASE 2.';


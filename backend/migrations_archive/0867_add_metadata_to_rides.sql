-- Migration 150: Adicionar metadata JSONB a rides_rides
-- SPRINT 4: DRIVER SYSTEM (RIDES) AS A FULL SYSTEM STRESS TEST
-- Propósito: Armazenar bankTransactionId e outros metadados de rides

-- Verificar se tabela existe antes de alterar (módulo rides pode estar desativado)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides_rides') THEN
    -- Adicionar coluna metadata se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rides_rides' AND column_name = 'metadata'
    ) THEN
      ALTER TABLE rides_rides ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Comentário
    COMMENT ON COLUMN rides_rides.metadata IS
      'Metadados flexíveis da corrida. Usado para armazenar bankTransactionId e outros dados não-críticos.';

    -- Índice GIN para busca em metadata
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rides_rides_metadata_gin') THEN
      CREATE INDEX idx_rides_rides_metadata_gin
      ON rides_rides USING GIN (metadata)
      WHERE metadata <> '{}'::jsonb;
    END IF;
  END IF;
END$$;





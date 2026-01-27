/*
Arquivo: 020_root_config.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Configuração global singleton do sistema

Objetivo:
- Armazenar configurações globais únicas do sistema
- Garantir exatamente UMA linha
- Base para flags, chaves e parâmetros globais
*/

-- =========================================================
-- FUNÇÃO PADRÃO updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- TABELA ROOT CONFIG (SINGLETON REAL)
-- =========================================================

CREATE TABLE IF NOT EXISTS root_config (
  id SMALLINT PRIMARY KEY CHECK (id = 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE root_config IS
  'Configuração global singleton do sistema (exatamente uma linha)';

-- =========================================================
-- TRIGGER updated_at
-- =========================================================

DROP TRIGGER IF EXISTS trg_root_config_updated_at ON root_config;
CREATE TRIGGER trg_root_config_updated_at
  BEFORE UPDATE ON root_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- GARANTIR EXISTÊNCIA DA LINHA ÚNICA
-- =========================================================

INSERT INTO root_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;









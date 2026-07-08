-- 20260708230000: CATÁLOGO DE VEÍCULO — variante estável + ficha técnica rica (GO Clayton 2026-07-08).
-- Estende vehicle_model_specs (a CASA da variante que já existe — NÃO cria tabela paralela) com:
--   (A) variant_id ESTÁVEL (business key do CSV, ex.: 'fiat-pulse-abarth-2023-turbo-270-flex-at6-fwd')
--       — a identidade que venda/locação/oficina/autopeças usam; UNIQUE p/ upsert idempotente;
--   (B) ~35 colunas da ficha técnica completa do CSV canônico.
-- + infra de IMPORTAÇÃO (staging/auditoria, NÃO catálogo vivo): import_batches + import_rows.
-- Nada financeiro. Δbank=0. Forward-only.
BEGIN;

-- (A) chave estável + (B) ficha rica no specs existente (uma fonte de variante).
ALTER TABLE vehicle_model_specs
  ADD COLUMN IF NOT EXISTS variant_id TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS linha TEXT,
  ADD COLUMN IF NOT EXISTS geracao TEXT,
  ADD COLUMN IF NOT EXISTS ano_lancamento_brasil INTEGER,
  ADD COLUMN IF NOT EXISTS ano_fabricacao_inicio INTEGER,
  ADD COLUMN IF NOT EXISTS ano_fabricacao_fim INTEGER,
  ADD COLUMN IF NOT EXISTS versao_nome TEXT,
  ADD COLUMN IF NOT EXISTS carroceria TEXT,
  ADD COLUMN IF NOT EXISTS numero_lugares INTEGER,
  ADD COLUMN IF NOT EXISTS motor_nome TEXT,
  ADD COLUMN IF NOT EXISTS motor_codigo TEXT,
  ADD COLUMN IF NOT EXISTS motor_familia TEXT,
  ADD COLUMN IF NOT EXISTS cilindros INTEGER,
  ADD COLUMN IF NOT EXISTS valvulas_total INTEGER,
  ADD COLUMN IF NOT EXISTS aspiracao TEXT,
  ADD COLUMN IF NOT EXISTS alimentacao TEXT,
  ADD COLUMN IF NOT EXISTS potencia_cv_gasolina INTEGER,
  ADD COLUMN IF NOT EXISTS potencia_cv_etanol INTEGER,
  ADD COLUMN IF NOT EXISTS potencia_rpm INTEGER,
  ADD COLUMN IF NOT EXISTS torque_kgfm_gasolina NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS torque_kgfm_etanol NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS torque_rpm INTEGER,
  ADD COLUMN IF NOT EXISTS codigo_cambio TEXT,
  ADD COLUMN IF NOT EXISTS numero_marchas TEXT,
  ADD COLUMN IF NOT EXISTS porta_malas_litros INTEGER,
  ADD COLUMN IF NOT EXISTS pneus_diant TEXT,
  ADD COLUMN IF NOT EXISTS pneus_tras TEXT,
  ADD COLUMN IF NOT EXISTS rodas TEXT,
  ADD COLUMN IF NOT EXISTS abs TEXT,
  ADD COLUMN IF NOT EXISTS airbags INTEGER,
  ADD COLUMN IF NOT EXISTS controle_estabilidade TEXT,
  ADD COLUMN IF NOT EXISTS start_stop TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_fitment TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_confidence TEXT;

-- dimensões em cm têm decimal no catálogo canônico (ex.: 411.5) — INTEGER perderia precisão.
ALTER TABLE vehicle_model_specs
  ALTER COLUMN comprimento_cm TYPE NUMERIC(6,1),
  ALTER COLUMN largura_cm TYPE NUMERIC(6,1),
  ALTER COLUMN altura_cm TYPE NUMERIC(6,1),
  ALTER COLUMN entre_eixos_cm TYPE NUMERIC(6,1);

-- variant_id é a identidade estável → UNIQUE (idempotência do import). Parcial: só onde não-nulo
-- (linhas legadas sem variant_id não colidem; serão zeradas na limpeza desta frente).
CREATE UNIQUE INDEX IF NOT EXISTS ux_vehicle_model_specs_variant_id
  ON vehicle_model_specs (variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_vehicle_model_specs_motor_codigo ON vehicle_model_specs (motor_codigo);
CREATE INDEX IF NOT EXISTS ix_vehicle_model_specs_codigo_cambio ON vehicle_model_specs (codigo_cambio);
CREATE INDEX IF NOT EXISTS ix_vehicle_model_specs_categoria ON vehicle_model_specs (categoria);

-- ── INFRA DE IMPORTAÇÃO (staging/auditoria — não é fonte viva do catálogo) ──
CREATE TABLE IF NOT EXISTS vehicle_catalog_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_filename TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_rejected INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_catalog_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES vehicle_catalog_import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  variant_id TEXT,
  raw_data JSONB,
  status TEXT NOT NULL,            -- inserted | updated | rejected
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_vehicle_import_rows_batch ON vehicle_catalog_import_rows (batch_id);

COMMIT;

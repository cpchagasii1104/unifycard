-- ============================================
-- 055_categories_ai_blindage.sql
-- Blindagem de IA para criação de categorias
-- ============================================
-- NOTA: Se 055_categories_ai_validation.sql já foi executada, esta migration é idempotente

-- Adicionar campos de blindagem à tabela categories (idempotente)
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by_ai BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Adicionar constraint apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_status_check'
  ) THEN
    ALTER TABLE categories
    ADD CONSTRAINT categories_status_check CHECK (status IN ('active', 'pending', 'rejected', 'archived'));
  END IF;
END $$;

-- Índices para moderação
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_categories_requires_review ON categories (requires_review) WHERE requires_review = true;
CREATE INDEX IF NOT EXISTS idx_categories_created_by_ai ON categories (created_by_ai) WHERE created_by_ai = true;

-- Tabela de logs de criação por IA
CREATE TABLE IF NOT EXISTS category_ai_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  actor_id UUID REFERENCES actors(actor_id) ON DELETE SET NULL,
  global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL,
  input_type VARCHAR(20) NOT NULL CHECK (input_type IN ('text', 'voice', 'transcription')),
  original_text TEXT NOT NULL,
  sanitized_text TEXT NOT NULL,
  text_hash VARCHAR(64) NOT NULL, -- SHA-256
  audio_hash VARCHAR(64), -- SHA-256 (se for voz)
  audio_url TEXT,
  context VARCHAR(20) CHECK (context IN ('professional', 'interest', 'education')),
  ai_suggestion JSONB DEFAULT '{}'::jsonb,
  ai_confidence NUMERIC(3,2) DEFAULT 0.5 CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_category ON category_ai_logs (category_id);
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_actor ON category_ai_logs (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_text_hash ON category_ai_logs (text_hash);
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_audio_hash ON category_ai_logs (audio_hash) WHERE audio_hash IS NOT NULL;

-- Comentários
COMMENT ON COLUMN categories.status IS 'Status da categoria: active (aprovada), pending (aguardando aprovação), rejected (rejeitada)';
COMMENT ON COLUMN categories.requires_review IS 'Se true, categoria precisa de revisão humana antes de ficar ativa';
COMMENT ON COLUMN categories.created_by_ai IS 'Se true, categoria foi criada por IA e precisa validação';
COMMENT ON TABLE category_ai_logs IS 'Log completo de origem de categorias criadas por IA (rastreabilidade total)';


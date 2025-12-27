-- ================================================
-- UNIFICARD - MIGRATION 055
-- Categories AI Validation & Logging
-- Sistema de validação e rastreamento para categorias criadas por IA
-- ================================================

-- ===========================
-- ADICIONAR CAMPOS DE VALIDAÇÃO NA TABELA CATEGORIES
-- ===========================
ALTER TABLE categories 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
    CHECK (status IN ('active', 'pending', 'rejected', 'archived')),
  ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by_ai BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Índices para consultas de validação
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_categories_requires_review ON categories (requires_review) WHERE requires_review = true;
CREATE INDEX IF NOT EXISTS idx_categories_created_by_ai ON categories (created_by_ai) WHERE created_by_ai = true;

-- Atualizar categorias existentes para status 'active'
UPDATE categories SET status = 'active' WHERE status IS NULL;

-- ===========================
-- TABELA DE LOGS DE CRIAÇÃO POR IA
-- ===========================
CREATE TABLE IF NOT EXISTS category_ai_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  actor_id UUID REFERENCES actors(actor_id) ON DELETE SET NULL,
  global_user_id UUID,
  
  -- Origem da criação
  input_type VARCHAR(20) NOT NULL CHECK (input_type IN ('text', 'voice', 'transcription')),
  original_text TEXT NOT NULL,
  sanitized_text TEXT NOT NULL,
  
  -- Hashes para rastreamento
  text_hash VARCHAR(64), -- SHA-256 do texto sanitizado
  audio_hash VARCHAR(64), -- SHA-256 do áudio (se aplicável)
  audio_url TEXT, -- URL do áudio original (se aplicável)
  
  -- Contexto da criação
  context VARCHAR(20) CHECK (context IN ('professional', 'interest', 'education')),
  ai_suggestion JSONB, -- Sugestão completa da IA
  ai_confidence NUMERIC(3,2), -- Confiança da IA (0.00 a 1.00)
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Índices
  CONSTRAINT category_ai_logs_category_unique UNIQUE (category_id)
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_category ON category_ai_logs (category_id);
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_actor ON category_ai_logs (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_tenant ON category_ai_logs (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_text_hash ON category_ai_logs (text_hash) WHERE text_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_category_ai_logs_created_at ON category_ai_logs (created_at);

-- RLS (Row Level Security)
ALTER TABLE category_ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY category_ai_logs_rls ON category_ai_logs
  USING (
    tenant_id IS NULL OR 
    tenant_id::text = current_setting('app.current_tenant', true)
  );

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE category_ai_logs IS 'Logs de rastreamento para categorias criadas por IA';
COMMENT ON COLUMN categories.status IS 'Status da categoria: active, pending, rejected, archived';
COMMENT ON COLUMN categories.requires_review IS 'Indica se a categoria requer revisão humana antes de ser ativada';
COMMENT ON COLUMN categories.created_by_ai IS 'Indica se a categoria foi criada por IA';
COMMENT ON COLUMN categories.approved_by IS 'ID do usuário que aprovou a categoria';
COMMENT ON COLUMN categories.approved_at IS 'Data/hora da aprovação';
COMMENT ON COLUMN categories.rejection_reason IS 'Motivo da rejeição (se aplicável)';
COMMENT ON COLUMN category_ai_logs.text_hash IS 'Hash SHA-256 do texto sanitizado para rastreamento';
COMMENT ON COLUMN category_ai_logs.audio_hash IS 'Hash SHA-256 do áudio original (se aplicável)';
COMMENT ON COLUMN category_ai_logs.ai_suggestion IS 'Sugestão completa retornada pela IA em formato JSON';
COMMENT ON COLUMN category_ai_logs.ai_confidence IS 'Nível de confiança da IA na sugestão (0.00 a 1.00)';

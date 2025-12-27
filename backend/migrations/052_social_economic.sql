-- ================================================
-- UNIFICARD - MIGRATION 052
-- Social Econômico - CTA em posts, grupos com percentual, ledger social
-- ================================================

-- ===========================
-- POST_CTA (Call-to-Action nos posts)
-- ===========================
CREATE TABLE IF NOT EXISTS post_cta (
  cta_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  
  -- Tipo de CTA
  cta_type VARCHAR(20) NOT NULL CHECK (cta_type IN ('booking', 'service', 'payment')),
  
  -- Dados específicos do CTA
  target_actor_id UUID REFERENCES actors(actor_id) ON DELETE SET NULL, -- Actor que recebe a ação
  target_group_id UUID REFERENCES groups(group_id) ON DELETE SET NULL, -- Grupo que recebe repasse (opcional)
  
  -- Configuração
  price DECIMAL(12, 2), -- Preço (se aplicável)
  currency VARCHAR(3) DEFAULT 'BRL',
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_post_cta_post ON post_cta (post_id);
CREATE INDEX IF NOT EXISTS idx_post_cta_tenant ON post_cta (tenant_id);
CREATE INDEX IF NOT EXISTS idx_post_cta_type ON post_cta (cta_type);
CREATE INDEX IF NOT EXISTS idx_post_cta_group ON post_cta (target_group_id) WHERE target_group_id IS NOT NULL;

-- RLS
ALTER TABLE post_cta ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_cta_rls ON post_cta
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- GROUP_PROFIT_CONFIG (Percentual de lucro por grupo)
-- ===========================
ALTER TABLE groups ADD COLUMN IF NOT EXISTS profit_percentage DECIMAL(5, 2) DEFAULT 0.00;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS profit_config_metadata JSONB DEFAULT '{}'::jsonb;

-- Constraint: percentual entre 0 e 100
ALTER TABLE groups ADD CONSTRAINT groups_profit_percentage_check 
  CHECK (profit_percentage >= 0 AND profit_percentage <= 100);

-- ===========================
-- SOCIAL_LEDGER (Ledger imutável de impacto social)
-- ===========================
CREATE TABLE IF NOT EXISTS social_ledger (
  ledger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- Origem
  post_id UUID REFERENCES posts(post_id) ON DELETE SET NULL,
  cta_id UUID REFERENCES post_cta(cta_id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL,
  
  -- Destino
  recipient_actor_id UUID REFERENCES actors(actor_id) ON DELETE SET NULL, -- Actor que recebe
  recipient_group_id UUID REFERENCES groups(group_id) ON DELETE SET NULL, -- Grupo que recebe repasse
  
  -- Valores
  amount DECIMAL(12, 2) NOT NULL, -- Valor em moeda
  currency VARCHAR(3) DEFAULT 'BRL',
  amount_type VARCHAR(20) NOT NULL CHECK (amount_type IN ('revenue', 'profit_share', 'donation', 'commission')),
  
  -- Metadados
  description TEXT, -- Descrição legível do impacto
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps (imutável - não tem updated_at)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_social_ledger_tenant ON social_ledger (tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_ledger_post ON social_ledger (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_ledger_actor ON social_ledger (recipient_actor_id) WHERE recipient_actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_ledger_group ON social_ledger (recipient_group_id) WHERE recipient_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_ledger_created ON social_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_ledger_type ON social_ledger (amount_type);

-- RLS
ALTER TABLE social_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_ledger_rls ON social_ledger
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- TRIGGERS
-- ===========================
-- Trigger para atualizar updated_at em post_cta
CREATE OR REPLACE FUNCTION update_post_cta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_cta_updated_at
  BEFORE UPDATE ON post_cta
  FOR EACH ROW
  EXECUTE FUNCTION update_post_cta_updated_at();

-- ===========================
-- COMMENTS
-- ===========================
COMMENT ON TABLE post_cta IS 'Call-to-Action nos posts (agendar/contratar/comprar)';
COMMENT ON TABLE social_ledger IS 'Ledger imutável de impacto social e econômico (append-only)';
COMMENT ON COLUMN groups.profit_percentage IS 'Percentual de lucro que o grupo recebe de transações de membros (0-100)';

















-- ============================================
-- 046_add_combo_discounts.sql
-- Adiciona sistema de descontos para combos (múltiplos serviços)
-- ============================================

-- Tabela para regras de desconto por combo
CREATE TABLE IF NOT EXISTS combo_discount_rules (
  rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  
  -- Regra: desconto aplicado quando X ou mais serviços são selecionados
  min_services INTEGER NOT NULL DEFAULT 2 CHECK (min_services >= 2),
  
  -- Desconto percentual (0-100)
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  
  -- Descrição da regra (ex: "Desconto de 10% ao contratar 3 ou mais serviços")
  description TEXT,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT combo_discount_rules_unique UNIQUE (global_user_id, category_id, min_services)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_combo_discount_rules_user ON combo_discount_rules (global_user_id);
CREATE INDEX IF NOT EXISTS idx_combo_discount_rules_category ON combo_discount_rules (category_id);
CREATE INDEX IF NOT EXISTS idx_combo_discount_rules_active ON combo_discount_rules (is_active) WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER trigger_update_combo_discount_rules_updated_at
  BEFORE UPDATE ON combo_discount_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- Comentários
COMMENT ON TABLE combo_discount_rules IS 'Regras de desconto para combos: quando o cliente contrata múltiplos serviços, pode receber desconto';
COMMENT ON COLUMN combo_discount_rules.min_services IS 'Número mínimo de serviços para aplicar o desconto';
COMMENT ON COLUMN combo_discount_rules.discount_percentage IS 'Desconto percentual aplicado (0-100)';



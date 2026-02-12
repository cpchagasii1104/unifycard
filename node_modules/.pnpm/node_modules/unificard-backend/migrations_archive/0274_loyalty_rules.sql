-- backend/migrations/238_create_loyalty_rules.sql
-- SPRINT 93: LOYALTY / FIDELIDADE

-- ============================================================
-- ENUM: loyalty_rule_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_rule_status') THEN
    CREATE TYPE loyalty_rule_status AS ENUM (
      'ACTIVE',
      'INACTIVE'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: loyalty_rule_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_rule_type') THEN
    CREATE TYPE loyalty_rule_type AS ENUM (
      'PERCENT_OF_AMOUNT',
      'FIXED_POINTS'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: loyalty_rule_applies_to
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_rule_applies_to') THEN
    CREATE TYPE loyalty_rule_applies_to AS ENUM (
      'CHANNEL',
      'SEGMENT',
      'ACTOR',
      'EVENT',
      'VARIANT',
      'CATEGORY'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: loyalty_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status loyalty_rule_status NOT NULL DEFAULT 'ACTIVE',
    rule_type loyalty_rule_type NOT NULL,
    value NUMERIC(14,2) NOT NULL, -- percentual ou pontos fixos
    applies_to loyalty_rule_applies_to NOT NULL,
    applies_id UUID, -- ID do canal/segmento/actor/event/variant/category
    min_amount NUMERIC(14,2), -- valor mínimo da transação
    max_points_per_day BIGINT, -- limite diário de pontos
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_to TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_rules_tenant_status ON loyalty_rules(tenant_id, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_loyalty_rules_tenant_applies ON loyalty_rules(tenant_id, applies_to, applies_id) WHERE applies_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_rules_valid_dates ON loyalty_rules(tenant_id, valid_from, valid_to) WHERE status = 'ACTIVE';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE loyalty_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_rules_tenant_isolation ON loyalty_rules FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);






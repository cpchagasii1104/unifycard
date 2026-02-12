-- ============================================================
-- GENESIS 0005: EVENTS & RISK
-- ============================================================
-- MODO: Constitucional Rígido

BEGIN;

-- ============================================================
-- AI CONSTITUTIONAL LIMITS
-- ============================================================

CREATE TABLE ai_constitutional_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  limit_type TEXT NOT NULL UNIQUE CHECK (limit_type IN (
    'operations_per_hour', 'operations_per_day', 'blast_radius_pct',
    'max_amount_per_operation_cents', 'max_total_amount_per_hour_cents'
  )),
  limit_value BIGINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  kill_switch_activated_at TIMESTAMPTZ,
  kill_switch_activated_by TEXT,
  kill_switch_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Limites padrão
INSERT INTO ai_constitutional_limits (limit_type, limit_value) VALUES
  ('operations_per_hour', 100),
  ('operations_per_day', 1000),
  ('blast_radius_pct', 1),
  ('max_amount_per_operation_cents', 100000),
  ('max_total_amount_per_hour_cents', 1000000);

-- AI Operations Log
CREATE TABLE ai_operations_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ai_instance_id TEXT NOT NULL,
  ai_model TEXT,
  operation_type TEXT NOT NULL,
  affected_actors_count INTEGER DEFAULT 0,
  amount_cents BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_operations_instance ON ai_operations_log(ai_instance_id);
CREATE INDEX idx_ai_operations_created ON ai_operations_log(created_at);

-- ============================================================
-- EVASION PATTERNS (Fragmentation Detection)
-- ============================================================

CREATE TYPE evasion_pattern_type AS ENUM (
  'fragmentation', 'persona_rotation', 'cluster_suspicious',
  'automation_abuse', 'chain_delegation', 'timing_manipulation'
);

CREATE TABLE evasion_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  pattern_type evasion_pattern_type NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence JSONB NOT NULL,
  confidence_score NUMERIC(3,2),
  is_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  false_positive BOOLEAN DEFAULT false
);

CREATE INDEX idx_evasion_patterns_actor ON evasion_patterns(actor_id);
CREATE INDEX idx_evasion_patterns_type ON evasion_patterns(pattern_type);

-- Fragmentation Detection Function
CREATE OR REPLACE FUNCTION detect_fragmentation(
  p_actor_id UUID,
  p_window_hours INTEGER DEFAULT 24,
  p_threshold_count INTEGER DEFAULT 10,
  p_small_amount_threshold_cents INTEGER DEFAULT 10000
) RETURNS TABLE(is_suspicious BOOLEAN, transaction_count INTEGER, total_amount_cents BIGINT, evidence JSONB) AS $$
DECLARE
  v_count INTEGER;
  v_total BIGINT;
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM actors WHERE id = p_actor_id;
  
  SELECT COUNT(*), COALESCE(SUM(amount_cents), 0) INTO v_count, v_total
  FROM bank_transactions bt
  JOIN bank_accounts ba ON ba.id = bt.account_id
  WHERE ba.actor_id = p_actor_id
    AND bt.created_at > now() - (p_window_hours || ' hours')::interval
    AND bt.amount_cents < p_small_amount_threshold_cents;
  
  IF v_count >= p_threshold_count THEN
    INSERT INTO evasion_patterns (tenant_id, actor_id, pattern_type, evidence, confidence_score)
    VALUES (v_tenant_id, p_actor_id, 'fragmentation',
      jsonb_build_object('count', v_count, 'total_cents', v_total),
      LEAST(v_count::NUMERIC / (p_threshold_count * 2), 1.0));
    
    RETURN QUERY SELECT true, v_count, v_total, jsonb_build_object('pattern', 'fragmentation', 'count', v_count);
  ELSE
    RETURN QUERY SELECT false, v_count, v_total, NULL::JSONB;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;


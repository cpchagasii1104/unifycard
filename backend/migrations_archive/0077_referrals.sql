-- ============================================================
-- UNIFICARD - MIGRATION 153
-- CONTINUOUS PRODUCTION: Referrals Table
-- Tabela: referrals
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela de referrals com expiração (1 ano).
-- Usado pelo Split Engine para calcular comissões de indicação.
--
-- REGRAS:
-- - Referral válido por 1 ano (ends_at = starts_at + 365 dias)
-- - Percentual fixo de 5% do profit
-- ============================================================

-- ============================================================
-- TABELA: referrals
-- ============================================================
CREATE TABLE IF NOT EXISTS referrals (
    -- Identificação
    referral_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Quem indicou (recebe comissão)
    referrer_user_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Quem foi indicado (origem das transações)
    referred_user_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Datas de validade
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Percentual em basis points (500 = 5%)
    percentage_bps INTEGER NOT NULL DEFAULT 500
        CHECK (percentage_bps >= 0 AND percentage_bps <= 10000),
    
    -- Status: 'active', 'expired', 'cancelled'
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'cancelled')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: cada usuário só pode ser indicado uma vez
    UNIQUE(tenant_id, referred_user_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para busca por referrer
CREATE INDEX IF NOT EXISTS idx_referrals_referrer
    ON referrals (tenant_id, referrer_user_id, status);

-- Índice para busca por referred (usado no split engine)
CREATE INDEX IF NOT EXISTS idx_referrals_referred
    ON referrals (tenant_id, referred_user_id, status, ends_at);

-- Índice para busca de referrals ativos
CREATE INDEX IF NOT EXISTS idx_referrals_active
    ON referrals (tenant_id, status, ends_at)
    WHERE status = 'active';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_rls ON referrals
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_referrals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_referrals_updated_at
    BEFORE UPDATE ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_referrals_updated_at();

-- ============================================================
-- TRIGGER: Marcar como expired quando ends_at passar
-- ============================================================
CREATE OR REPLACE FUNCTION check_referral_expiration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ends_at < NOW() AND NEW.status = 'active' THEN
        NEW.status = 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_referrals_expiration
    BEFORE INSERT OR UPDATE ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION check_referral_expiration();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE referrals IS
    'Referrals com expiração (1 ano). Usado pelo Split Engine para calcular comissões.';

COMMENT ON COLUMN referrals.referrer_user_id IS
    'Usuário que indicou. Recebe % do profit gerado pelo referred.';

COMMENT ON COLUMN referrals.referred_user_id IS
    'Usuário que foi indicado. Transações dele geram comissão para referrer.';

COMMENT ON COLUMN referrals.ends_at IS
    'Data de expiração (starts_at + 365 dias). Após esta data, referral não gera split.';

COMMENT ON COLUMN referrals.percentage_bps IS
    'Percentual em basis points (500 = 5%). Aplicado sobre profit após deduzir fees.';








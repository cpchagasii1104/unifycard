-- ============================================================
-- UNIFICARD - MIGRATION 134
-- SPRINT 1: FUNDAÇÃO DO UNIFY BANK
-- Contas do Sistema
-- ============================================================
--
-- OBJETIVO:
-- Criar contas do sistema para cada tenant.
-- Estas contas são necessárias para o funcionamento do Unify Bank.
--
-- CONTAS DO SISTEMA (por tenant):
-- - fee: Conta de taxas da plataforma
-- - regional_fund: Fundo regional
-- - reserve: Reserva do sistema
-- - escrow: Custódia (para garantias)
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Cada tenant DEVE ter estas 4 contas do sistema
-- - Contas do sistema são criadas automaticamente
-- - owner_type = 'system'
-- - owner_id = nome da conta (fee, regional_fund, reserve, escrow)
--
-- ============================================================

-- ============================================================
-- FUNÇÃO AUXILIAR: Gerar UUID determinístico a partir de string
-- ============================================================
CREATE OR REPLACE FUNCTION uuid_from_string(input_string TEXT)
RETURNS UUID AS $$
BEGIN
    -- Usar md5 para gerar UUID determinístico
    RETURN (
        substring(md5(input_string) from 1 for 8) || '-' ||
        substring(md5(input_string) from 9 for 4) || '-' ||
        substring(md5(input_string) from 13 for 4) || '-' ||
        substring(md5(input_string) from 17 for 4) || '-' ||
        substring(md5(input_string) from 21 for 12)
    )::UUID;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- FUNÇÃO: Criar contas do sistema para um tenant
-- ============================================================
CREATE OR REPLACE FUNCTION create_system_accounts(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
    v_account_id UUID;
    v_currencies VARCHAR(3)[] := ARRAY['BRL', 'USD', 'EUR', 'TEST'];
    v_currency VARCHAR(3);
    v_account_names VARCHAR(50)[] := ARRAY['fee', 'regional_fund', 'reserve', 'escrow'];
    v_account_name VARCHAR(50);
    v_owner_id UUID;
BEGIN
    -- Para cada moeda
    FOREACH v_currency IN ARRAY v_currencies
    LOOP
        -- Para cada conta do sistema
        FOREACH v_account_name IN ARRAY v_account_names
        LOOP
            -- Gerar UUID determinístico para owner_id
            -- Usar formato: 'system:{account_name}:{tenant_id}'
            v_owner_id := uuid_from_string('system:' || v_account_name || ':' || p_tenant_id::text);
            
            -- Verificar se a conta já existe
            SELECT account_id INTO v_account_id
            FROM bank_accounts
            WHERE tenant_id = p_tenant_id
              AND owner_id = v_owner_id
              AND owner_type = 'system'
              AND currency = v_currency;
            
            -- Se não existe, criar
            IF v_account_id IS NULL THEN
                INSERT INTO bank_accounts (
                    tenant_id,
                    owner_id,
                    owner_type,
                    currency,
                    cached_balance,
                    metadata
                ) VALUES (
                    p_tenant_id,
                    v_owner_id,
                    'system',
                    v_currency,
                    0,
                    jsonb_build_object(
                        'account_name', v_account_name,
                        'is_system_account', true,
                        'created_by', 'migration_134'
                    )
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Criar contas do sistema para todos os tenants existentes
-- ============================================================
DO $$
DECLARE
    v_tenant RECORD;
BEGIN
    FOR v_tenant IN SELECT tenant_id FROM tenants
    LOOP
        PERFORM create_system_accounts(v_tenant.tenant_id);
    END LOOP;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON FUNCTION create_system_accounts IS
    'Cria as 4 contas do sistema (fee, regional_fund, reserve, escrow) para um tenant em todas as moedas.';

COMMENT ON FUNCTION uuid_from_string IS
    'Gera UUID determinístico a partir de uma string (para contas do sistema).';








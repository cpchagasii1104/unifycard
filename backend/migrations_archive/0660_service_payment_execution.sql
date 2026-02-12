-- ============================================================
-- UNIFICARD — SERVICE PAYMENT EXECUTION DOMAIN
-- Arquivo: 141_service_payment_execution.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o domínio de EXECUÇÃO DE PAGAMENTO usando dinheiro fictício
-- Incluindo split de valores, SEM integração externa
--
-- REGRAS CANÔNICAS:
-- * Execução só pode existir se houver payment_request = pending
-- * Execução é explícita, nunca automática
-- * Nenhuma integração real
-- * Nenhum gateway
-- * Nenhum banco
-- * Nenhuma cobrança externa
-- * Dinheiro é fictício
-- * Execução é apenas registro contábil
-- * Split é explícito
-- * Nada movimenta saldo real
--
-- ============================================================

BEGIN;

-- ============================================================
-- TABELA: SERVICE_PAYMENT_EXECUTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS service_payment_executions (
  execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: Execução só pode existir se houver payment_request = pending
  -- 🔴 BLINDAGEM: Execução é explícita, nunca automática
  payment_request_id UUID NOT NULL REFERENCES service_payment_requests(payment_request_id) ON DELETE CASCADE,
  payer_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor que paga
  receiver_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor que recebe (dono do service)
  
  -- Informações Financeiras
  amount NUMERIC(18, 2) NOT NULL, -- Valor executado (deve ser igual ao payment_request.amount)
  currency VARCHAR(3) NOT NULL DEFAULT 'FIC', -- Moeda fictícia (ex: FIC = Fictícia)
  
  -- Informações da Execução
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT service_payment_executions_amount_positive CHECK (amount > 0),
  CONSTRAINT service_payment_executions_unique_per_payment_request UNIQUE (payment_request_id)
    -- 🔴 BLINDAGEM: Apenas uma execução por payment_request
);

-- ============================================================
-- TABELA: PAYMENT_SPLITS
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_splits (
  split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: Split NÃO pode existir sem execution
  execution_id UUID NOT NULL REFERENCES service_payment_executions(execution_id) ON DELETE CASCADE,
  receiver_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor que recebe parte do split
  
  -- Informações do Split
  amount NUMERIC(18, 2) NOT NULL, -- Valor do split
  percentage NUMERIC(5, 2), -- Porcentagem do split (opcional, para referência)
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT payment_splits_amount_positive CHECK (amount > 0),
  CONSTRAINT payment_splits_percentage_valid CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100))
);

-- ============================================================
-- ÍNDICES - SERVICE_PAYMENT_EXECUTIONS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_service_payment_executions_payment_request_id ON service_payment_executions(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_executions_payer_actor_id ON service_payment_executions(payer_actor_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_executions_receiver_actor_id ON service_payment_executions(receiver_actor_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_executions_tenant_id ON service_payment_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_payment_executions_executed_at ON service_payment_executions(executed_at);

-- ============================================================
-- ÍNDICES - PAYMENT_SPLITS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_payment_splits_execution_id ON payment_splits(execution_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_receiver_actor_id ON payment_splits(receiver_actor_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_tenant_id ON payment_splits(tenant_id);

-- ============================================================
-- TRIGGER: UPDATE updated_at - SERVICE_PAYMENT_EXECUTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_service_payment_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_service_payment_executions_updated_at
  BEFORE UPDATE ON service_payment_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_service_payment_executions_updated_at();

-- ============================================================
-- TRIGGER: UPDATE updated_at - PAYMENT_SPLITS
-- ============================================================

CREATE OR REPLACE FUNCTION update_payment_splits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_splits_updated_at
  BEFORE UPDATE ON payment_splits
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_splits_updated_at();

-- ============================================================
-- FUNÇÃO: VALIDAR SOMA DOS SPLITS = AMOUNT DA EXECUTION
-- ============================================================

CREATE OR REPLACE FUNCTION validate_payment_splits_sum()
RETURNS TRIGGER AS $$
DECLARE
  execution_amount NUMERIC(18, 2);
  splits_sum NUMERIC(18, 2);
BEGIN
  -- Buscar amount da execution
  SELECT amount INTO execution_amount
  FROM service_payment_executions
  WHERE execution_id = COALESCE(NEW.execution_id, OLD.execution_id);
  
  -- Calcular soma dos splits
  SELECT COALESCE(SUM(amount), 0) INTO splits_sum
  FROM payment_splits
  WHERE execution_id = COALESCE(NEW.execution_id, OLD.execution_id);
  
  -- Validar que soma dos splits = amount da execution
  IF splits_sum != execution_amount THEN
    RAISE EXCEPTION 'Soma dos splits (%) deve ser igual ao amount da execution (%)', splits_sum, execution_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar após INSERT ou UPDATE de split
CREATE TRIGGER trg_validate_payment_splits_sum
  AFTER INSERT OR UPDATE ON payment_splits
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_splits_sum();

-- Trigger para validar após DELETE de split
CREATE TRIGGER trg_validate_payment_splits_sum_delete
  AFTER DELETE ON payment_splits
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_splits_sum();

COMMIT;

-- ============================================================
-- FIM 141_service_payment_execution.sql
-- ============================================================


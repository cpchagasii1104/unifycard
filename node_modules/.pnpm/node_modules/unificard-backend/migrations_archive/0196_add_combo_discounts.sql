-- ============================================================
-- UNIFICARD — MIGRATION 046
-- Arquivo: 046_add_combo_discounts.sql
-- Tipo: PATCH ADITIVO (regras de desconto por combo)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Profissionais podem oferecer descontos quando o cliente
-- contrata múltiplos serviços em conjunto (combo).
--
-- OBJETIVO
-- Permitir definição de regras de desconto progressivas,
-- baseadas na quantidade mínima de serviços contratados.
--
-- MODELO DE DADOS
-- • Cada regra pertence a um global_user
-- • A regra é associada a uma categoria
-- • O desconto é percentual (0–100)
-- • A regra se aplica quando min_services é atingido
--
-- REGRA DE APLICAÇÃO (CONTRATO)
-- • Para um dado combo, a aplicação deve selecionar:
--   a regra ATIVA com maior min_services
--   tal que min_services <= quantidade de serviços
-- • Regras NÃO são acumulativas
-- • Apenas uma regra pode ser aplicada por categoria
--
-- ESCOPO
-- ✔ Cria tabela combo_discount_rules
-- ✔ Define constraints de integridade
-- ✔ Cria índices para lookup eficiente
-- ✔ Aplica RLS para isolamento por usuário
--
-- ❌ Não calcula descontos automaticamente
-- ❌ Não empilha regras
-- ❌ Não trata moeda
--
-- DEPENDÊNCIAS
-- • global_users
-- • categories
-- • função update_updated_at_column()
-- • extensão uuid-ossp
--
-- OBSERVAÇÕES IMPORTANTES
-- • Descontos são percentuais, não valores fixos.
-- • O schema permite múltiplas regras por categoria,
--   diferenciadas por min_services.
-- • Conflitos de regras são resolvidos na aplicação,
--   não no banco.
-- • is_active controla apenas elegibilidade da regra.
--
-- IDEMPOTÊNCIA
-- • Todas as estruturas usam IF NOT EXISTS ou guards
-- • Pode ser executada múltiplas vezes com segurança
--
-- ============================================================


-- ============================================================
-- 1) TABELA combo_discount_rules
-- ============================================================

CREATE TABLE IF NOT EXISTS combo_discount_rules (
  rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,

  -- Quantidade mínima de serviços para aplicar o desconto
  min_services INTEGER NOT NULL DEFAULT 2
    CHECK (min_services >= 2),

  -- Percentual de desconto aplicado
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (discount_percentage BETWEEN 0 AND 100),

  description TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT combo_discount_rules_unique
    UNIQUE (global_user_id, category_id, min_services)
);

-- ============================================================
-- 2) ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_combo_discount_rules_user
  ON combo_discount_rules (global_user_id);

CREATE INDEX IF NOT EXISTS idx_combo_discount_rules_category
  ON combo_discount_rules (category_id);

CREATE INDEX IF NOT EXISTS idx_combo_discount_rules_active
  ON combo_discount_rules (is_active)
  WHERE is_active = true;


-- ============================================================
-- 3) RLS
-- ============================================================

ALTER TABLE combo_discount_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'combo_discount_rules'
      AND policyname = 'combo_discount_rules_rls'
  ) THEN
    CREATE POLICY combo_discount_rules_rls
      ON combo_discount_rules
      USING (
        global_user_id::text = current_setting('app.current_user', true)
      );
  END IF;
END $$;


-- ============================================================
-- 4) TRIGGER updated_at
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_combo_discount_rules_updated_at'
  ) THEN
    CREATE TRIGGER trg_combo_discount_rules_updated_at
      BEFORE UPDATE ON combo_discount_rules
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE combo_discount_rules IS
  'Regras de desconto por combo de serviços (baseadas em quantidade mínima)';

COMMENT ON COLUMN combo_discount_rules.min_services IS
  'Número mínimo de serviços no combo para aplicar o desconto';

COMMENT ON COLUMN combo_discount_rules.discount_percentage IS
  'Percentual de desconto aplicado quando a regra é elegível';


-- ============================================================
-- FIM 046_add_combo_discounts.sql
-- ============================================================









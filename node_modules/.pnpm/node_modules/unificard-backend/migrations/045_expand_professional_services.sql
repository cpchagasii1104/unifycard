-- ============================================================
-- UNIFICARD — MIGRATION 045
-- Arquivo: 045_expand_professional_services.sql
-- Tipo: PATCH ADITIVO (serviços, produtos e precificação)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- O sistema de skills/profissões do UnifyCard evolui para
-- suportar:
-- • serviços vs produtos
-- • cobrança por visita
-- • serviços pré-definidos com preço fixo
--
-- OBJETIVO
-- Expandir o modelo de profissionais para permitir:
-- • distinção entre serviço e produto
-- • cobrança opcional de visita para orçamento
-- • catálogo de serviços pré-definidos por usuário
--
-- MODELO DE DADOS
-- • service_type = 'service' | 'product'
-- • charge_visit = true | false
-- • visit_price definido apenas quando charge_visit = true
--
-- • predefined_services:
--   - pertence a um global_user
--   - associado a uma categoria
--   - possui preço base, desconto opcional e preço final derivado
--
-- ESCOPO
-- ✔ Adiciona colunas em user_skills_categories
-- ✔ Cria tabela predefined_services
-- ✔ Cria índices e triggers padrão do projeto
-- ✔ Aplica RLS para isolamento por usuário
--
-- ❌ Não remove colunas existentes
-- ❌ Não altera dados históricos
--
-- DEPENDÊNCIAS
-- • user_skills_categories
-- • global_users
-- • categories
-- • função update_updated_at_column()
-- • extensão uuid-ossp
--
-- OBSERVAÇÕES IMPORTANTES
-- • service_type é ortogonal a pricing_type (migration 044).
-- • predefined_services NÃO substitui user_skills_categories;
--   ele representa ofertas concretas com preço fixo.
-- • visit_price só é válido quando charge_visit = true.
-- • final_price é coluna derivada e não deve ser atualizada manualmente.
-- • Este modelo não trata moeda; assume moeda do tenant.
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
-- • Pode ser executada múltiplas vezes com segurança
--
-- ============================================================


-- ============================================================
-- 1) EXPANSÃO DE user_skills_categories
-- ============================================================

-- Tipo de oferta: serviço ou produto
ALTER TABLE user_skills_categories
ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'service'
CHECK (service_type IN ('service', 'product'));

-- Cobra visita para orçamento?
ALTER TABLE user_skills_categories
ADD COLUMN IF NOT EXISTS charge_visit BOOLEAN NOT NULL DEFAULT false;

-- Preço da visita (quando aplicável)
ALTER TABLE user_skills_categories
ADD COLUMN IF NOT EXISTS visit_price NUMERIC(10,2) NULL;

-- Coerência entre charge_visit e visit_price
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_skills_visit_price_coherence'
  ) THEN
    ALTER TABLE user_skills_categories
      ADD CONSTRAINT user_skills_visit_price_coherence
      CHECK (
        (charge_visit = false AND visit_price IS NULL)
        OR
        (charge_visit = true AND visit_price IS NOT NULL AND visit_price >= 0)
      );
  END IF;
END $$;

COMMENT ON COLUMN user_skills_categories.service_type IS
  'Tipo da oferta: service (serviço) ou product (produto)';

COMMENT ON COLUMN user_skills_categories.charge_visit IS
  'Indica se o profissional cobra pela visita para orçamento';

COMMENT ON COLUMN user_skills_categories.visit_price IS
  'Preço da visita quando charge_visit = true';


-- ============================================================
-- 2) TABELA predefined_services
-- ============================================================

CREATE TABLE IF NOT EXISTS predefined_services (
  service_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),

  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (discount_percentage BETWEEN 0 AND 100),

  final_price NUMERIC(10,2)
    GENERATED ALWAYS AS (
      base_price * (1 - discount_percentage / 100)
    ) STORED,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT predefined_services_unique
    UNIQUE (global_user_id, category_id, name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_predefined_services_user
  ON predefined_services (global_user_id);

CREATE INDEX IF NOT EXISTS idx_predefined_services_category
  ON predefined_services (category_id);

CREATE INDEX IF NOT EXISTS idx_predefined_services_active
  ON predefined_services (is_active)
  WHERE is_active = true;

COMMENT ON TABLE predefined_services IS
  'Serviços pré-definidos com preço fixo definidos por profissionais';


-- ============================================================
-- 3) RLS EM predefined_services
-- ============================================================

ALTER TABLE predefined_services ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'predefined_services'
      AND policyname = 'predefined_services_rls'
  ) THEN
    CREATE POLICY predefined_services_rls
      ON predefined_services
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
    WHERE tgname = 'trg_predefined_services_updated_at'
  ) THEN
    CREATE TRIGGER trg_predefined_services_updated_at
      BEFORE UPDATE ON predefined_services
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================================
-- FIM 045_expand_professional_services.sql
-- ============================================================

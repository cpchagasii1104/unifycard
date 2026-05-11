-- ============================================================
-- C15 FIX: tenant_products + _deprecated_tenant_products — remover coluna price NUMERIC
-- §Nomenclatura: dinheiro = amount_cents BIGINT
-- ============================================================
--
-- CONTEXTO:
--   Migration 0112 criou tenant_products com price NUMERIC(10,2).
--   Migration 20260526101000 (DRAFT) adicionou price_cents BIGINT e fez backfill.
--   Esta migration completa a transição removendo price NUMERIC de ambas as tabelas.
--
-- TABELAS AFETADAS:
--   - tenant_products (se existir)
--   - _deprecated_tenant_products (se existir)
--
-- PRÉ-REQUISITOS:
--   - 20260526101000 aplicada (price_cents existe e está populada)
--   - Nenhum código usa coluna price (verificado: 0 ocorrências)
--
-- SEGURANÇA:
--   - Verifica se price_cents existe antes de dropar price
--   - Idempotente (não falha se price já foi removida ou tabela não existe)
-- ============================================================

BEGIN;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenant_products', '_deprecated_tenant_products']::TEXT[]
  LOOP
    -- Pula se tabela não existe
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      RAISE NOTICE 'C15 FIX: Tabela % não existe. Pulando.', tbl;
      CONTINUE;
    END IF;

    -- Só remove price se price_cents já existe (migration anterior aplicada)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'price_cents'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'price'
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN price', tbl);
      RAISE NOTICE 'C15 FIX: %.price NUMERIC removida. price_cents BIGINT é agora a única coluna de preço.', tbl;

    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'price'
    ) THEN
      RAISE NOTICE 'C15 FIX: %.price já foi removida anteriormente. Nenhuma ação necessária.', tbl;

    ELSE
      RAISE EXCEPTION 'C15 FIX: %.price_cents não existe. Execute 20260526101000 primeiro.', tbl;
    END IF;
  END LOOP;
END $$;

-- Atualizar comentários (só se tabelas existirem)
DO $$
BEGIN
  IF to_regclass('public.tenant_products') IS NOT NULL THEN
    EXECUTE $c$
      COMMENT ON TABLE tenant_products IS
        'Produto por tenant. Preço em price_cents (BIGINT, centavos). §Nomenclatura Canônica.'
    $c$;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_products' AND column_name = 'price_cents'
    ) THEN
      EXECUTE $c$
        COMMENT ON COLUMN tenant_products.price_cents IS
          'Preço em centavos (BIGINT). §Nomenclatura: dinheiro = amount_cents BIGINT.'
      $c$;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public._deprecated_tenant_products') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '_deprecated_tenant_products' AND column_name = 'price_cents'
    ) THEN
      EXECUTE $c$
        COMMENT ON COLUMN _deprecated_tenant_products.price_cents IS
          'Preço em centavos (BIGINT). §Nomenclatura: dinheiro = amount_cents BIGINT. Tabela deprecated.'
      $c$;
    END IF;
  END IF;
END $$;

COMMIT;

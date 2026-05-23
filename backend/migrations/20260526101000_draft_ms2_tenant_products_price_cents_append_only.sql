-- ============================================================
-- M-S2 — Monetário confirmado: preço legado em tenant_products / _deprecated_tenant_products
--   APPEND-ONLY: adiciona `price_cents`, backfill, NÃO remove `price`.
-- ============================================================
--
-- Gate 2 / produto:
--   Não cria SSOT financeiro novo; só estrutura forward-compatible em tabela legada.
--   Se `_deprecated_tenant_products` não faz parte do futuro, o destino da tabela é
--   decisão de produto / Gate 5 (remoção), não desta migration.
--
-- JUSTIFICATIVA (domínio):
--   Coluna `price` nestas tabelas foi definida como NUMERIC(10,2) monetário (0112).
--   Não inclui order_items, inventário nem quantidades.
--
-- RISCO:
--   Ambiente pode já ter só `_deprecated_tenant_products` ou ainda `tenant_products`;
--   outro ambiente pode já ter `price_cents` — guards evitam duplicar coluna.
--   Se `price` não for NUMERIC (schema divergente), o bloco não corre.
--
-- Por que é seguro:
--   Verifica `information_schema.tables` + colunas + tipo de `price`;
--   não assume NUMERIC em tabelas não listadas; não executa DROP.
--
-- CHECKPOINT: após review — confirmar que nenhum código ainda **escreve** só em `price`
--   antes de tornar `price_cents` fonte única (isso é mudança de app, não desta migration).
-- ============================================================

BEGIN;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenant_products', '_deprecated_tenant_products']::TEXT[]
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'price'
        AND data_type = 'numeric'
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'price_cents'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ADD COLUMN price_cents BIGINT', tbl);

    EXECUTE format(
      $f$
      UPDATE %I
      SET price_cents = GREATEST(0, ROUND(COALESCE(price, 0) * 100)::BIGINT)
      WHERE price_cents IS NULL
      $f$,
      tbl
    );

    EXECUTE format('ALTER TABLE %I ALTER COLUMN price_cents SET NOT NULL', tbl);

    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', tbl, tbl || '_price_cents_nonneg');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (price_cents >= 0)',
      tbl,
      tbl || '_price_cents_nonneg'
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.tenant_products') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tenant_products' AND column_name = 'price_cents'
     ) THEN
    EXECUTE $c$
      COMMENT ON COLUMN tenant_products.price_cents IS
        'DRAFT: preço em centavos (convive com price NUMERIC até remoção programada).'
    $c$;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public._deprecated_tenant_products') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '_deprecated_tenant_products' AND column_name = 'price_cents'
     ) THEN
    EXECUTE $c$
      COMMENT ON COLUMN _deprecated_tenant_products.price_cents IS
        'DRAFT: preço em centavos (convive com price NUMERIC até remoção programada).'
    $c$;
  END IF;
END $$;

COMMIT;

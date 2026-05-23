-- Unificação semântica v2 (Opção B): SSOT único em `concepts` / `concept_id`.
-- Idempotente; não assume `product_concepts`, `product_concept_id` nem `product_concept_resolution_queue`.
-- Não remove colunas nem tabelas (cleanup em migration posterior).

BEGIN;

-- 1) Domínio N0 para itens comerciais (pré-requisito se `concepts.domain` for FK em `domains`).
INSERT INTO domains (domain_key)
SELECT 'item-comercial'
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'domains'
  )
  AND NOT EXISTS (
    SELECT 1 FROM domains WHERE domain_key = 'item-comercial'
  );

-- 2) Colunas canónicas mínimas (bases antigas / parciais).
ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS fingerprint_v1 TEXT;

ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS concept_resolution_status TEXT NOT NULL DEFAULT 'unresolved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'canonical_products_concept_resolution_status_chk'
  ) THEN
    ALTER TABLE canonical_products
      ADD CONSTRAINT canonical_products_concept_resolution_status_chk
      CHECK (concept_resolution_status IN ('unresolved', 'auto_suggested', 'confirmed'));
  END IF;
END $$;

ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS concept_id UUID;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'concepts')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'canonical_products_concept_id_fkey'
     ) THEN
    ALTER TABLE canonical_products
      ADD CONSTRAINT canonical_products_concept_id_fkey
      FOREIGN KEY (concept_id) REFERENCES concepts (concept_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_canonical_products_concept_id
  ON canonical_products (concept_id)
  WHERE concept_id IS NOT NULL;

-- 3) Backfill: `product_concepts` legado → linhas em `concepts` (domain fixo) + `canonical_products.concept_id`.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_concepts')
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'canonical_products' AND column_name = 'product_concept_id'
     )
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'concepts')
  THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product_concepts' AND column_name = 'normalized_name'
    ) THEN
      INSERT INTO concepts (slug, domain)
      SELECT DISTINCT
        COALESCE(
          NULLIF(trim(pc.normalized_name), ''),
          lower(regexp_replace(btrim(pc.canonical_name), '\s+', ' ', 'g'))
        ),
        'item-comercial'
      FROM product_concepts pc
      WHERE COALESCE(
          NULLIF(trim(pc.normalized_name), ''),
          lower(regexp_replace(btrim(pc.canonical_name), '\s+', ' ', 'g'))
        ) IS NOT NULL
        AND COALESCE(
          NULLIF(trim(pc.normalized_name), ''),
          lower(regexp_replace(btrim(pc.canonical_name), '\s+', ' ', 'g'))
        ) <> ''
      ON CONFLICT (domain, slug) DO NOTHING;

      UPDATE canonical_products cp
      SET concept_id = c.concept_id
      FROM product_concepts pc
      JOIN concepts c
        ON c.domain = 'item-comercial'
       AND c.slug = COALESCE(
         NULLIF(trim(pc.normalized_name), ''),
         lower(regexp_replace(btrim(pc.canonical_name), '\s+', ' ', 'g'))
       )
      WHERE cp.product_concept_id = pc.id
        AND cp.concept_id IS NULL;
    ELSE
      INSERT INTO concepts (slug, domain)
      SELECT DISTINCT lower(regexp_replace(btrim(pc.canonical_name), '\s+', ' ', 'g')), 'item-comercial'
      FROM product_concepts pc
      WHERE btrim(pc.canonical_name) <> ''
      ON CONFLICT (domain, slug) DO NOTHING;

      UPDATE canonical_products cp
      SET concept_id = c.concept_id
      FROM product_concepts pc
      JOIN concepts c
        ON c.domain = 'item-comercial'
       AND c.slug = lower(regexp_replace(btrim(pc.canonical_name), '\s+', ' ', 'g'))
      WHERE cp.product_concept_id = pc.id
        AND cp.concept_id IS NULL;
    END IF;
  END IF;
END
$mig$;

-- 4) Nova fila (SSOT semântico = `concepts.concept_id`; sem FK para product_concepts).
CREATE TABLE IF NOT EXISTS canonical_concept_resolution_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
  canonical_product_id UUID NOT NULL REFERENCES canonical_products (id) ON DELETE CASCADE,
  resolved_concept_id UUID REFERENCES concepts (concept_id) ON DELETE SET NULL,
  suggested_confidence NUMERIC(5, 4),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_actor_id UUID,
  CONSTRAINT canonical_concept_resolution_queue_status_chk
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT canonical_concept_resolution_queue_suggested_confidence_chk
    CHECK (suggested_confidence IS NULL OR (suggested_confidence >= 0 AND suggested_confidence <= 1))
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'actors')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'canonical_concept_resolution_queue_resolved_by_actor_id_fkey'
     ) THEN
    ALTER TABLE canonical_concept_resolution_queue
      ADD CONSTRAINT canonical_concept_resolution_queue_resolved_by_actor_id_fkey
      FOREIGN KEY (resolved_by_actor_id) REFERENCES actors (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_canonical_concept_resolution_queue_status
  ON canonical_concept_resolution_queue (status);

CREATE INDEX IF NOT EXISTS idx_canonical_concept_resolution_queue_canonical_product_id
  ON canonical_concept_resolution_queue (canonical_product_id);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_ccrq_canonical_pending
  ON canonical_concept_resolution_queue (canonical_product_id)
  WHERE status = 'pending';

COMMENT ON TABLE canonical_concept_resolution_queue IS
  'Fila humana: ligação canonical_products → concepts (SSOT). Sem product_concepts.';

-- 5) Copiar fila legado (se existir). Pl/pgSQL evita parse error quando a tabela legado não existe.
DO $copyq$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_concept_resolution_queue'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'product_concepts'
    ) THEN
      INSERT INTO canonical_concept_resolution_queue (
        id,
        canonical_product_id,
        resolved_concept_id,
        suggested_confidence,
        status,
        created_at,
        resolved_at,
        resolved_by_actor_id
      )
      SELECT
        o.id,
        o.canonical_product_id,
        (
          SELECT c.concept_id
          FROM product_concepts pc
          JOIN concepts c
            ON c.domain = 'item-comercial'
           AND c.slug = CASE
             WHEN EXISTS (
               SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'product_concepts' AND column_name = 'normalized_name'
             )
             THEN COALESCE(
               NULLIF(trim(pc.normalized_name), ''),
               lower(regexp_replace(btrim(pc.canonical_name), '\s+', ' ', 'g'))
             )
             ELSE lower(regexp_replace(btrim(pc.canonical_name), '\s+', ' ', 'g'))
           END
          WHERE pc.id = o.suggested_concept_id
          LIMIT 1
        ),
        o.suggested_confidence,
        o.status,
        o.created_at,
        o.resolved_at,
        NULL
      FROM product_concept_resolution_queue o
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO canonical_concept_resolution_queue (
        id,
        canonical_product_id,
        resolved_concept_id,
        suggested_confidence,
        status,
        created_at,
        resolved_at,
        resolved_by_actor_id
      )
      SELECT
        o.id,
        o.canonical_product_id,
        NULL::uuid,
        o.suggested_confidence,
        o.status,
        o.created_at,
        o.resolved_at,
        NULL
      FROM product_concept_resolution_queue o
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END
$copyq$;

-- 6) Renomear fila legado (preserva histórico; código novo não usa).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_concept_resolution_queue'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'canonical_concept_resolution_queue'
  ) THEN
    ALTER TABLE product_concept_resolution_queue RENAME TO _deprecated_product_concept_resolution_queue;
  END IF;
END $$;

-- 7) Renomear tabelas legadas (sem DROP). Ordem: referenciada antes do dependente quando necessário.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_concepts')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_deprecated_product_concepts') THEN
    ALTER TABLE product_concepts RENAME TO _deprecated_product_concepts;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_products')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_deprecated_catalog_products') THEN
    ALTER TABLE catalog_products RENAME TO _deprecated_catalog_products;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_products')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_deprecated_tenant_products') THEN
    ALTER TABLE tenant_products RENAME TO _deprecated_tenant_products;
  END IF;
END $$;

COMMIT;

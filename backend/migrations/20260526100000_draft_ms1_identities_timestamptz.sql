-- ============================================================
-- M-S1 (final) — identities: TIMESTAMP → TIMESTAMPTZ
-- ============================================================
--
-- DECISÃO CANÔNICA:
--   identities.created_at / updated_at são tratados como UTC naïve
--   conversão para TIMESTAMPTZ usando AT TIME ZONE 'UTC'
--
--   Alinha `identities` ao padrão do resto do core (TIMESTAMPTZ + now()), evitando
--   dois “relógios” semânticos no mesmo sistema.
--
-- Por que é seguro (técnico):
--   Guard em `information_schema` (timestamp sem TZ, portável entre versões PG);
--   idempotente se já migrado para `timestamp with time zone`.
--
-- Produção (lock):
--   `ALTER TYPE` pode reescrever a tabela e bloquear escrita; em `identities` pequena
--   é negligenciável — em tabelas grandes, janela de manutenção + monitorização.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'identities'
      AND column_name = 'created_at'
      AND data_type LIKE 'timestamp%'
      AND data_type NOT ILIKE '%with time zone%'
  ) THEN
    ALTER TABLE identities
      ALTER COLUMN created_at TYPE TIMESTAMPTZ
      USING (created_at AT TIME ZONE 'UTC');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'identities'
      AND column_name = 'updated_at'
      AND data_type LIKE 'timestamp%'
      AND data_type NOT ILIKE '%with time zone%'
  ) THEN
    ALTER TABLE identities
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ
      USING (updated_at AT TIME ZONE 'UTC');
  END IF;
END $$;

COMMIT;

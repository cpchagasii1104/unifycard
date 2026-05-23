-- ============================================================
-- 0085: Função de limpeza idempotency_keys (> 24h)
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION cleanup_idempotency_keys()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM idempotency_keys
  WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMIT;

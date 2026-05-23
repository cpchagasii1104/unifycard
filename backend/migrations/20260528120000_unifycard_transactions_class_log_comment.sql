-- Reforço: taxonomia explícita CLASS: LOG (tooling / auditoria futura; não altera schema).

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.unifycard_transactions') IS NOT NULL THEN
    COMMENT ON TABLE unifycard_transactions IS
      'CLASS: LOG | LOG ONLY — NON-SSOT — correlação operacional com bank_transaction_id; '
      'NÃO usar para decisão de saldo nem substituir bank_ledger / bank_transactions (Gate 2). '
      'Ver SSOT_REGISTRY_UNIFICARD.md (taxonomia).';
  END IF;
END $$;

COMMIT;

BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ai_constitutional_limits' AND column_name='kill_switch') THEN
    ALTER TABLE ai_constitutional_limits RENAME COLUMN kill_switch TO is_kill_switch_active;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='categories' AND column_name='created_by_ai') THEN
    ALTER TABLE categories RENAME COLUMN created_by_ai TO is_created_by_ai;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='coverage_audit_log' AND column_name='operation_blocked') THEN
    ALTER TABLE coverage_audit_log RENAME COLUMN operation_blocked TO is_operation_blocked;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='evasion_patterns' AND column_name='false_positive') THEN
    ALTER TABLE evasion_patterns RENAME COLUMN false_positive TO is_false_positive;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='profile_personal_confirmed') THEN
    ALTER TABLE profiles RENAME COLUMN profile_personal_confirmed TO is_profile_personal_confirmed;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reconciliation_ledger_discrepancies' AND column_name='resolved') THEN
    ALTER TABLE reconciliation_ledger_discrepancies RENAME COLUMN resolved TO is_resolved;
  END IF;
END $$;

COMMIT;

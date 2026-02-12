-- ============================================================
-- UNIFICARD — MIGRATION 990
-- Arquivo: 990_fix_ledger_entries_evidence_pack_fk.sql
-- Tipo: CORREÇÃO (Forward-Only)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Migration 130_ledger_entries.sql criou FK incorreta:
--   REFERENCES evidence_packs(id)
--
-- Migration 924_evidence_packs.sql define PK como pack_id.
--
-- Esta migration corrige a FK para referenciar pack_id.
--
-- REGRAS:
-- - Forward-Only (Lei 2): não altera migration 130
-- - Remove FK incorreta e recria com referência correta
-- ============================================================

BEGIN;

-- ============================================================
-- 1) REMOVER FK INCORRETA
-- ============================================================

DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  -- Buscar nome da constraint FK que referencia evidence_packs
  SELECT tc.constraint_name INTO constraint_name_var
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'ledger_entries'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'evidence_pack_id'
    AND ccu.table_name = 'evidence_packs'
  LIMIT 1;

  -- Remover constraint se existir
  IF constraint_name_var IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ledger_entries DROP CONSTRAINT %I', constraint_name_var);
  END IF;
END $$;

-- ============================================================
-- 2) RECRIAR FK CORRETA (pack_id)
-- ============================================================

ALTER TABLE ledger_entries
  ADD CONSTRAINT ledger_entries_evidence_pack_id_fkey
  FOREIGN KEY (evidence_pack_id)
  REFERENCES evidence_packs(pack_id)
  ON DELETE RESTRICT;

-- ============================================================
-- 3) COMENTÁRIO
-- ============================================================

COMMENT ON CONSTRAINT ledger_entries_evidence_pack_id_fkey ON ledger_entries IS
  'FK corrigida: referencia evidence_packs(pack_id) conforme migration 924';

COMMIT;


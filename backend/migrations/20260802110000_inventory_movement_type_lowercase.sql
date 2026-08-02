-- 20260802110000_inventory_movement_type_lowercase.sql
-- F-INVENTORY-MOVEMENT-TYPE-LOWERCASE: converge o enum do LEDGER FÍSICO para a norma.
-- Autoridade: 07_NOMENCLATURA §4.78 (emenda ratificada por Clayton em 2026-08-02) — 'in'/'out' é
-- o crédito/débito do ledger físico, e a §4.53 já proibia CREDIT/DEBIT maiúsculos no financeiro.
--
-- ⚠️ LEDGER FÍSICO (Lei 5): este enum governa `inventory_movements`, remissão a
-- INVARIANTES_OPERACIONAIS_LEDGER. Cuidados aplicados: RENAME VALUE puro (conjunto idêntico
-- ignorando case — nenhum valor nasce ou morre, mesmo mecanismo provado em 20260801120000, que
-- preserva OID e reescreve DEFAULT sozinho); validado em EFÊMERO antes de aplicar; e a fatia
-- converge TODOS os sítios de código no MESMO commit (16 arquivos, tipo primeiro, compilador
-- enumera) para não abrir janela incoerente.
--
-- ESTADO MEDIDO ANTES (unificard_dev, read-only): inventory_movements = 0 linhas.
-- Enum usado por EXATAMENTE 1 coluna (inventory_movements.movement_type).

BEGIN;

ALTER TYPE inventory_movement_type RENAME VALUE 'IN'         TO 'in';
ALTER TYPE inventory_movement_type RENAME VALUE 'OUT'        TO 'out';
ALTER TYPE inventory_movement_type RENAME VALUE 'ADJUSTMENT' TO 'adjustment';

COMMENT ON COLUMN inventory_movements.movement_type IS
  'Tipo de movimento do ledger físico, §4.78 lowercase: in, out, adjustment. Convergido em 2026-08-02; espelha a proibição da §4.53 (CREDIT/DEBIT maiúsculos) no ledger financeiro.';

COMMIT;

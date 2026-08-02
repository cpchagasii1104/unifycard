-- 20260802100000_actor_debts_status_lowercase.sql
-- Fecha o case-drift MISTO de actor_debts.status — a pendência aberta desde 2026-05-12
-- (DT-C36-actor-debts-case-drift), resolvida agora POR NORMA, não por decisão nova:
-- 07_NOMENCLATURA §4.11 manda status em snake_case minúsculo, e a própria DT já previa a
-- convergência ("pending + transferred_to_organizer; migration revert CHECK misto → lowercase
-- puro"). Ratificado por Clayton em 2026-08-02.
--
-- ESTADO MEDIDO ANTES (unificard_dev, read-only): actor_debts = 0 linhas. DEFAULT já é 'pending'.
-- ALCANCE (grep sem truncar): NENHUM writer de runtime grava 'TRANSFERRED_TO_ORGANIZER' hoje (o
-- event-scheduler citado pela DT de maio não existe mais); restam 2 READERS em
-- trust.service.ts:463,:485 (convergidos no mesmo commit) e seeds de teste. 'paid' NÃO entra:
-- a DT o listava como opcional e nada o escreve — adicioná-lo seria permissão, não conserto.

BEGIN;

ALTER TABLE actor_debts
  DROP CONSTRAINT IF EXISTS chk_actor_debts_status;

ALTER TABLE actor_debts
  ADD CONSTRAINT chk_actor_debts_status
  CHECK (status IN ('pending', 'transferred_to_organizer'));

COMMENT ON COLUMN actor_debts.status IS
  'Lifecycle da dívida, §4.11 snake_case minúsculo: pending, transferred_to_organizer. CHECK misto (pending + TRANSFERRED_TO_ORGANIZER) fechado em 2026-08-02 — a exceção maiúscula nunca foi ratificada; era drift do desenho anterior.';

COMMIT;

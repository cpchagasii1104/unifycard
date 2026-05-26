-- ============================================================
-- Reconciliation — alinhamento CHECK ↔ enum TS
-- ============================================================
-- Sessão: 2026-05-25 (Caminho 2 — detectar antes de endurecer)
--
-- Contexto:
--   `reconciliation_ledger_discrepancies.discrepancy_type` tem CHECK constraint
--   que aceita apenas 4 valores (ledger_mismatch, account_mismatch,
--   orphan_transaction, orphan_ledger_entry). O enum TS em
--   `backend/src/modules/reconciliation/reconciliation.repository.ts:11-16`
--   já contém um 5º valor desde c149ede4 (Fatia 2 — 'settled_intent_without_credit'),
--   mas a migration correspondente do CHECK NUNCA foi feita. Drift institucional
--   silencioso: em produção, se a reconciliation detectasse esse caso, o
--   INSERT falharia com erro 23514. O E2E financeiro existente NÃO exercita
--   esse caminho específico (não cria intent settled sem credit), então o gap
--   nunca foi exposto.
--
--   Esta fatia (Caminho 2) ADICIONA 2 detecções novas:
--   - 'payout_transferred_status_not_completed' (janela B: payout-worker
--     processPayout commitou transfer + updatePayoutStatus não rodou)
--   - 'settlement_transferred_status_not_sent' (janela C: bank-settlement-worker
--     efeito 1 commitou transfer + efeito 2 (mark_sent) não rodou)
--
--   Tentar INSERT com qualquer dos 3 tipos faltantes expõe o drift via erro
--   23514 (constraint violation). Esta migration alinha CHECK ↔ enum em UMA
--   operação: DROP + ADD com os 7 valores canônicos.
--
-- Diretriz institucional: enum TS é fonte SEMÂNTICA; CHECK do DB é defesa em
-- profundidade (rejeita strings arbitrárias). NÃO removemos o CHECK — alinhamos.
--
-- Reversibilidade: ALTA (DROP + ADD inverso volta ao estado anterior).
-- Blast: BAIXO (CHECK NÃO bloqueia rows existentes; mais permissivo).
-- ============================================================

BEGIN;

ALTER TABLE reconciliation_ledger_discrepancies
  DROP CONSTRAINT IF EXISTS reconciliation_ledger_discrepancies_type_check;

ALTER TABLE reconciliation_ledger_discrepancies
  ADD CONSTRAINT reconciliation_ledger_discrepancies_type_check
  CHECK (discrepancy_type IN (
    -- valores originais
    'ledger_mismatch',
    'account_mismatch',
    'orphan_transaction',
    'orphan_ledger_entry',
    -- adicionado em c149ede4 ao enum TS, faltava no CHECK do DB (drift histórico)
    'settled_intent_without_credit',
    -- Caminho 2 (detectar antes de endurecer) — janelas async entre transfer (bank)
    -- e UPDATE de status nas filas (payout_requests, bank_settlements). Detecção
    -- pura: reconciliation lista e grava discrepância; NÃO corrige nem move dinheiro.
    'payout_transferred_status_not_completed',
    'settlement_transferred_status_not_sent'
  ));

COMMENT ON CONSTRAINT reconciliation_ledger_discrepancies_type_check
  ON reconciliation_ledger_discrepancies IS
  'Alinhado com LedgerReconciliationDiscrepancyType em reconciliation.repository.ts (Caminho 2, 2026-05-25). Defesa em profundidade contra strings arbitrárias.';

COMMIT;

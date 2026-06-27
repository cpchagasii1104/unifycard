// frontend/src/api/disputes.ts
// F-DISPUTES-FRONTEND-HONEST-CONTAINMENT (2026-06-27):
//   Este client ANTES usava localStorage como "verdade" e fabricava resolução/reversão
//   no browser (status='resolved'/'rejected'/'reverted', revertedTransactionId) SEM Bank —
//   uma mentira operacional. O backend de disputas/reversão É completo e DELIBERADAMENTE
//   fail-closed em 403 (DECISION-0123: dispute/reversal HTTP = DECISION_REQUIRED / P1).
//   "Frontend nunca cria verdade — projeta verdade resolvida": o frontend NÃO tem fonte de
//   verdade de disputa. Enquanto o cano permanece fechado (HOLD), este módulo é um TERMINAL
//   HONESTO de LEITURA: não persiste nada, não muta nada, não fabrica reversão financeira.
//   - NÃO usa localStorage como verdade operacional (nem para draft que aparente oficial).
//   - NÃO expõe createDispute/resolveDispute/rejectDispute/revertDispute (removidos).
//   - NÃO chama Bank, NÃO reverte transação, NÃO grava revertedTransactionId, NÃO marca 'reverted'.
//   - NÃO chama as rotas backend contidas esperando sucesso (seguem 403 por DECISION-0123).
//   Religar disputa/reversão real = frente própria sob IA-DINHEIRO + desenhos (HOLD).

import type { Dispute } from '../types/dispute';

/**
 * Lista disputas para um actor — SEM fonte de verdade de frontend.
 * Retorna vazio honesto enquanto o backend de disputas permanece fail-closed (DECISION-0123).
 */
export async function listDisputes(_actorId: string): Promise<Dispute[]> {
  return [];
}

/**
 * Lista disputas abertas — vazio honesto (sem verdade de frontend; backend contido / 403).
 */
export async function listOpenDisputes(_actorId: string): Promise<Dispute[]> {
  return [];
}

/**
 * Obtém uma disputa por ID — sem verdade de frontend; nada a projetar enquanto contido.
 */
export async function getDispute(_disputeId: string): Promise<Dispute | null> {
  return null;
}

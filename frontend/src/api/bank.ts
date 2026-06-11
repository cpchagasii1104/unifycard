// frontend/src/api/bank.ts
// API para Wallet e Statement do Unify Bank
//
// Conformidade §4.7 (07_NOMENCLATURA_CANONICA): monetário sempre em centavos
// com sufixo `_cents`. Backend retorna `balanceCents` canônico; o campo
// `balance` legado é mantido como opcional apenas para tolerância a
// instâncias antigas do backend (em runtime atual sempre vem `balanceCents`).
// Todos os consumers internos foram migrados para `balanceCents`/`amountCents`
// via `centsToReais` (ver `frontend/src/utils/money.ts`).

import { apiFetch, extractErrorMessage } from './client';

export interface BankBalance {
  success: boolean;
  /** Saldo em centavos (canônico §4.7). Backend `/bank/balance` retorna sempre. */
  balanceCents?: number;
  /** @deprecated tolerância para instâncias antigas do backend. Não usar em código novo. */
  balance?: number;
  currency: string;
  hasAccount: boolean;
}

export interface BankStatementEntry {
  transactionId: string;
  type: 'p2p' | 'donation' | 'split' | 'compensation' | 'governance' | 'other';
  /** Valor em centavos (canônico §4.7). Backend retorna sempre. */
  amountCents: number;
  direction: 'in' | 'out';
  /** Saldo após a entrada, em centavos (canônico §4.7). Backend retorna sempre. */
  balanceAfterCents: number;
  createdAt: string;
  context?: string; // event_ticket, service_booking, ride_payment, donation, p2p_transfer, etc.
  status?: 'completed' | 'reversed' | 'pending' | 'failed';
  referenceType?: string; // event, booking, ride, group, etc.
  referenceId?: string; // ID da referência
  metadata: {
    type?: string;
    targetType?: string;
    targetId?: string;
    originTransactionId?: string;
    splitGroupId?: string;
    message?: string;
    [key: string]: any;
  };
}

export interface BankStatement {
  entries: BankStatementEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * Busca saldo atual no Unify Bank.
 *
 * 2026-05-18 P1 — Bank actor-context (DT-PRESSURE-BANK-ACTOR-CONTEXT fechada).
 * Quando `actorId` presente: backend valida authority via capability resolver
 * e retorna saldo do actor (user/page/group). Sem `actorId`: saldo do user
 * autenticado (comportamento legado).
 *
 * Frontend NUNCA infere saldo localmente — sempre delega ao backend.
 */
export async function getBankBalance(options?: { actorId?: string }): Promise<BankBalance> {
  const qs = options?.actorId ? `?actorId=${encodeURIComponent(options.actorId)}` : '';
  const response = await apiFetch(`/bank/balance${qs}`, {}, { silent401: true });

  if (!response.ok) {
    // CP7 HOME READ SEAL: 401/403/erro NUNCA viram saldo 0 fabricado no cliente — o frontend
    // não cria verdade financeira. Erro propaga; consumidores exibem "indisponível" (—).
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Erro ao buscar saldo: ${response.status}`));
  }

  const data = await response.json();
  return data;
}

export interface P2PTransferResult {
  success: boolean;
  transaction: {
    transactionId: string;
    eventId: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  };
  fromUserId: string;
  toUserId: string;
  fromAccountBalanceCents: number;
  toAccountBalanceCents: number;
}

/**
 * Transferência P2P entre usuários (segundo contexto econômico ponta-a-ponta)
 *
 * Backend: POST /bank/p2p-transfer → bankP2PTransferService.transferP2P
 *          → bank-integration motor canônico (mesmo de event_ticket)
 *          → context: 'p2p_transfer', concept_id: 'split-payment'
 *
 * Causalidade preservada: ledger imutável, double-entry, autoria rastreável.
 */
export async function p2pTransfer(input: {
  toUserId: string;
  amountCents: number;
}): Promise<P2PTransferResult> {
  const response = await apiFetch('/bank/p2p-transfer', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Erro ao transferir: ${response.status}`));
  }

  return await response.json();
}

/**
 * Busca extrato financeiro.
 *
 * 2026-05-18 P1 — Bank actor-context. Quando `actorId` presente, backend
 * valida authority e resolve extrato do actor (user/page/group).
 * Frontend NUNCA infere — sempre delega ao backend.
 */
export async function getBankStatement(options: {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  actorId?: string;
  /** CP4 PJ-B5: superfícies PJ NÃO podem converter 401/403 em extrato vazio (GO §3.4 —
   *  erro ≠ ausência). true ⇒ erro de auth PROPAGA; o caller exibe "indisponível".
   *  Default false preserva o comportamento legado das superfícies PF (Wallet/Home). */
  strictAuthErrors?: boolean;
} = {}): Promise<BankStatement> {
  const { limit = 50, offset = 0, startDate, endDate, actorId, strictAuthErrors = false } = options;

  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (startDate) {
    params.append('startDate', startDate.toISOString());
  }
  if (endDate) {
    params.append('endDate', endDate.toISOString());
  }
  if (actorId) {
    params.append('actorId', actorId);
  }

  const response = await apiFetch(`/bank/statement?${params.toString()}`, {}, { silent401: true });

  if (!response.ok) {
    if (!strictAuthErrors && (response.status === 401 || response.status === 403)) {
      return {
        entries: [],
        total: 0,
        hasMore: false,
      };
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Erro ao buscar extrato: ${response.status}`));
  }

  const data = await response.json();

  if (!data.statement) {
    throw new Error('Resposta inválida do servidor');
  }

  return data.statement;
}







